import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const src = path.resolve(cwd, '..', 'tiizi_revamp_screens');
const out = path.resolve(cwd, 'public', 'screen-layouts');
const dataOut = path.resolve(cwd, 'src', 'data', 'screenLayouts.json');

const entries = [];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
  }

  const htmlFile = path.join(dir, 'code.html');
  const pngFile = path.join(dir, 'screen.png');
  if (!fs.existsSync(htmlFile) && !fs.existsSync(pngFile)) return;

  const rel = path.relative(src, dir).replaceAll('\\', '/');
  const slug = rel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const dest = path.join(out, slug);

  fs.mkdirSync(dest, { recursive: true });
  let hasHtml = false;
  if (fs.existsSync(htmlFile)) {
    fs.copyFileSync(htmlFile, path.join(dest, 'code.html'));
    hasHtml = true;
  }

  const hasPreview = fs.existsSync(pngFile);
  if (hasPreview) {
    fs.copyFileSync(pngFile, path.join(dest, 'screen.png'));
  }

  if (!hasHtml && hasPreview) {
    fs.writeFileSync(
      path.join(dest, 'code.html'),
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${slug}</title><style>html,body{margin:0;padding:0;background:#f8fafc}img{display:block;width:100%;height:auto;max-width:480px;margin:0 auto}</style></head><body><img src="./screen.png" alt="${slug}"></body></html>`,
    );
    hasHtml = true;
  }

  entries.push({
    slug,
    title: rel.replace(/[_:-]+/g, ' ').replace(/\s+/g, ' ').trim(),
    source: rel,
    hasPreview,
    hasHtml,
  });
}

walk(src);
entries.sort((a, b) => a.slug.localeCompare(b.slug));
fs.writeFileSync(dataOut, JSON.stringify(entries, null, 2));
console.log(`Synced ${entries.length} layouts to public/screen-layouts`);
