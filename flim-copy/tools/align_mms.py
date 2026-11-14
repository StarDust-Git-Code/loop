"""Forced alignment for the full take using MMS_FA."""
import json
import os
import re
import ssl
import subprocess
import torch
import torchaudio

ssl._create_default_https_context = ssl._create_unverified_context

FF = r'C:\Users\irsha\Desktop\loopmates-claude\flim-copy\tools\bin\ffmpeg.exe'
SRC_MP3 = r'C:\Users\irsha\Downloads\ElevenLabs_2026-11-12T11_33_28_Lyan - Female Genuine Casual Ads_pvc_s50_sim75_v4.mp3'
OUT_DIR = r'C:\Users\irsha\Desktop\loopmates-claude\flim-copy\audio\vo'
os.makedirs(OUT_DIR, exist_ok=True)

# 1. Convert MP3 to 16kHz mono WAV for aligner and 48kHz WAV
wav16 = os.path.join(OUT_DIR, '_temp16.wav')
subprocess.run([FF, '-y', '-i', SRC_MP3, '-ar', '16000', '-ac', '1', wav16], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# Copy the original MP3 to vo.mp3 in OUT_DIR
shutil_copy = True
with open(SRC_MP3, 'rb') as f_in, open(os.path.join(OUT_DIR, 'vo.mp3'), 'wb') as f_out:
    f_out.write(f_in.read())

bundle = torchaudio.pipelines.MMS_FA
model = bundle.get_model()
tokenizer = bundle.get_tokenizer()
aligner = bundle.get_aligner()

# SCRIPT TEXT (Canonical words spoken)
# Notice in audio she says:
# "It's 2 a.m. My AI agent is working. Not on my computer. Somewhere in the cloud. With my passwords. On a model I don't control. And the bill? Two hundred dollars. Every month."
# "I didn't want another assistant. I wanted a second brain. So, we built Loopmates. Nineteen Mates. One computer. Mine. Each one a brain of its own. With a name, a voice, and a skill."
# "I say it once. 'Add dark mode. Run the tests.' Planner breaks it down. Research finds the way. Code makes the changes. Ops checks the build. Tests green. Nice. I wasn't even in the loop."
# "Something risky? Halo asks first. I approve. Done."
# "What did I decide last week? Mimo remembers. 'Shorter, please.' Said once. Remembered."
# "It's 11 p.m. The garage is still open. Mimo calls my phone. 'Close it?' Yes. Lights off, too."
# "My models. My keys. My machine. By morning, the work is done. The summary's waiting."
# "Loopmates. Working while I don't."
# "Oh, and the subscription? There isn't one."

script_tokens = [
    # Act 1
    "It's", "two", "am",
    "My", "AI", "agent", "is", "working",
    "Not", "on", "my", "computer",
    "Somewhere", "in", "the", "cloud",
    "With", "my", "passwords",
    "On", "a", "model", "I", "don't", "control",
    "And", "the", "bill",
    "Two", "hundred", "dollars",
    "Every", "month",
    
    # Act 2
    "I", "didn't", "want", "another", "assistant",
    "I", "wanted", "a", "second", "brain",
    "So", "we", "built", "Loopmates",
    "Nineteen", "Mates",
    "One", "computer",
    "Mine",
    "Each", "one", "a", "brain", "of", "its", "own",
    "With", "a", "name", "a", "voice", "and", "a", "skill",
    
    # Act 3
    "I", "say", "it", "once",
    "Add", "dark", "mode",
    "Run", "the", "tests",
    "Planner", "breaks", "it", "down",
    "Research", "finds", "the", "way",
    "Code", "makes", "the", "changes",
    "Ops", "checks", "the", "build",
    "Tests", "green",
    "Nice",
    "I", "wasn't", "even", "in", "the", "loop",
    
    # Confirmation
    "Something", "risky",
    "Halo", "asks", "first",
    "I", "approve",
    "Done",
    
    # Memory
    "What", "did", "I", "decide", "last", "week",
    "Mimo", "remembers",
    "Shorter", "please",
    "Said", "once",
    "Remembered",
    
    # Bedside / Phone call
    "It's", "eleven", "pm",
    "The", "garage", "is", "still", "open",
    "Mimo", "calls", "my", "phone",
    "Close", "it",
    "Yes",
    "Lights", "off", "too",
    
    # Ownership
    "My", "models",
    "My", "keys",
    "My", "machine",
    
    # Morning
    "By", "morning",
    "The", "work", "is", "done",
    "The", "summary's", "waiting",
    
    # Close
    "Loopmates",
    "Working", "while", "I", "don't",
    "Oh", "and", "the", "subscription",
    "There", "isn't", "one"
]

def clean_word(w):
    w = w.lower()
    w = re.sub(r"[^a-z']", "", w)
    return w

norm_words = [clean_word(w) for w in script_tokens]
tokens = tokenizer(norm_words)

waveform, sr = torchaudio.load(wav16)
with torch.inference_mode():
    emission, _ = model(waveform)

spans = aligner(emission[0], tokens)
ratio = waveform.size(1) / (emission.size(1) * sr)

result_words = []
for orig, clean, sp in zip(script_tokens, norm_words, spans):
    t0 = round(sp[0].start * ratio, 3)
    t1 = round(sp[-1].end * ratio, 3)
    result_words.append({"word": orig, "start": t0, "end": t1})

out_json = os.path.join(OUT_DIR, 'vo.words.json')
with open(out_json, 'w', encoding='utf-8') as f:
    json.dump(result_words, f, indent=1)

print(f"Aligned {len(result_words)} words to {out_json}")
print(f"First word: {result_words[0]}")
print(f"Last word: {result_words[-1]}")

if os.path.exists(wav16):
    os.remove(wav16)

