// Validates the owner's inputs and writes what the Remotion bundle reads. Every npm script runs this first.
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFacts, crossCheck, finalCheck, OrderSchema, parse, ReceiptSchema, receiptCheck, RunSchema } from '../src/schema.ts';
import { CLIPS, FPS, layout, MAX_SECONDS, spokenText, toScript, toSrt, type ClipName } from '../src/timeline.ts';

type Probe = (path: string) => { width: number; height: number; seconds: number };

function ffprobe(path: string) {
  const bin = join(fileURLToPath(new URL('..', import.meta.url)), 'node_modules/.bin/remotion');
  const out = execFileSync(bin, ['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', path], { encoding: 'utf8' });
  const data = JSON.parse(out.slice(out.indexOf('{')));
  return { width: data.streams[0].width, height: data.streams[0].height, seconds: Number(data.format.duration) };
}

function readJson(path: string, label: string) {
  if (!existsSync(path)) throw new Error(`${label} is missing. The owner saves it from the genuine hosted run: see README.md, "Save the run data".`);
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { throw new Error(`${label} is not valid JSON: ${(error as Error).message}`); }
}

export function prepare(root: string, { allowPlaceholders = false, probe = ffprobe as Probe, music = process.env.MUSIC_PATH } = {}) {
  const repo = join(root, '..'), run_dir = join(root, 'run'), generated = join(root, 'public/generated');
  const run = parse(RunSchema, readJson(join(run_dir, 'run.json'), 'video/run/run.json'), 'video/run/run.json');
  const order = parse(OrderSchema, readJson(join(run_dir, 'order.json'), 'video/run/order.json'), 'video/run/order.json');
  const receipt = parse(ReceiptSchema, readJson(join(run_dir, 'receipt.json'), 'video/run/receipt.json'), 'video/run/receipt.json');
  crossCheck(run, order);
  receiptCheck(run, receipt);
  if (!allowPlaceholders) finalCheck(run, order);

  const catalog = JSON.parse(readFileSync(join(repo, 'design/scenario/scenario.json'), 'utf8')).catalog as { id: string; brand: string; name: string }[];
  const start = order.events.find(event => event.kind === 'start');
  const ids = start?.kind === 'start' ? start.items : [];
  const names = Object.fromEntries(ids.map(id => {
    const product = catalog.find(row => row.id === id);
    if (!product) throw new Error(`Product ${id} from order.json is not in design/scenario/scenario.json.`);
    return [id, product.name];
  }));

  const clips: Record<string, { frames: number } | null> = {};
  const missing: string[] = [];
  rmSync(generated, { recursive: true, force: true });
  mkdirSync(join(generated, 'clips'), { recursive: true });
  mkdirSync(join(generated, 'products'), { recursive: true });
  for (const name of Object.keys(CLIPS) as ClipName[]) {
    const path = join(run_dir, 'clips', `${name}.mp4`);
    if (!existsSync(path)) { clips[name] = null; missing.push(`${name}.mp4`); continue; }
    const { width, height, seconds } = probe(path);
    // A 1440×900 window, recorded at 1× or 2× pixel ratio. Rects stay in 1440×900 window pixels either way.
    if (!((width === 1440 && height === 900) || (width === 2880 && height === 1800))) throw new Error(`video/run/clips/${name}.mp4 is ${width}×${height}. It must be 1440×900 (or 2880×1800 at 2× pixel ratio).`);
    clips[name] = { frames: Math.round(seconds * FPS) };
    copyFileSync(path, join(generated, 'clips', `${name}.mp4`));
  }
  if (missing.length && !allowPlaceholders) throw new Error(`Placeholders cannot go in the final render. Missing from video/run/clips/:\n  ${missing.join('\n  ')}`);

  for (const id of ids) {
    const photo = join(repo, 'frontend/public/assets/products', `${id}.png`);
    if (!existsSync(photo)) throw new Error(`No product photo at frontend/public/assets/products/${id}.png.`);
    copyFileSync(photo, join(generated, 'products', `${id}.png`));
  }
  // Written by npm run voice: one WAV per line and its spoken length. Used only if it was made for these lines.
  const vars = buildFacts(run, order, receipt);
  const timing = join(run_dir, 'voiceover.json');
  const saved: { lines: { text: string; file: string; spoken: number }[] } | null = existsSync(timing) ? readJson(timing, 'video/run/voiceover.json') : null;
  const fresh = !!saved?.lines && JSON.stringify(saved.lines.map(line => line.text)) === JSON.stringify(spokenText(vars)) && saved.lines.every(line => existsSync(join(run_dir, 'voice', line.file)));
  const voice = fresh ? saved!.lines.map(line => line.file) : null, spoken = fresh ? saved!.lines.map(line => line.spoken) : null;
  if (voice) {
    mkdirSync(join(generated, 'voice'), { recursive: true });
    for (const file of voice) copyFileSync(join(run_dir, 'voice', file), join(generated, 'voice', file));
  }
  let musicFile: string | null = null;
  if (music) {
    if (!existsSync(music)) throw new Error(`MUSIC_PATH ${music} does not exist.`);
    musicFile = `music${extname(music)}`;
    cpSync(music, join(generated, musicFile));
  }

  const plan = layout(vars, spoken);
  if (plan.total > MAX_SECONDS) throw new Error(`The video runs ${plan.total.toFixed(1)} s. The limit is ${MAX_SECONDS} s.`);
  writeFileSync(join(root, 'script.md'), toScript(plan));
  const manifest = { run, events: order.events, vars, names, clips, voice, spoken, music: musicFile };
  mkdirSync(join(root, 'src/generated'), { recursive: true });
  writeFileSync(join(root, 'src/generated/manifest.json'), JSON.stringify(manifest, null, 1));
  mkdirSync(join(root, 'out'), { recursive: true });
  writeFileSync(join(root, 'out/captions.srt'), toSrt(plan));
  return { manifest, missing };
}

if (import.meta.main) {
  const allowPlaceholders = process.argv.includes('--allow-placeholders');
  try {
    const { missing, manifest } = prepare(fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, ''), { allowPlaceholders });
    if (missing.length) console.log(`${missing.length} clips are placeholders. npm run render will refuse them.`);
    if (!manifest.voice) console.log('No voice for these lines yet (npm run voice): timing uses estimates and the build has no narration.');
  } catch (error) {
    console.error(`\nCannot build the video.\n${(error as Error).message}\n`);
    process.exit(1);
  }
}
