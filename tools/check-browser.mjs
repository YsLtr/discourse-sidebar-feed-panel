import { spawnSync } from 'node:child_process';

const result = spawnSync(process.env.PYTHON || 'python', [
  'tools/check-built-userscript.py', ...process.argv.slice(2),
], { stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
