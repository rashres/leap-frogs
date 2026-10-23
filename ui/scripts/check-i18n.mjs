// Lists English text used with `| t`, tr(), translate() or tk() that a language
// dictionary (src/app/core/i18n/dict/*.json) is missing, plus keys nothing uses.
// Run: npm run i18n:check   (exits 1 when anything is missing)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/app/', import.meta.url).pathname;
const dictDir = join(root, 'core/i18n/dict');

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|html)$/.test(name) && !name.endsWith('.spec.ts') && name !== 't.pipe.ts' ? [path] : [];
  });
}

const literal = String.raw`'((?:[^'\\]|\\.)*)'`;
const patterns = [
  new RegExp(literal + String.raw`\s*\|\s*t\b`, 'g'),
  new RegExp(String.raw`\b(?:tr|translate|tk)\(\s*` + literal, 'g'),
  // Route titles, and text inputs that are translated where they are shown.
  new RegExp(String.raw`\btitle: ` + literal, 'g'),
  /\b(?:heading|idleLabel)="([^"{}]+)"/g,
];

// `(a ? 'x' : 'y') | t` and `translate(a ? 'x' : 'y')`: every literal inside the brackets.
const group = String.raw`\(((?:[^()]|\([^()]*\))*)\)`;
const groups = [new RegExp(group + String.raw`\s*\|\s*t\b`, 'g'), new RegExp(String.raw`\b(?:tr|translate)` + group, 'g')];

const used = new Map();
const add = (raw, file) => {
  const key = raw.replace(/\\(.)/g, '$1');
  if (!key.trim()) return;
  if (!used.has(key)) used.set(key, file.slice(root.length));
};
for (const file of files(root)) {
  const text = readFileSync(file, 'utf8');
  for (const re of patterns) for (const m of text.matchAll(re)) add(m[1], file);
  for (const re of groups) {
    for (const m of text.matchAll(re)) {
      // Only the condition-style literals, not the placeholder values passed after the text.
      const head = m[1].split(/,\s*\{/)[0];
      for (const lit of head.matchAll(new RegExp(literal, 'g'))) {
        if (!/^(COMPLETE|PENDING|FAILED|CANCELLED|EXPIRED|LIMIT|MARKET|GTC|DAY|FROZEN|ACTIVE|ALL|1D|positive|negative|neutral|dark|summary|edit|follow|closed|gainers|losers|pond|table|tone|newest|all|day|week|month|pos|neg|neu)$/.test(lit[1])) add(lit[1], file);
      }
    }
  }
}

let missing = 0;
for (const name of readdirSync(dictDir).filter((n) => n.endsWith('.json')).sort()) {
  const dict = JSON.parse(readFileSync(join(dictDir, name), 'utf8'));
  const lacking = [...used.keys()].filter((k) => !(k in dict));
  const unused = Object.keys(dict).filter((k) => !used.has(k));
  missing += lacking.length;
  console.log(`${name}: ${Object.keys(dict).length} entries, ${lacking.length} missing, ${unused.length} unused`);
  for (const k of lacking) console.log(`  missing  ${JSON.stringify(k)}  (${used.get(k)})`);
  for (const k of unused) console.log(`  unused   ${JSON.stringify(k)}`);
}
console.log(`${used.size} strings in the code.`);
process.exit(missing ? 1 : 0);
