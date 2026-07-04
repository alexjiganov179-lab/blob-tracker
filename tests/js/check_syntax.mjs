// Parses inline <script> blocks in online-version/index.html and reports syntax errors.
// Handles classic scripts, module scripts with top-level await, and import maps.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', '..', 'online-version', 'index.html'), 'utf8');

function getAttr(attrs, name) {
  const re = new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  return attrs.match(re)?.[2]?.toLowerCase() || '';
}

const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m, n = 0, errors = 0;
while ((m = re.exec(html)) !== null) {
  const attrs = m[1] || '';
  const code = m[2];
  if (/\bsrc\s*=/.test(attrs) || !code.trim()) continue;

  n++;
  const type = getAttr(attrs, 'type');
  const label = type || 'classic';
  try {
    if (type === 'importmap') {
      JSON.parse(code);
    } else if (type === 'module') {
      // vm.Script is classic-script only; wrapping preserves syntax checking for
      // this project's small module snippets, including top-level await.
      new vm.Script('(async () => {\n' + code + '\n});', { filename: 'online-version-module-script-' + n });
    } else {
      new vm.Script(code, { filename: 'online-version-inline-script-' + n });
    }
    console.log('script #' + n + ' [' + label + ']: OK (' + code.split('\n').length + ' lines)');
  } catch (e) {
    errors++;
    console.log('script #' + n + ' [' + label + ']: SYNTAX ERROR -> ' + e.message);
  }
}
console.log('Checked ' + n + ' inline scripts; ' + errors + ' syntax error(s).');
process.exit(errors ? 1 : 0);
