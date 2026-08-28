import fs from 'node:fs';
const t = fs.readFileSync('.env', 'utf8');
for (const l of t.split(/\r?\n/)) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) {
    const key = m[1].trim();
    const trimmed = m[2].trim();
    console.log(JSON.stringify({
      raw: l,
      key,
      trimmed,
      startsQuote: trimmed.startsWith('"'),
      endsQuote: trimmed.endsWith('"'),
    }));
  }
}
