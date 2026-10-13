import { useRef, type CSSProperties, type JSX, type PointerEvent } from 'react';
import './safe-stage.css';

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
};
const ASSETS = '/assets/safe/';
export function safeAsset(name: string): string {
  const bundled = (globalThis as typeof globalThis & { __VAULTSTEAD_ASSETS__?: Record<string, string> }).__VAULTSTEAD_ASSETS__;
  return bundled?.[name] ?? ASSETS + name;
}
const wrap = (n: number) => ((n % 41) + 41) % 41;
const step = 360 / 41;

/** Engraved 0–40 ring drawn over a photographed dial. The dark band hides the photo's baked, illegible numerals. */
function DialRing({ value, live = false }: { value: number; live?: boolean }): JSX.Element {
  return <>
    <circle r="46.5" fill="none" stroke="#161714" strokeOpacity=".68" strokeWidth="17" />
    <circle r="55.2" fill="none" stroke="#9c9585" strokeOpacity=".35" strokeWidth=".5" />
    <circle r="38.2" fill="none" stroke="#0c0d0b" strokeOpacity=".6" strokeWidth=".8" />
    {Array.from({ length: 41 }, (_, n) => {
      const major = n % 5 === 0 && n !== 40;
      const current = live && n === value;
      const near = live && Math.abs(wrap(n - value + 20) - 20) <= 2;
      return <g key={n} transform={`rotate(${-n * step})`}>
        <path d={`M0,-55 v${major ? 4.6 : 2.6}`} stroke={current ? '#e8dcc0' : '#a49c8b'} strokeWidth={major || current ? '.95' : '.6'} />
        {(current || (major && !near)) && <text y={current ? '-40.6' : '-41.6'} textAnchor="middle" fontSize={current ? 11 : 8.2} fontWeight={current ? 700 : 600} fill={current ? '#efe4c8' : live ? '#b4ab97' : '#9d9584'}>{n}</text>}
      </g>;
    })}
  </>;
}

/** Photographic plates only. No Three imports, lighting shaders, or primitive geometry. */
export function SafeStage({ kind, value, found, pins, locked, open, glow, loot = 'empty', onDial, className = '' }: SafeStageProps): JSX.Element {
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
  const style = { '--dial-angle': `${current.current.angle}deg`, '--signal': Math.max(0, Math.min(1, glow)) } as CSSProperties;
  const progress = Math.max(found, locked.length);
  const alt = `${open ? 'Open' : 'Closed'} antique charcoal iron ${kind === 'pad' ? 'keypad' : 'dial'} safe${open ? loot === 'gold' ? ', with one gold bar on the shelf' : loot === 'brass' ? ', with brass coins on the shelf' : ', with an empty dark shelf' : ''}`;

  return <div className={`safe-stage ${open ? 'is-open' : ''} ${className}`} style={style} data-kind={kind} data-loot={open ? loot : 'hidden'} aria-label={alt}>
    <div className="safe-photo-space">
    <img className="safe-room" src={safeAsset('room.webp')} alt={alt} draggable={false} fetchPriority="high" />
    <div className="safe-cavity" aria-hidden="true">
      <img src={safeAsset(`interior-${open ? loot : 'empty'}.webp`)} alt="" draggable={false} />
    </div>
    <div className="safe-door" aria-hidden="true">
      <div className="safe-door-front">
        <img className="safe-door-photo" src={safeAsset(`door-${kind}.webp`)} alt="" draggable={false} />
        {kind === 'dial' ? <>
          <div className="live-dial" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
            <svg className="dial-face" viewBox="-64 -64 128 128">
              <image href={safeAsset('dial-face.webp')} x="-64" y="-64" width="128" height="128" />
              <DialRing value={value} live />
            </svg>
          </div>
          <svg className="idle-dial" viewBox="-64 -64 128 128"><DialRing value={0} /></svg>
        </> : <div className="ember-readout">{value < 0 ? '−' : value}</div>}
      </div>
      <div className="safe-door-back"><img src={safeAsset('door-back.webp')} alt="" draggable={false} /></div>
      <div className="safe-door-thickness" style={{ backgroundImage: `linear-gradient(90deg, #0000, #0008 70%, #000c), url(${safeAsset(`door-${kind}.webp`)})` }} />
    </div>
    {kind === 'dial' && !open && onDial && <div className="dial-access" role="slider" aria-label="Live combination dial" aria-valuemin={0} aria-valuemax={40} aria-valuenow={value} aria-valuetext={`${value}. ${progress} of ${pins} numbers set.`} tabIndex={0} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onDial(wrap(value + 1), 1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onDial(wrap(value - 1), -1); }
    }} />}
    </div>
  </div>;
}
