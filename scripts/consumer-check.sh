#!/usr/bin/env bash
# Installs this package from git, pinned to one commit, into a new scratch
# project, the way a consumer installs it, and imports every export.
#
# Usage:
#   scripts/consumer-check.sh [<commit>]
#
# The commit defaults to this checkout's HEAD, and it must already be on
# GitHub. The scratch project depends on the package by the URL in
# package.json's repository field plus #<full sha>, and pins the package's
# own TS Nomad dependencies in its overrides to the specs this commit's
# package.json gives them, as the README asks a consumer to. It installs
# with npm, so npm clones the package and builds it through its prepare
# script, and the consumer runs no build of its own.
#
# After install the script checks that:
#   - the package's dist folder came with it, built from the pinned commit,
#   - the tree holds exactly one copy of each @tsnomad package,
#   - Node imports every entry of the exports map, and every runtime
#     export of each is defined,
#   - TypeScript, with NodeNext resolution, imports every export of each
#     entry by name, values and types, with no error.
#
# Git must be able to read this repository over HTTPS. npm fetches the
# package's TS Nomad dependencies from the registry.
#
# The scratch project goes in a new folder under $CONSUMER_CHECK_DIR
# (default: $TMPDIR/tsnomad-consumer-check), which the script leaves in
# place for reading. It exits 0 when every check passed, 1 when one
# failed, and 2 for a usage error.

set -u -o pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
ref="${1:-HEAD}"
if ! sha="$(git -C "$here" rev-parse --verify --quiet "$ref^{commit}")"; then
  echo "cannot resolve '$ref' to a commit in $here" >&2
  exit 2
fi

read -r name url < <(node -e '
  const pkg = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  console.log(pkg.name, pkg.repository.url);
' <(git -C "$here" show "$sha:package.json")) || { echo "cannot read package.json at $sha" >&2; exit 2; }

base="${CONSUMER_CHECK_DIR:-${TMPDIR:-/tmp}/tsnomad-consumer-check}"
mkdir -p "$base"
root="$(mktemp -d "$base/${name#@tsnomad/}-${sha:0:8}-XXXXXX")"
git -C "$here" show "$sha:package.json" >"$root/pinned-package.json"

node - "$root" "$name" "$url#$sha" <<'NODE'
const fs = require('fs');
const path = require('path');
const [root, name, spec] = process.argv.slice(2);
const pinned = JSON.parse(fs.readFileSync(path.join(root, 'pinned-package.json'), 'utf8'));
const overrides = {};
for (const [dep, depSpec] of Object.entries(pinned.dependencies || {})) {
  if (dep.startsWith('@tsnomad/')) overrides[dep] = depSpec;
}
const consumer = {
  name: 'consumer-check',
  private: true,
  type: 'module',
  dependencies: { [name]: spec },
  devDependencies: { '@types/node': pinned.devDependencies['@types/node'], typescript: pinned.devDependencies.typescript },
};
if (Object.keys(overrides).length > 0) consumer.overrides = overrides;
fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(consumer, null, 2) + '\n');
NODE

echo "$name at $sha"
echo "scratch project: $root"
cd "$root" || exit 2
if ! npm install --no-audit --no-fund >"$root/install.log" 2>&1; then
  echo "install: failed, see $root/install.log"
  tail -20 "$root/install.log"
  exit 1
fi
echo "install: ok"

failed=0
dir="node_modules/$name"
if [ -f "$dir/dist/index.js" ] && [ -f "$dir/dist/index.d.ts" ]; then
  echo "dist: built on install"
else
  echo "dist: missing from $dir"
  failed=1
fi
resolved="$(node -e '
  const lock = JSON.parse(require("fs").readFileSync("package-lock.json", "utf8"));
  console.log(lock.packages["node_modules/" + process.argv[1]].resolved);
' "$name")"
case "$resolved" in
  *"#$sha") echo "lockfile: $resolved" ;;
  *) echo "lockfile: $resolved is not at $sha"; failed=1 ;;
esac

if ! node - "$name" <<'NODE'
const fs = require('fs');
const path = require('path');
const copies = {};
(function walk(dir, depth) {
  if (depth > 12) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name === '@tsnomad') {
      for (const pkg of fs.readdirSync(full)) {
        (copies[`@tsnomad/${pkg}`] ||= []).push(path.join(full, pkg));
        walk(path.join(full, pkg), depth + 1);
      }
    } else {
      walk(full, depth + 1);
    }
  }
})('node_modules', 0);
let ok = true;
for (const [pkg, list] of Object.entries(copies).sort()) {
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  const resolved = lock.packages[list[0]]?.resolved ?? '?';
  console.log(`copies: ${pkg} ${list.length} (${resolved.replace(/^.*#/, '').slice(0, 12)})`);
  if (list.length !== 1) ok = false;
}
process.exit(ok ? 0 : 1);
NODE
then
  echo "copies: a TS Nomad package is installed more than once"
  failed=1
fi

# Every entry of the exports map, in Node and in TypeScript.
if ! node - "$name" <<'NODE'
const fs = require('fs');
const path = require('path');
const ts = require(path.resolve('node_modules/typescript'));
const name = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(path.join('node_modules', name, 'package.json'), 'utf8'));
const entries = Object.keys(pkg.exports).map((key) => (key === '.' ? name : `${name}${key.slice(1)}`));

// TypeScript: list each entry's exports through the compiler, then import
// every one of them by name in a file of its own and typecheck it.
const options = {
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  target: ts.ScriptTarget.ES2022,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  types: ['node'],
};
const probe = 'probe.ts';
fs.writeFileSync(probe, entries.map((e, i) => `import * as m${i} from '${e}';\nexport { m${i} };\n`).join(''));
let program = ts.createProgram([probe], options);
const checker = program.getTypeChecker();
const source = program.getSourceFile(probe);
const lines = [];
const runtime = {};
entries.forEach((entry, i) => {
  const decl = source.statements.find((s) => ts.isImportDeclaration(s) && s.moduleSpecifier.text === entry);
  const symbol = checker.getSymbolAtLocation(decl.moduleSpecifier);
  if (!symbol) throw new Error(`TypeScript cannot resolve ${entry}`);
  const all = checker.getExportsOfModule(symbol);
  const values = [];
  const types = [];
  for (const s of all) {
    const target = s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s;
    if (target.flags & ts.SymbolFlags.Value) values.push(s.name);
    else types.push(s.name);
  }
  runtime[entry] = values;
  const names = [...values, ...types.map((t) => `type ${t}`)];
  lines.push(`import { ${names.join(', ')} } from '${entry}';`);
  if (values.length) lines.push(`void [${values.join(', ')}];`);
  for (const t of types) lines.push(`export type Use_${i}_${t} = ${t}${typeArgs(all.find((s) => s.name === t))};`);
  console.log(`exports: ${entry} has ${values.length} values and ${types.length} types`);
});
function typeArgs(symbol) {
  const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const decl = (target.declarations || [])[0];
  const params = decl && decl.typeParameters ? decl.typeParameters : [];
  const required = params.filter((p) => !p.default).length;
  return required ? `<${Array(required).fill('any').join(', ')}>` : '';
}
fs.writeFileSync('every-export.ts', lines.join('\n') + '\n');
program = ts.createProgram(['every-export.ts'], options);
const diagnostics = ts.getPreEmitDiagnostics(program);
for (const d of diagnostics) console.log(`typescript: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
if (diagnostics.length) process.exit(1);
console.log('typescript: every export imports by name with no error');
fs.writeFileSync('runtime-exports.json', JSON.stringify(runtime, null, 2));
NODE
then
  echo "typescript: failed"
  failed=1
fi

if [ -f runtime-exports.json ] && ! node --input-type=module -e '
  import fs from "node:fs";
  const expected = JSON.parse(fs.readFileSync("runtime-exports.json", "utf8"));
  let ok = true;
  for (const [entry, names] of Object.entries(expected)) {
    const mod = await import(entry);
    const missing = names.filter((n) => mod[n] === undefined);
    const extra = Object.keys(mod).filter((n) => !names.includes(n));
    console.log(`node: ${entry} loads with ${Object.keys(mod).length} runtime exports`);
    if (missing.length) { ok = false; console.log(`node: ${entry} has no runtime value for ${missing.join(", ")}`); }
    if (extra.length) { ok = false; console.log(`node: ${entry} exports ${extra.join(", ")}, which its types do not name`); }
  }
  process.exit(ok ? 0 : 1);
'; then
  echo "node: failed"
  failed=1
fi

if [ "$failed" -eq 0 ]; then echo "consumer check: passed"; else echo "consumer check: failed"; fi
exit "$failed"
