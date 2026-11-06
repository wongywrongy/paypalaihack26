// The cold open: the result before the explanation. The bag, its price rolling from what PayPal held to what was
// charged, then the shops whose agents did the haggling. Every value is the run's.
import { interpolate } from 'remotion';
import { money, SHOP_NAMES, SHORT_NAMES } from '../schema.ts';
import { C, manifest, MONO } from '../theme.ts';
import { clamp, ease, enter, MOTION_FPS, pop, rise, smooth, useFrame } from '../motion.ts';
import { glass, Odometer, Sfx, Shimmer } from '../ui/glass.tsx';
import { Photo } from '../ui.tsx';
import type { Laid } from '../timeline.ts';
import { wordAt } from '../plan.ts';

type Shop = keyof typeof SHOP_NAMES;
const start = manifest.events.find(row => row.kind === 'start')!;
const items: string[] = start.items;
const shops = [...new Set(Object.values(start.shops as Record<string, Shop[]>).flat())];
const { held_minor: held, charged_minor: charged } = manifest.run;
const cash = (value: number) => money(value, manifest.run.currency);

// Behind the rolling price, a few real bids flick past: each shop's first and last price for the item all of them sold.
const bids = manifest.events.filter(row => row.kind === 'bid');
const shared = items.find(id => bids.filter(row => id in row.items).length && shops.every(shop => bids.some(row => row.shop === shop && id in row.items))) ?? items[0];
const FLICKS = shops.flatMap(shop => {
  const own = bids.filter(row => row.shop === shop && shared in row.items);
  return own.length ? [...new Set([own[0], own[own.length - 1]])].map(row => ({ shop, price: row.items[shared] as number })) : [];
});

export function Cold({ laid }: { laid: Laid }) {
  const frame = useFrame(), fps = MOTION_FPS;
  const c1 = Math.round(wordAt(laid, 1, 'AI') * fps), line2 = Math.round((laid.cues[1] ?? laid.cues[0]).start * fps - laid.start * fps);
  // On the second line the result moves up to make room for the shops.
  const lift = ease(interpolate(frame, [line2, line2 + 12], [0, 1], clamp));
  // The roll starts on the first word and lands well before the line ends, so "saved" is already true on screen.
  const roll = smooth(interpolate(frame, [8, 8 + 1.4 * fps], [0, 1], clamp)), landed = 8 + Math.round(1.4 * fps);
  return <>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 170, display: 'flex', justifyContent: 'center', gap: 26, transform: `translateY(${-90 * lift}px) scale(${1 - 0.35 * lift})` }}>
      {items.map((id, i) => <div key={id} style={{ ...rise(enter(frame, fps, i * 3), 18) }}><Photo id={id} size={150} /></div>)}
    </div>
    {FLICKS.map((flick, i) => {
      const from = 8 + i * 4, p = (frame - from) / 20;
      if (p < 0 || p > 1) return null;
      return <div key={i} style={{ position: 'absolute', left: 1500 - 1100 * p, top: 430 + (i % 3) * 90, opacity: 0.3 * Math.sin(Math.PI * p), padding: '10px 22px', borderRadius: 999, ...glass, fontSize: 34, whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 700 }}>{SHORT_NAMES[flick.shop]}</span> <span style={{ fontFamily: MONO }}>{cash(flick.price)}</span>
      </div>;
    })}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transform: `translateY(${-150 * lift}px)` }}>
      <div style={{ fontFamily: MONO, fontSize: 40, color: C.muted, textDecoration: frame >= landed ? 'line-through' : undefined, ...rise(enter(frame, fps, 4), 10) }}>PayPal held {cash(held)}</div>
      <div style={{ fontSize: 200, lineHeight: 1, color: frame >= landed ? C.saving : C.ink }}>
        <Shimmer at={landed}><Odometer cents={held - (held - charged) * roll} digits={String(held).length} /></Shimmer>
      </div>
      {/* The saving the first line says, on screen as it is said. */}
      {held > charged && frame >= landed && <div style={{ fontSize: 44, fontWeight: 800, color: C.saving, ...rise(enter(frame, fps, landed), 10) }}>You saved {cash(held - charged)}</div>}
    </div>
    {/* The haggling, named: each shop arrives with its agent on the second line. */}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 660, display: 'flex', justifyContent: 'center', gap: 28 }}>
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
