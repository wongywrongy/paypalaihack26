// The cold open: the result before the explanation. The bag, its price rolling from what PayPal held to what was
// charged, then the shops whose agents did the haggling. Every value is the run's.
import { interpolate } from 'remotion';
import { money, SHOP_NAMES } from '../schema.ts';
import { C, manifest, MONO } from '../theme.ts';
import { clamp, enter, MOTION_FPS, pop, rise, smooth, useFrame } from '../motion.ts';
import { glass, Odometer, Sfx, Shimmer } from '../ui/glass.tsx';
import { Photo } from '../ui.tsx';
import type { Laid } from '../timeline.ts';

type Shop = keyof typeof SHOP_NAMES;
const start = manifest.events.find(row => row.kind === 'start')!;
const items: string[] = start.items;
const shops = [...new Set(Object.values(start.shops as Record<string, Shop[]>).flat())];
const { held_minor: held, charged_minor: charged } = manifest.run;
const cash = (value: number) => money(value, manifest.run.currency);
const cue = (laid: Laid, i: number) => (laid.cues[i] ?? laid.cues[laid.cues.length - 1]).start - laid.start;

export function Cold({ laid }: { laid: Laid }) {
  const frame = useFrame(), fps = MOTION_FPS;
  const c1 = Math.round(cue(laid, 1) * fps);
  // The roll starts on the first word and lands well before the line ends, so "saved" is already true on screen.
  const roll = smooth(interpolate(frame, [8, 8 + 1.4 * fps], [0, 1], clamp)), landed = 8 + Math.round(1.4 * fps);
  return <>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 170, display: 'flex', justifyContent: 'center', gap: 26 }}>
      {items.map((id, i) => <div key={id} style={{ ...rise(enter(frame, fps, i * 3), 18) }}><Photo id={id} size={150} /></div>)}
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ fontFamily: MONO, fontSize: 40, color: C.muted, textDecoration: frame >= landed ? 'line-through' : undefined, ...rise(enter(frame, fps, 4), 10) }}>PayPal held {cash(held)}</div>
      <div style={{ fontSize: 200, lineHeight: 1, color: frame >= landed ? C.saving : C.ink }}>
        <Shimmer at={landed}><Odometer cents={held - (held - charged) * roll} digits={String(held).length} /></Shimmer>
      </div>
      {/* The saving the first line says, on screen as it is said. */}
      {held > charged && frame >= landed && <div style={{ fontSize: 44, fontWeight: 800, color: C.saving, ...rise(enter(frame, fps, landed), 10) }}>You saved {cash(held - charged)}</div>}
    </div>
    {/* The haggling, named: each shop arrives with its agent on the second line. */}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 760, display: 'flex', justifyContent: 'center', gap: 28 }}>
      {shops.map((shop, i) => {
        const from = c1 + i * 4, p = Math.min(1.05, pop(frame, fps, from));
        if (frame < from) return null;
        return <div key={shop} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 28px', borderRadius: 999, ...glass, transform: `scale(${p})` }}>
          <Sfx at={from} kind="tick" />
          <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-.015em' }}>{SHOP_NAMES[shop]}</span>
          <span style={{ fontSize: 24, fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: C.butter, color: C.onLight }}>AI agent</span>
        </div>;
      })}
    </div>
  </>;
}
