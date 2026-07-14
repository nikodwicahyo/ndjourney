import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let commitSha = process.env.VERCEL_GIT_COMMIT_SHA || '';
if (!commitSha) {
  try {
    commitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {}
}

const version = {
  buildTime: new Date().toISOString(),
  commitSha,
};

writeFileSync(
  join(root, 'public', 'version.json'),
  JSON.stringify(version, null, 2),
);
console.log(`[version] Generated public/version.json: ${JSON.stringify(version)}`);
