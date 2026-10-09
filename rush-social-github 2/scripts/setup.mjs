import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { buildConfig } from './configure.mjs';
const settings = JSON.parse(readFileSync('deploy.config.json', 'utf8'));
const prompt = createInterface({input: stdin, output: stdout});
try {
  console.log('First create a Cloudflare D1 database and R2 bucket. See START-HERE.md.');
  for (const key of ['workerName', 'databaseName', 'bucketName', 'databaseId']) {
    const answer = (await prompt.question(`${key} [${settings[key] || 'required'}]: `)).trim();
    if (answer) settings[key] = answer;
  }
  buildConfig(settings, {}, true);
  writeFileSync('deploy.config.json', JSON.stringify(settings, null, 2) + '\n');
  console.log('Saved. Run npx wrangler login, then npm run deploy.');
} finally { prompt.close(); }
