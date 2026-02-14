import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && full.endsWith('.js')) fixFile(full);
  }
}

function fixFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = src.replace(/from\s+"(\.\.?(?:\/[^"./][^"/]*)*\/[^".]+)"/g, 'from "$1.js"')
    .replace(/from\s+"(\.\.?(?:\/[^"']+)*)"/g, (m,p)=> {
      if (p.endsWith('.js') || p.endsWith('.json') || p.endsWith('.mjs') || p.endsWith('.cjs')) return m;
      return `from "${p}.js"`;
    });
  if (out !== src) fs.writeFileSync(file, out);
}

walk('.test-dist');
