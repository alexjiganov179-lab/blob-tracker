// Parses every inline <script> block in index.html and reports syntax errors.
// Reproducible replacement for the earlier ad-hoc temp checker.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf8');

const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let m, n = 0, errors = 0;
while ((m = re.exec(html)) !== null) {
  const code = m[1];
  if (!code.trim()) continue; // skip external-src / empty scripts
  n++;
  try {
    new vm.Script(code, { filename: 'inline-script-' + n });
    console.log('script #' + n + ': OK (' + code.split('\n').length + ' lines)');
  } catch (e) {
    errors++;
    console.log('script #' + n + ': SYNTAX ERROR -> ' + e.message);
  }
}
console.log('Checked ' + n + ' inline scripts; ' + errors + ' syntax error(s).');
process.exit(errors ? 1 : 0);
