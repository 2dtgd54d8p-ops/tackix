// postinstall patch for @keystatic/core@0.6.9
//
// Root cause (see commit/PR notes): Keystatic injects the collection slug as a
// subdirectory into asset (image/file) storage paths in BOTH the read path
// (parseEntry) and the write path (serializeEntryToFiles). Our `directory:
// 'public/uploads'` assets are stored FLAT (public/uploads/<file>), so:
//   1. parseEntry looks for public/uploads/<slug>/<file> -> not found -> asset = undefined
//      -> the field parses to null, AND the (non-existent) slug path is still added to
//         usedFiles/initialFiles.
//   2. On save, serialize(null) emits no extraFile, so that orphan slug path stays in
//      filesToDelete and GitHub rejects it:
//      "[GraphQL] A path was requested for deletion which does not exist".
//
// Fix: drop the slug-subdir injection on both read and write so asset storage paths
// are flat (directory/filename), consistent with the real files in the repo.
//
// This script is idempotent and needs no network. Set KEYSTATIC_PATCH_TARGET to a
// custom file path to test against a copy.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveTarget() {
  try {
    const req = createRequire(import.meta.url);
    const pkgJson = req.resolve('@keystatic/core/package.json');
    return path.join(path.dirname(pkgJson), 'dist', 'keystatic-core-ui.js');
  } catch {
    return path.resolve(__dirname, '..', 'node_modules', '@keystatic', 'core', 'dist', 'keystatic-core-ui.js');
  }
}

const target = process.env.KEYSTATIC_PATCH_TARGET || resolveTarget();

if (!existsSync(target)) {
  console.warn('[patch-keystatic] target not found, skipping:', target);
  process.exit(0);
}

// READ path (parseEntry): remove slug-subdir injection in the asset read path.
const READ_OLD = "${schema.directory ? `${schema.directory}${((_args$slug5 = args.slug) === null || _args$slug5 === void 0 ? void 0 : _args$slug5.slug) === undefined ? '' : `/${args.slug.slug}`}` : args.dirpath}/${filepath}";
const READ_NEW = "${schema.directory ? `${schema.directory}` : args.dirpath}/${filepath}";

// WRITE path (serializeEntryToFiles): remove slug-subdir injection in the extra-file path.
const WRITE_OLD = "${file.parent ? args.slug ? `${file.parent}/${args.slug.value}` : file.parent : args.basePath}/${file.path}";
const WRITE_NEW = "${file.parent ? file.parent : args.basePath}/${file.path}";

let src = readFileSync(target, 'utf8');
let changed = false;
let applied = 0;

if (src.includes(READ_OLD)) {
  src = src.replace(READ_OLD, READ_NEW);
  changed = true;
  applied++;
}
if (src.includes(WRITE_OLD)) {
  src = src.replace(WRITE_OLD, WRITE_NEW);
  changed = true;
  applied++;
}

const alreadyPatched = src.includes(READ_NEW) && src.includes(WRITE_NEW);

if (!changed && !alreadyPatched) {
  console.warn(
    '[patch-keystatic] WARNING: expected Keystatic 0.6.9 asset-path code not found. ' +
      'Patch was NOT applied. If you upgraded @keystatic/core, re-evaluate this patch.'
  );
  process.exit(0);
}

if (changed) {
  writeFileSync(target, src);
  console.log(`[patch-keystatic] applied ${applied} fix(es) to @keystatic/core (flat asset storage paths).`);
} else {
  console.log('[patch-keystatic] already patched, nothing to do.');
}
