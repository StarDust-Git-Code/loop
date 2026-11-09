// Where the server keeps its files on the owner's computer.
//   Windows: %LOCALAPPDATA%\Loopmates      Linux/macOS: ~/.local/share/loopmates (or $XDG_DATA_HOME/loopmates)
// LOOPMATES_DATA overrides both (tests use a temp folder).
import { mkdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function base() {
  if (process.env.LOOPMATES_DATA) return resolve(process.env.LOOPMATES_DATA);
  if (process.platform === 'win32') return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Loopmates');
  return join(process.env.XDG_DATA_HOME || join(homedir() || tmpdir(), '.local', 'share'), 'loopmates');
}

export const dataDir = base();
/** A folder inside the data folder, created on first use. Always an absolute, resolved path. */
export function dir(...parts) {
  const p = resolve(dataDir, ...parts);
  mkdirSync(p, { recursive: true });
  return p;
}
