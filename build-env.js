// this makes the password actually work
const fs = require('fs');
const path = require('path');

const outPath = path.join(process.cwd(), 'env.js'); // writes env.js to repo root (served as /env.js)
const pw = process.env.AUTH_PASSWORD || '';

const content = `// This file is generated at build-time. Do not commit secrets here.
window.__AUTH_PASSWORD__ = ${JSON.stringify(pw)};`;

try {
  fs.writeFileSync(outPath, content, { encoding: 'utf8', flag: 'w' });
  console.log('[build-env] env.js written to', outPath);
  if (!pw) {
    console.warn('[build-env] WARNING: process.env.AUTH_PASSWORD is empty. env.js contains an empty password placeholder.');
  }
  process.exit(0);
} catch (err) {
  console.error('[build-env] Failed to write env.js:', err);
  process.exit(1);
}
