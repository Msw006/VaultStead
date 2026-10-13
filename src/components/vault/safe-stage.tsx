import { useRef, type CSSProperties, type JSX, type PointerEvent } from 'react';
import MODELS from './safe-models.json';
import './safe-stage.css';

export type SafeModel = 'practice' | 'street' | 'keypad' | 'heavy' | 'treasury' | 'vault' | 'royal';
export type SafeStageProps = {
  kind: 'dial' | 'pad';
  value: number;
  found: number;
  pins: number;
  locked: number[];
  open: boolean;
  glow: number;
  loot?: 'gold' | 'brass' | 'empty';
  onDial?: (value: number, dir: 1 | -1) => void;
  className?: string;
  /** Which photographed safe to show. Defaults to the steel dial safe or the green keypad safe. */
  model?: SafeModel;
};
type Geometry = {
  kind: 'dial' | 'pad'; door: number[]; round: boolean; hinge: number[]; loot: string[];
  dial?: number[]; dialHit?: number[]; ring?: RingName; idle?: number[]; readout?: number[];
};
const GEOMETRY = MODELS as Record<SafeModel, Geometry>;

const ASSETS = '/assets/safe/';
export function safeAsset(name: string): string {
  const bundled = (globalThis as typeof globalThis & { __VAULTSTEAD_ASSETS__?: Record<string, string> }).__VAULTSTEAD_ASSETS__;
  return bundled?.[name] ?? ASSETS + name;
}
export const SAFE_LOOKS: Record<SafeModel, string> = {
  practice: 'cream enamel cash box',
  street: 'antique charcoal iron safe',
  keypad: 'green cast-iron safe with a retrofit keypad',
  heavy: 'charcoal steel fire safe',
  treasury: 'black gun safe with a keypad',
  vault: 'round stainless bank vault door',
  royal: 'oxblood Victorian strongbox with gilt scrollwork',
};
const wrap = (n: number) => ((n % 41) + 41) % 41;
const step = 360 / 41;

/*
 * Printed 0–40 rings, in a viewBox where the photographed number disc has radius ≈ 62.8.
 * band: [radius, width, colour, opacity] hides the photo's baked, illegible graduations.
 */
type RingName = 'modern' | 'light' | 'gilt' | 'engraved';
type Ring = { band: [number, number, string, number]; tickR: number; tick: [number, number]; textR: number; font: number; curFont: number; colors: [string, string, string]; family: string; clip: string; rims?: boolean };
const RINGS: Record<RingName, Ring> = {
  modern: { band: [53, 18.6, '#0d0d0e', .94], tickR: 61.6, tick: [5.4, 3.2], textR: 46.4, font: 9.4, curFont: 12.5, colors: ['#ecebe6', '#dcdbd5', '#ffffff'], family: "'Helvetica Neue', Arial, sans-serif", clip: 'circle(49%)' },
  light: { band: [47, 31.6, '#0b0b0c', .95], tickR: 61.6, tick: [6, 3.6], textR: 50, font: 11, curFont: 14.5, colors: ['#efeee9', '#e2e1db', '#ffffff'], family: "'Helvetica Neue', Arial, sans-serif", clip: 'circle(49%)' },
  gilt: { band: [46.5, 32, '#0a0908', .95], tickR: 61.6, tick: [6, 3.6], textR: 49.5, font: 10.5, curFont: 14, colors: ['#d9b25c', '#d4ad57', '#f7dc90'], family: 'Georgia, serif', clip: 'circle(49%)' },
  engraved: { band: [46.5, 17, '#161714', .68], tickR: 55, tick: [4.6, 2.6], textR: 41.6, font: 8.2, curFont: 11, colors: ['#a49c8b', '#b4ab97', '#efe4c8'], family: 'Georgia, serif', clip: 'circle(50%)', rims: true },
};

function DialRing({ value, ring, live = true }: { value: number; ring: Ring; live?: boolean }): JSX.Element {
  const [tickColor, textColor, currentColor] = ring.colors;
  return <>
    <circle r={ring.band[0]} fill="none" stroke={ring.band[2]} strokeOpacity={ring.band[3]} strokeWidth={ring.band[1]} />
    {ring.rims && <>
      <circle r="55.2" fill="none" stroke="#9c9585" strokeOpacity=".35" strokeWidth=".5" />
      <circle r="38.2" fill="none" stroke="#0c0d0b" strokeOpacity=".6" strokeWidth=".8" />
    </>}
    {Array.from({ length: 41 }, (_, n) => {
      const major = n % 5 === 0 && n !== 40;
      const current = live && n === value;
      const near = live && Math.abs(wrap(n - value + 20) - 20) <= 2;
      return <g key={n} transform={`rotate(${-n * step})`}>
        <path d={`M0,-${ring.tickR} v${major || current ? ring.tick[0] : ring.tick[1]}`} stroke={current ? currentColor : tickColor} strokeOpacity={current || major ? 1 : .8} strokeWidth={major || current ? 1.3 : .8} />
        {(current || (major && !near)) && <text y={-(current ? ring.textR - 1 : ring.textR)} textAnchor="middle" fontFamily={ring.family} fontSize={current ? ring.curFont : ring.font} fontWeight={current ? 700 : 600} fill={current ? currentColor : live ? textColor : tickColor}>{n}</text>}
      </g>;
    })}
  </>;
}

const box = ([left, top, width, height]: number[]): CSSProperties => ({ left: `${left}%`, top: `${top}%`, width: `${width}%`, ...(height === undefined ? { aspectRatio: '1' } : { height: `${height}%` }) });

/*
 * Relief, measured on each door plate. Positions are % of the door: circle [centre x, centre y, diameter as % of width],
 * rect [left, top, width, height, corner radius %]. Depths are in cqw of the stage. thick: the door slab;
 * dial / idle / readout: the height the live disc, printed idle ring, or ember window sits at.
 */
type Part = { circle?: [number, number, number]; rect?: [number, number, number, number, number]; z: [number, number] };
type Relief = { thick: number; parts: Part[]; dial?: { z: number; grip: number; gripR: number }; idle?: number; readout?: number };
const ball = (x: number, y: number, d: number, z = .9): Part => ({ circle: [x, y, d], z: [0, z] });
const RELIEF: Record<SafeModel, Relief> = {
  practice: { thick: .9, parts: [{ circle: [43, 48.4, 44], z: [0, .35] }, { rect: [79, 31, 9, 40.4, 40], z: [0, 1.1] }], dial: { z: .35, grip: 1.2, gripR: 25 } },
  street: {
    thick: 1.5, dial: { z: .35, grip: .9, gripR: 22 }, idle: .35,
    parts: [{ circle: [21.6, 31.2, 24], z: [0, .35] }, { circle: [21.6, 69.9, 24], z: [0, .35] }, { circle: [21.6, 69.9, 10], z: [.35, 1.25] },
      ball(65, 52.9, 12, 1.3), ball(66, 31.8, 6.5), ball(66, 74, 6.5), ball(47.5, 43, 6.5), ball(83.6, 42.7, 6.5), ball(47.5, 64.5, 6.5), ball(83.6, 64.5, 6.5)],
  },
  keypad: { thick: 1.4, readout: .55, parts: [{ rect: [11, 20.9, 31.4, 48.3, 4], z: [0, .55] }, { rect: [52.4, 43.9, 35.6, 7, 40], z: [0, .9] }, { rect: [66, 31.7, 6.4, 31.9, 40], z: [0, .9] }, ball(69, 47.4, 11, 1.3)] },
  heavy: { thick: 2, parts: [{ circle: [53.4, 35.5, 27], z: [0, .35] }, { rect: [12, 32.4, 27, 7, 50], z: [0, 1] }], dial: { z: .35, grip: .9, gripR: 24 } },
  treasury: { thick: 2.2, readout: .5, parts: [{ rect: [13, 19.1, 24, 25.3, 5], z: [0, .5] }, ball(63.5, 40, 11, 1.3), ball(51.8, 29.8, 5, 1), ball(77.6, 29.8, 5, 1), ball(50.2, 49.4, 5, 1), ball(77.8, 49.4, 5, 1)] },
  vault: { thick: 4.5, readout: .6, parts: [{ rect: [20, 15, 29.4, 29, 5], z: [0, .6] }, { circle: [52, 51, 24], z: [0, .8] }, { circle: [52, 51, 12], z: [.8, 1.6] }] },
  royal: { thick: 1.6, parts: [{ circle: [49.4, 30, 51], z: [0, .35] }, { rect: [40, 51.7, 20, 15.9, 30], z: [0, .5] }], dial: { z: .35, grip: 1, gripR: 23 } },
};
/** Perspective distance, in cqw of the stage, so depth scales with the stage. */
const PERSPECTIVE = 130;
const LAYER_STEP = .14;

/**
 * Lift a door-plane box to depth z. The scale about the perspective origin cancels perspective, so the closed door still
 * shows the photograph exactly; the depth only appears once the door turns.
 */
function lift(geo: Geometry, [l, t, w, h]: number[], z: number): CSSProperties {
  const hx = (geo.hinge[0] - geo.door[0]) / geo.door[2] * 100, hy = (geo.hinge[1] - geo.door[1]) / geo.door[3] * 100;
  return { transform: `translateZ(${z}cqw) scale(${(PERSPECTIVE - z) / PERSPECTIVE})`, transformOrigin: `${(hx - l) / w * 100}% ${(hy - t) / h * 100}%` };
}
const crop = (src: string, [l, t, w, h]: number[]): CSSProperties => ({
  backgroundImage: `url(${src})`, backgroundSize: `${10000 / w}% ${10000 / h}%`,
  backgroundPosition: `${w < 100 ? l / (100 - w) * 100 : 0}% ${h < 100 ? t / (100 - h) * 100 : 0}%`,
});
/** Side layers darken toward the door; the top layer is the photograph itself. */
const shade = (i: number, n: number) => ({ filter: `brightness(calc(var(--door-light) * ${i === n ? 1 : .32 + .3 * i / n}))` });
function layers(from: number, to: number): number[] {
  const n = Math.max(1, Math.round((to - from) / LAYER_STEP));
  return Array.from({ length: n + 1 }, (_, i) => from + (to - from) * i / n);
}
function partBox(geo: Geometry, part: Part): { at: number[]; radius: string } {
  const aspect = geo.door[2] * 3 / (geo.door[3] * 2);
  if (part.circle) { const [x, y, d] = part.circle; return { at: [x - d / 2, y - d * aspect / 2, d, d * aspect], radius: '50%' }; }
  const [l, t, w, h, r] = part.rect!; return { at: [l, t, w, h], radius: `${r}%` };
}

/** Photographic plates only. No Three imports, lighting shaders, or primitive geometry. */
export function SafeStage({ kind, value, found, pins, locked, open, glow, loot = 'empty', onDial, className = '', model }: SafeStageProps): JSX.Element {
  const id: SafeModel = model ?? (kind === 'dial' ? 'heavy' : 'keypad');
  const geo = GEOMETRY[id];
  const ring = geo.ring ? RINGS[geo.ring] : RINGS.modern;
  const relief = RELIEF[id];
  const doorPhoto = safeAsset(`${id}-door.webp`);
  const squareBox = ([l, t, s]: number[]) => [l, t, s, s * geo.door[2] * 3 / (geo.door[3] * 2)];
  const dialBox = geo.dial && relief.dial ? squareBox(geo.dial) : null;
  const drag = useRef<{ x: number; value: number; steps: number } | null>(null);
  const current = useRef({ value, angle: value * step });
  const difference = wrap(value - current.current.value + 20) - 20;
  if (kind === 'dial' && difference !== 0) current.current = { value, angle: current.current.angle + difference * step };

  function pointerDown(e: PointerEvent<HTMLDivElement>) {
    if (open || !onDial || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, value, steps: 0 };
  }
  function pointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current || open || !onDial) return;
    const steps = Math.trunc((e.clientX - drag.current.x) / 4);
    if (steps !== drag.current.steps) {
      const movement = steps - drag.current.steps;
      const dir = movement > 0 ? 1 : -1;
      drag.current.steps = steps;
      const next = wrap(drag.current.value + steps);
      current.current = { value: next, angle: current.current.angle + movement * step };
      onDial(next, dir);
    }
  }
  const style = { '--dial-angle': `${current.current.angle}deg`, '--signal': Math.max(0, Math.min(1, glow)), '--hinge-x': `${geo.hinge[0]}%`, '--hinge-y': `${geo.hinge[1]}%` } as CSSProperties;
  const progress = Math.max(found, locked.length);
  const shown = geo.loot.includes(loot) ? loot : 'empty';
  const alt = `${open ? 'Open' : 'Closed'} ${SAFE_LOOKS[id]}${open ? shown === 'gold' ? ', with one gold bar inside' : shown === 'brass' ? ', with brass coins inside' : ', empty inside' : ''}`;
  const release = () => { drag.current = null; };

  return <div className={`safe-stage ${open ? 'is-open' : ''} ${geo.round ? 'is-round' : ''} ${className}`} style={style} data-kind={kind} data-model={id} data-loot={open ? shown : 'hidden'} aria-label={alt}>
    <div className="safe-photo-space" style={{ perspective: `${PERSPECTIVE}cqw` }}>
    <img className="safe-room" src={safeAsset(`${id}-room.webp`)} alt={alt} draggable={false} fetchPriority="high" />
    <div className="safe-cavity" style={box(geo.door)} aria-hidden="true">
      <img src={safeAsset(`${id}-${open ? shown : 'empty'}.webp`)} alt="" draggable={false} />
    </div>
    <div className="safe-door" style={{ ...box(geo.door), '--thick': `${relief.thick}cqw` } as CSSProperties} aria-hidden="true">
      <div className="safe-door-front">
        <img className="safe-door-photo" src={doorPhoto} alt="" draggable={false} />
        {relief.parts.map((part, p) => {
          const { at, radius } = partBox(geo, part);
          const zs = layers(...part.z);
          return zs.map((z, i) => <div key={`${p}-${i}`} className="relief-layer" style={{ ...box(at), ...lift(geo, at, z), ...crop(doorPhoto, at), ...shade(i, zs.length - 1), borderRadius: radius }} />);
        })}
        {kind === 'dial' && geo.dial && <>
          <div className="live-dial" style={{ ...box(geo.dial), ...(dialBox && lift(geo, dialBox, relief.dial!.z)) }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={release} onPointerCancel={release}>
            <svg className="dial-face" viewBox="-64 -64 128 128" style={{ clipPath: ring.clip }}>
              <image href={safeAsset(`${id}-dial.webp`)} x="-64" y="-64" width="128" height="128" />
              <DialRing value={value} ring={ring} />
            </svg>
          </div>
          {dialBox && (() => {
            const zs = layers(relief.dial!.z, relief.dial!.z + relief.dial!.grip);
            return zs.slice(1).map((z, i) => <div key={`grip-${i}`} className="relief-layer dial-grip" style={{ ...box(geo.dial!), ...lift(geo, dialBox, z), ...shade(i + 1, zs.length - 1), clipPath: `circle(${relief.dial!.gripR}%)` }}>
              <img src={safeAsset(`${id}-dial.webp`)} alt="" draggable={false} />
            </div>);
          })()}
          {geo.idle && <svg className="idle-dial" style={{ ...box(geo.idle), ...(relief.idle && lift(geo, squareBox(geo.idle), relief.idle)) }} viewBox="-64 -64 128 128"><DialRing value={0} ring={ring} live={false} /></svg>}
        </>}
        {kind === 'pad' && geo.readout && <div className="ember-readout" style={{ ...box(geo.readout), ...(relief.readout && lift(geo, geo.readout, relief.readout)) }}><span>{value < 0 ? '−' : value}</span></div>}
      </div>
      <div className="safe-door-back"><img src={safeAsset(`${id}-back.webp`)} alt="" draggable={false} /></div>
      {geo.round
        ? layers(-relief.thick, 0).slice(1, -1).map((z, i) => <div key={`slab-${i}`} className="slab-layer" style={{ transform: `translateZ(${z}cqw)`, backgroundImage: `url(${doorPhoto})` }} />)
        : ['left', 'right', 'top', 'bottom'].map(side => <div key={side} className={`slab-edge is-${side}`} style={{ backgroundImage: `linear-gradient(${side === 'left' || side === 'right' ? 90 : 180}deg, #0003, #000a), url(${doorPhoto})` }} />)}
    </div>
    {kind === 'dial' && geo.dialHit && !open && onDial && <div className="dial-access" style={box(geo.dialHit)} role="slider" aria-label="Live combination dial" aria-valuemin={0} aria-valuemax={40} aria-valuenow={value} aria-valuetext={`${value}. ${progress} of ${pins} numbers set.`} tabIndex={0} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={release} onPointerCancel={release} onKeyDown={e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onDial(wrap(value + 1), 1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onDial(wrap(value - 1), -1); }
    }} />}
    </div>
  </div>;
}
