// A stand-in for `codex exec --json` in the end-to-end test: writes the requested file, emits Codex-style JSONL events.
// Round 1 writes the wrong text on purpose when the goal says "wrong-first", so the supervisor's review loop is exercised.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2);
const out = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
if (args[0] === '--version') { console.log('codex-cli 0.0.0-fake'); process.exit(0); }
const cdIdx = args.indexOf('-C'); const cwd = cdIdx >= 0 ? args[cdIdx + 1] : process.cwd();
const resume = args[1] === 'resume' ? args[2] : '';
const prompt = args.at(-1);
const want = /hello from (\w+)/.exec(prompt)?.[0] ?? 'hello';
const marker = join(cwd, '.round');
const round = existsSync(marker) ? Number(readFileSync(marker, 'utf8')) + 1 : 1;
writeFileSync(marker, String(round));
out({ type: 'thread.started', thread_id: resume || 'thread-fake-1' });
out({ type: 'turn.started' });
mkdirSync(join(cwd, 'out'), { recursive: true });
const text = process.env.CODEX_FAKE_WRONG_FIRST === '1' && round === 1 ? 'oops' : want;
writeFileSync(join(cwd, 'out', 'hello.txt'), `${text}\n`);
out({ type: 'item.completed', item: { id: 'i1', type: 'file_change', changes: [{ path: 'out/hello.txt', kind: 'add' }] } });
out({ type: 'item.completed', item: { id: 'i2', type: 'agent_message', text: `Round ${round}: wrote out/hello.txt (${text})${resume ? ` resumed ${resume}` : ''}` } });
out({ type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } });
