import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export const placeholder = '00000000-0000-4000-8000-000000000000';
export function buildConfig(settings, environment = {}, production = false) {
  const databaseId = environment.CLOUDFLARE_D1_DATABASE_ID || settings.databaseId || placeholder;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId) || (production && databaseId === placeholder)) {
    throw new Error('Set your real D1 database UUID in deploy.config.json or CLOUDFLARE_D1_DATABASE_ID before deploying.');
  }
  for (const key of ['workerName', 'databaseName', 'bucketName']) {
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(settings[key] || '')) throw new Error('Invalid deployment name: ' + key);
  }
  return {
    name: settings.workerName, main: 'worker/index.ts', compatibility_date: '2026-05-15',
    compatibility_flags: ['nodejs_compat'], workers_dev: true,
    observability: { enabled: true },
    d1_databases: [{binding: 'DB', database_name: settings.databaseName, database_id: databaseId, migrations_dir: 'drizzle'}],
    r2_buckets: [{binding: 'BUCKET', bucket_name: settings.bucketName}],
  };
}
export function configure(production = false) {
  const settings = JSON.parse(readFileSync('deploy.config.json', 'utf8'));
  const config = buildConfig(settings, process.env, production);
  writeFileSync('wrangler.json', JSON.stringify(config, null, 2) + '\n');
  return config;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) configure(process.argv.includes('--production'));
