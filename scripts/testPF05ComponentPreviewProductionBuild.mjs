import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function filesWithin(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesWithin(path) : [path];
  });
}

const previewRoute = '/preview/v2/challenge-creation';
const exposedFiles = filesWithin(fileURLToPath(new URL('../dist', import.meta.url)))
  .filter((path) => readFileSync(path, 'utf8').includes(previewRoute));

if (exposedFiles.length > 0) {
  console.error('PF-05 component preview leaked into the production build:');
  exposedFiles.forEach((path) => console.error(`  ${path}`));
  process.exitCode = 1;
} else {
  console.log('PF-05 component preview production-build guard: no preview route emitted.');
}
