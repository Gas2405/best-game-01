// VOIDSPARK's entry program (Node 22, standard library only). The game itself
// is the static site in game/ — plain files a desktop browser opens offline —
// and this program hands it in: it copies game/ and screenshots/ into the
// output directory and writes dossier.json, the summary the judge reads,
// using the vendored make.fun library so the bytes match the scorer's own.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly rather than hand in an empty shell if the game is missing.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing: there is no game to hand in');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps are the gate's own: at most 4 screenshots of 256 KiB, at most 993
// entries and 48 MiB under game/, no game path over 1,000 bytes, and the
// dossier's game text capped at 160 KiB.
const dossierPath = join(out, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`VOIDSPARK handed in: game/ and screenshots/ copied, dossier.json ${statSync(dossierPath).size} bytes`);
