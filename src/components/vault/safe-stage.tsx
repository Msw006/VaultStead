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

/** Photographic plates only. No Three imports, lighting shaders, or primitive geometry. */
export function SafeStage({ kind, value, found, pins, locked, open, glow, loot = 'empty', onDial, className = '', model }: SafeStageProps): JSX.Element {
  const id: SafeModel = model ?? (kind === 'dial' ? 'heavy' : 'keypad');
  const geo = GEOMETRY[id];
  const ring = geo.ring ? RINGS[geo.ring] : RINGS.modern;
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
    <div className="safe-photo-space">
    <img className="safe-room" src={safeAsset(`${id}-room.webp`)} alt={alt} draggable={false} fetchPriority="high" />
    <div className="safe-cavity" style={box(geo.door)} aria-hidden="true">
      <img src={safeAsset(`${id}-${open ? shown : 'empty'}.webp`)} alt="" draggable={false} />
    </div>
    <div className="safe-door" style={box(geo.door)} aria-hidden="true">
      <div className="safe-door-front">
        <img className="safe-door-photo" src={safeAsset(`${id}-door.webp`)} alt="" draggable={false} />
        {kind === 'dial' && geo.dial && <>
          <div className="live-dial" style={box(geo.dial)} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={release} onPointerCancel={release}>
            <svg className="dial-face" viewBox="-64 -64 128 128" style={{ clipPath: ring.clip }}>
              <image href={safeAsset(`${id}-dial.webp`)} x="-64" y="-64" width="128" height="128" />
              <DialRing value={value} ring={ring} />
            </svg>
          </div>
          {geo.idle && <svg className="idle-dial" style={box(geo.idle)} viewBox="-64 -64 128 128"><DialRing value={0} ring={ring} live={false} /></svg>}
        </>}
        {kind === 'pad' && geo.readout && <div className="ember-readout" style={box(geo.readout)}><span>{value < 0 ? '−' : value}</span></div>}
      </div>
      <div className="safe-door-back"><img src={safeAsset(`${id}-back.webp`)} alt="" draggable={false} /></div>
      {!geo.round && <div className="safe-door-thickness" style={{ backgroundImage: `linear-gradient(90deg, #0000, #0008 70%, #000c), url(${safeAsset(`${id}-door.webp`)})` }} />}
    </div>
    {kind === 'dial' && geo.dialHit && !open && onDial && <div className="dial-access" style={box(geo.dialHit)} role="slider" aria-label="Live combination dial" aria-valuemin={0} aria-valuemax={40} aria-valuenow={value} aria-valuetext={`${value}. ${progress} of ${pins} numbers set.`} tabIndex={0} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={release} onPointerCancel={release} onKeyDown={e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onDial(wrap(value + 1), 1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onDial(wrap(value - 1), -1); }
    }} />}
    </div>
  </div>;
}
