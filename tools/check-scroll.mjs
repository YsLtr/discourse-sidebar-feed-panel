import { spawnSync } from 'node:child_process';
import { buildScrollFixture } from './build-scroll-fixture.mjs';

const fixture = await buildScrollFixture({ fullCss: process.argv.includes('--full-css') });
const result = spawnSync(process.env.PYTHON || 'python', [
  'tools/check-scroll-isolation.py', '--fixture', fixture, ...process.argv.slice(2).filter(a => a !== '--full-css'),
], { stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
