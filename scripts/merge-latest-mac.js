// Merge the latest-mac.yml files written by the arm64 and x64 build jobs.
// Each job only knows its own architecture, and both upload under the same
// name, so whichever finishes last would otherwise hide the other build from
// electron-updater. The updater picks the arm64 or non-arm64 entry from
// `files` by its URL; the top-level `path` stays on the x64 zip for older
// clients that read only that field.
//
// Usage: node scripts/merge-latest-mac.js <x64.yml> <arm64.yml> <out.yml>

const fs = require('fs');

function parse(file) {
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trimEnd().split('\n');
  const start = lines.indexOf('files:');
  if (start === -1) throw new Error(`${file}: no files: block`);
  let end = start + 1;
  while (end < lines.length && /^\s/.test(lines[end])) end += 1;
  const version = lines.find((line) => line.startsWith('version: '));
  if (!version) throw new Error(`${file}: no version`);
  return { lines, start, end, version, files: lines.slice(start + 1, end) };
}

const [x64File, arm64File, outFile] = process.argv.slice(2);
if (!outFile) {
  console.error('usage: merge-latest-mac.js <x64.yml> <arm64.yml> <out.yml>');
  process.exit(1);
}

const x64 = parse(x64File);
const arm64 = parse(arm64File);
if (x64.version !== arm64.version) {
  throw new Error(`version mismatch: ${x64.version} vs ${arm64.version}`);
}
const urls = (entry) => entry.files.filter((line) => line.includes('url: '));
if (urls(x64).some((line) => line.includes('arm64')) || !urls(arm64).every((line) => line.includes('arm64'))) {
  throw new Error('inputs are not one x64 and one arm64 latest-mac.yml');
}

const merged = [
  ...x64.lines.slice(0, x64.end),
  ...arm64.files,
  ...x64.lines.slice(x64.end),
];
fs.writeFileSync(outFile, `${merged.join('\n')}\n`);
console.log(fs.readFileSync(outFile, 'utf8'));
