# source this: puts the local ffmpeg/ffprobe on PATH, points the renderer at Chrome, loads the ElevenLabs key (never printed)
export FILM="/c/Users/irsha/Desktop/loopmates-claude/film"
export SK="$HOME/.claude/skills/motionmaxxing"
export PATH="$FILM/tools/bin:$PATH"
export CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"
export PYTHONIOENCODING=utf-8
if [ -f "/c/Users/irsha/Desktop/loopmates-claude/loop/elevenlabs.key" ]; then
  export ELEVENLABS_API_KEY="$(tr -d '\r\n ' < /c/Users/irsha/Desktop/loopmates-claude/loop/elevenlabs.key)"
fi
