import { spawnSync } from 'node:child_process';
import { configure } from './configure.mjs';
configure(true);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const args of [['run','typecheck'], ['test'], ['run','build'], ['run','db:remote']]) {
  const result = spawnSync(npm, args, {stdio:'inherit', shell:process.platform === 'win32'});
  if (result.status !== 0) process.exit(result.status || 1);
}
const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js','deploy','--config','dist/server/wrangler.json'], {stdio:'inherit'});
process.exit(result.status || 0);
