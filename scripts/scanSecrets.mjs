import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const skipExtensions = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.pdf', '.zip', '.gz', '.mp4', '.mp3',
  '.woff', '.woff2', '.ttf', '.eot', '.lock',
]);

const skipFiles = new Set([
  '.env.example',
  'scripts/scanSecrets.mjs',
]);

const patterns = [
  { name: 'Google API key', regex: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'OpenAI-style key', regex: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: 'AWS access key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub PAT', regex: /\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,})\b/ },
  { name: 'Private key block', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Google service account private key field', regex: /"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----/ },
  { name: 'Stripe secret key', regex: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { name: 'Stripe webhook secret', regex: /\bwhsec_[A-Za-z0-9]{20,}\b/ },
];

function listFiles() {
  const output = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' });
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

function shouldSkip(filePath) {
  if (skipFiles.has(filePath)) return true;
  const extension = extname(filePath).toLowerCase();
  return skipExtensions.has(extension);
}

const findings = [];
for (const filePath of listFiles()) {
  if (shouldSkip(filePath)) continue;

  let content = '';
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    continue;
  }

  const lines = content.split('\n');
  for (const { name, regex } of patterns) {
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      if (regex.test(lines[lineIndex])) {
        findings.push({
          filePath,
          line: lineIndex + 1,
          name,
        });
      }
    }
  }
}

if (findings.length > 0) {
  console.error('Potential secrets detected:');
  for (const finding of findings) {
    console.error(`- ${finding.filePath}:${finding.line} [${finding.name}]`);
  }
  process.exit(1);
}

console.log('No high-risk secret patterns detected in tracked/unignored files.');
