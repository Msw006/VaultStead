import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { SafeStage, safeAsset, SAFE_LOOKS } from './components/vault/safe-stage';
import { DOORS, TOOLS, SAVE_KEY, loadSave, makeRun, signal, wrap, setNumber, settle, purchase, toolFor, contact, press, expire, spendTool, abandon, exchange, stuck, rescue, GOLD_RATE, RESCUE_BRASS, CHEAPEST_DOOR } from './game.mjs';
import './style.css';

const storage = (() => {
  try { return window.localStorage; }
  catch { return { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); } }; }
})();

function Icon({ name, size = 20, ...rest }) {
  const paths = {
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
    ear: <><path d="M6 10a6 6 0 1 1 12 0c0 5-4 4-4 8a4 4 0 0 1-8 0M10 10a2 2 0 1 1 4 0c0 2-3 1-3 4"/></>,
    turn: <><path d="M19 8a8 8 0 1 0 1 8M19 3v6h-6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    minus: <path d="M5 12h14"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    sound: <><path d="m11 4-6 5H2v6h3l6 5V4m4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
    mute: <><path d="m11 4-6 5H2v6h3l6 5V4m5 5 6 6m-6 0 6-6"/></>,
    shop: <><path d="M4 9h16l-2-6H6L4 9Zm1 0v12h14V9M9 21v-7h6v7"/></>,
    book: <><path d="M4 4h12a3 3 0 0 1 3 3v14H7a3 3 0 0 1-3-3V4Zm0 14a3 3 0 0 1 3-3h12M8 7h7m-7 4h5"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.2.8-1.7 1.2-1.7 2.7m0 3h.01"/></>,
    shelf: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M8 6v3m8 6v3"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>{paths[name] || paths.lock}</svg>;
}
function Brand() { return <span className="brand"><span className="brand-mark"><Icon name="shelf" size={27}/></span><span>Vaultstead<span className="brand-caption">SAFE-CRACKING GAME</span></span></span>; }
function Coin({ gold = false }) { return <span className={gold ? 'gold-ingot' : 'brass-coin'} aria-hidden="true"/>; }
let audio, noiseBuffer, master;
function output() {
  if (!master) {
    master = audio.createDynamicsCompressor();
    master.threshold.value = -14; master.ratio.value = 6;
    master.connect(audio.destination);
  }
  return master;
}
function noise() {
  if (!noiseBuffer) {
    noiseBuffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = audio.createBufferSource();
  source.buffer = noiseBuffer; source.loop = true;
  return source;
}
function burst(t, frequency, length, level, q, type = 'bandpass') {
  const source = noise(), filter = audio.createBiquadFilter(), gain = audio.createGain();
  filter.type = type; filter.frequency.value = frequency; filter.Q.value = q;
  gain.gain.setValueAtTime(level, t); gain.gain.exponentialRampToValueAtTime(.0001, t + length);
  source.connect(filter); filter.connect(gain); gain.connect(output());
  source.start(t, Math.random() * .5); source.stop(t + length + .02);
}
function knock(t, from, to, length, level, type = 'sine') {
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  oscillator.type = type; oscillator.frequency.setValueAtTime(from, t); oscillator.frequency.exponentialRampToValueAtTime(to, t + length);
  gain.gain.setValueAtTime(level, t); gain.gain.exponentialRampToValueAtTime(.0001, t + length);
  oscillator.connect(gain); gain.connect(output());
  oscillator.start(t); oscillator.stop(t + length + .02);
}
/** A struck steel plate: a few inharmonic partials that ring and fade. */
function ring(t, base, length, level) {
  for (const [ratio, share] of [[1, 1], [2.76, .5], [5.4, .25], [8.93, .12]]) knock(t, base * ratio, base * ratio * .995, length / Math.sqrt(ratio), level * share);
}
/** A dry hinge: a buzzing saw tone that sticks and slips, filtered to sound like metal rubbing on metal. */
function creak(t, length, pitch, level) {
  const saw = audio.createOscillator(), wobble = audio.createOscillator(), wobbleDepth = audio.createGain();
  const stick = audio.createOscillator(), stickDepth = audio.createGain(), amp = audio.createGain();
  const body = audio.createBiquadFilter(), squeal = audio.createBiquadFilter(), envelope = audio.createGain();
  saw.type = 'sawtooth';
  saw.frequency.setValueAtTime(pitch, t);
  saw.frequency.linearRampToValueAtTime(pitch * 1.3, t + length * .45);
  saw.frequency.linearRampToValueAtTime(pitch * .85, t + length);
  wobble.frequency.value = 6.5; wobbleDepth.gain.value = pitch * .07;
  wobble.connect(wobbleDepth); wobbleDepth.connect(saw.frequency);
  stick.type = 'square'; stick.frequency.setValueAtTime(14, t); stick.frequency.linearRampToValueAtTime(22, t + length);
  stickDepth.gain.value = .45; amp.gain.value = .55;
  stick.connect(stickDepth); stickDepth.connect(amp.gain);
  body.type = 'bandpass'; body.frequency.value = 950; body.Q.value = 5;
  squeal.type = 'bandpass'; squeal.frequency.value = 2400; squeal.Q.value = 12;
  envelope.gain.setValueAtTime(.0001, t);
  envelope.gain.exponentialRampToValueAtTime(level, t + .12);
  envelope.gain.setValueAtTime(level, t + length * .6);
  envelope.gain.exponentialRampToValueAtTime(.0001, t + length);
  saw.connect(amp); amp.connect(body); amp.connect(squeal); body.connect(envelope); squeal.connect(envelope); envelope.connect(output());
  for (const node of [saw, wobble, stick]) { node.start(t); node.stop(t + length + .05); }
}
/** Bolts withdraw, the handle catches, the hinge creaks through the swing, and the door settles. `weight` runs from a light box (0.6) to a vault (1.6). */
function playOpen(weight) {
  const t = audio.currentTime;
  knock(t, 130 / weight, 45 / weight, .22 * weight, .45); burst(t, 600, .08, .5, 2); ring(t, 310 / weight, .5, .05);
  const bolts = Math.round(2 + weight * 2.5);
  for (let i = 0; i < bolts; i++) {
    const at = t + .14 + i * (.26 / bolts);
    burst(at, 2600, .025, .3, 9); knock(at, 420 / weight, 240 / weight, .05, .12);
  }
  // Matches the door's transition delay in safe-stage.css.
  const swing = t + .45;
  burst(swing, 1500, .03, .25, 6); burst(swing + .06, 1700, .03, .2, 6); ring(swing + .06, 520 / weight, .35, .03);
  creak(swing + .1, 1.5, 95 / Math.sqrt(weight), .08);
  burst(swing + .1, 220 / weight, 1.6, .18 * weight, .8, 'lowpass');
  knock(swing + 1.55, 85 / weight, 38 / weight, .35 * weight, .35); burst(swing + 1.55, 300, .12, .3, 1.5); ring(swing + 1.55, 240 / weight, .8, .04);
}
const DOOR_WEIGHT = { practice: .6, street: .9, keypad: .9, heavy: 1.1, treasury: 1.2, vault: 1.6, royal: 1 };
// tick: a plain step. dull: a tooth heard by ear, true or false alike. gate / decoy: the same teeth through a stethoscope.
const DIAL_SOUNDS = {
  tick: t => burst(t, 3400, .018, .12, 8),
  dull: t => burst(t, 2200, .035, .2, 5),
  gate: t => { knock(t, 170, 55, .14, .3); burst(t, 900, .05, .25, 3); },
  decoy: t => { burst(t, 1700, .03, .25, 4); knock(t, 560, 420, .05, .06, 'triangle'); },
  key: t => knock(t, 1250, 1250, .045, .025, 'square'),
};
function playTone(type, active, model) {
  if (!active) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    if (DIAL_SOUNDS[type]) { DIAL_SOUNDS[type](audio.currentTime); return; }
    if (type === 'open') { playOpen(DOOR_WEIGHT[model] ?? 1); return; }
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.connect(gain); gain.connect(output());
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(type === 'miss' ? 90 : type === 'pin' ? 880 : 440, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(65, audio.currentTime + .08);
    gain.gain.setValueAtTime(.025, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .1);
    oscillator.start(); oscillator.stop(audio.currentTime + .12);
  } catch { /* The game remains playable without audio. */ }
}
function readRun(save) {
  try {
    const saved = JSON.parse(storage.getItem(SAVE_KEY + '.run'));
    const door = DOORS.find(d => d.id === saved?.doorId);
    const extras = [null, 'stethoscope', 'probe'].includes(saved?.tool) && (saved.deadline === null || Number.isFinite(saved.deadline)) && (door?.kind === 'dial' ? saved.decoys?.length === door.pins : Array.isArray(saved?.worn));
    if (door && extras && saved.status === 'active' && (door.id === 'practice' || save.doors[door.id] > 0) && saved.targets?.length === door.pins && saved.targets.every(n => Number.isInteger(n) && n >= 0 && n <= (door.kind === 'dial' ? 40 : 9)) && Array.isArray(saved.locked) && saved.locked.length < door.pins && Number.isInteger(saved.misses) && saved.misses >= 0 && (saved.misses < 3 || door.id === 'practice') && Number.isInteger(saved.value) && saved.value >= (door.kind === 'pad' ? -1 : 0) && saved.value <= (door.kind === 'pad' ? 9 : 40) && [-1, 0, 1].includes(saved.dir)) return saved;
  } catch { /* fresh game */ }
  return makeRun(DOORS[save.doors.street ? 1 : save.doors.keypad ? 2 : 0]);
}

function ListeningMeter({ strength, kind, available }) {
  const phrase = !available ? 'No tool in use' : kind === 'pad' ? strength === 1 ? 'Correct digit!' : strength > .3 ? 'Close' : 'Far' : strength === 1 ? 'Correct number!' : strength > .7 ? 'Very close' : strength > .3 ? 'Close' : 'Far';
  return <div className={`listening ${strength === 1 && available ? 'is-aligned' : ''}`}>
    <div className="meter-label"><span><Icon name="ear" size={15}/>{kind === 'dial' ? 'STETHOSCOPE' : 'SIGNAL PROBE'}</span><span className="signal-light"/></div>
    <div className="meter-bars" role="meter" aria-label={kind === 'dial' ? 'Stethoscope meter' : 'Signal probe meter'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={available ? Math.round(strength * 100) : 0}>
      {Array.from({ length: 35 }, (_, i) => { const wave = Math.sin(i * 1.55) * .4 + Math.cos(i * .55) * .25 + .35; return <i key={i} style={{ height: `${available ? 5 + (Math.abs(wave) * 24 + 6) * strength : 5}px`, opacity: available ? .3 + strength * .7 : .2 }} />; })}
    </div>
    <div className="meter-caption"><span>{phrase}</span><span>{available && kind === 'dial' ? `${Math.round(strength * 100)}%` : ''}</span></div>
  </div>;
}
function Help({ close }) {
  return <div className="modal-cover" onClick={close}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}>
    <button className="icon-button modal-close" onClick={close} aria-label="Close"><Icon name="close"/></button>
    <span className="eyebrow">HELP</span><h2 id="help-title">How to play</h2>
    <p>Find the secret code to open each safe. Start with the Practice safe. It is free.</p>
    <ol>
      <li><strong>Choose a safe.</strong> Other safes need a door. Buy doors in the Shop. One door gives you one try.</li>
      <li><strong>Dial safes.</strong> Turn the dial in the direction of the arrow: right first, then left, then right again. On the correct number you hear a different, softer click. Then press Set number.</li>
      <li><strong>Fake clicks.</strong> The Heavy safe has 1 fake click on each number. The Royal safe has 2.</li>
      <li><strong>Keypad safes.</strong> The code uses the worn (dirty) keys. Some safes also have fake worn keys. Press a key, then press Enter digit.</li>
      <li><strong>Alarm.</strong> The Treasury safe and the Bank vault have a timer. It starts when you press the first key. If time runs out, you lose the door.</li>
      <li><strong>Tools.</strong> A stethoscope (dial safes) or a signal probe (keypad safes) helps on one safe. Then it is used up. On the Practice safe, tools are free.</li>
      <li><strong>Wrong tries.</strong> 3 wrong tries and you lose the door. Practice has no limit.</li>
      <li><strong>Rewards.</strong> Most safes give brass. Some give a gold bar. Harder safes have a higher chance of gold. In the Shop, you can exchange 1 gold bar for {GOLD_RATE} brass.</li>
      <li><strong>Out of brass?</strong> If you have no brass for a door, no doors, and no gold, you can get {RESCUE_BRASS} free brass.</li>
    </ol>
    <p className="fine-print">This game runs only in your browser. Gold bars are game rewards, not real money. Cash packs in the Shop are not for sale.</p>
    <button className="primary-button" onClick={close}>Start playing <Icon name="arrow" size={16}/></button>
  </section></div>;
}
function ConfirmExchange({ bars, save, cancel, confirm }) {
  return <div className="modal-cover" onClick={cancel}><section className="help-modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={e => e.stopPropagation()}>
    <span className="eyebrow">PLEASE CONFIRM</span>
    <h2 id="confirm-title">Exchange {bars} gold bar{bars === 1 ? '' : 's'}?</h2>
    <p>You get {bars * GOLD_RATE} brass. You cannot change it back.</p>
    <dl className="confirm-sums"><div><dt>Gold bars</dt><dd>{save.gold} → {save.gold - bars}</dd></div><div><dt>Brass</dt><dd>{save.brass} → {save.brass + bars * GOLD_RATE}</dd></div></dl>
    <div className="confirm-actions"><button className="secondary-button" onClick={cancel}>Cancel</button><button className="primary-button" onClick={confirm} autoFocus>Exchange for {bars * GOLD_RATE} brass</button></div>
  </section></div>;
}
/** Shown when the player cannot afford a door and owns none. */
function MoneyHelp({ save, onRescue, toShop }) {
  const noDoors = DOORS.every(d => !d.cost || save.doors[d.id] === 0);
  if (!noDoors || save.brass >= CHEAPEST_DOOR) return null;
  if (stuck(save)) return <div className="money-help"><Icon name="help" size={18}/><span><strong>You are out of brass and doors.</strong> Take {RESCUE_BRASS} free brass to keep playing.</span><button className="primary-button" onClick={onRescue}>Get {RESCUE_BRASS} free brass</button></div>;
  return <div className="money-help"><Icon name="help" size={18}/><span><strong>Not enough brass for a door.</strong> You can exchange your gold bars for brass. 1 gold bar = {GOLD_RATE} brass.</span>{toShop && <button className="primary-button" onClick={toShop}>Exchange gold</button>}</div>;
}
function ConfirmBuy({ item, category, brass, cancel, confirm }) {
  return <div className="modal-cover" onClick={cancel}><section className="help-modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={e => e.stopPropagation()}>
    <span className="eyebrow">PLEASE CONFIRM</span>
    <h2 id="confirm-title">{category === 'tool' ? `Buy a ${item.name.toLowerCase()}?` : `Buy a door for the ${item.name}?`}</h2>
    <p>{category === 'tool' ? 'It works on one safe. Then it is used up.' : 'One door gives you one try at this safe.'}</p>
    <dl className="confirm-sums"><div><dt>Price</dt><dd>{item.cost} brass</dd></div><div><dt>You have</dt><dd>{brass} brass</dd></div><div><dt>After buying</dt><dd>{brass - item.cost} brass</dd></div></dl>
    <div className="confirm-actions"><button className="secondary-button" onClick={cancel}>Cancel</button><button className="primary-button" onClick={confirm} autoFocus>Buy for {item.cost} brass</button></div>
  </section></div>;
}
const priceLabel = (action, cost, brass) => brass >= cost ? <>{action} <span><Coin/>{cost}</span></> : <>Need {cost - brass} more brass <span><Coin/>{cost}</span></>;

function App() {
  const [save, setSave] = useState(() => loadSave(storage));
  const [run, setRun] = useState(() => readRun(save));
  const [view, setView] = useState('workshop');
  const [help, setHelp] = useState(false);
  const [sound, setSound] = useState(true);
  const [notice, setNotice] = useState('');
  const [durable, setDurable] = useState(true);
  const [preview, setPreview] = useState(null);
  const [asking, setAsking] = useState(null);
  const [answer, setAnswer] = useState(false);
  const actionLock = useRef(false);
  const door = DOORS.find(d => d.id === run.doorId);
  const locked = preview && DOORS.find(d => d.id === preview);
  const shown = locked || door;
  const strength = signal(run, door);
  const tool = toolFor(door);
  const toolInfo = TOOLS.find(t => t.id === tool);
  const available = door.id === 'practice' || run.tool === tool;
  const requiredDirection = run.locked.length % 2 === 0 ? 1 : -1;
  const started = run.status === 'active' && (run.locked.length > 0 || run.misses > 0);
  const [now, setNow] = useState(Date.now);
  const dialAt = useRef(run.value);
  dialAt.current = run.value;
  useEffect(() => {
    if (run.status !== 'active' || !run.deadline) return;
    const timer = setInterval(() => {
      const time = Date.now(); setNow(time);
      const next = expire(run, door, time);
      if (next !== run) { setRun(next); setSave(s => settle(s, next, door)); playTone('miss', sound); }
    }, 250);
    return () => clearInterval(timer);
  }, [run, door, sound]);
  useEffect(() => { try { storage.setItem(SAVE_KEY, JSON.stringify(save)); storage.setItem(SAVE_KEY + '.run', JSON.stringify(run)); setDurable(true); } catch { setDurable(false); } }, [save, run]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [view]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3400); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { const escape = e => { if (e.key === 'Escape') { setHelp(false); setAsking(null); } }; window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape); }, []);

  function turn(value, dir) {
    if (run.status !== 'active') return;
    if (door.kind === 'pad') { setRun(r => press(r, door, value)); playTone('key', sound); return; }
    // A fast drag can jump several steps in one move; every step it passes still makes its sound.
    let heard = 'tick';
    for (let n = dialAt.current; n !== value;) {
      n = wrap(n + dir);
      const tooth = contact(run, door, n, dir);
      if (tooth === 'gate' || (tooth === 'decoy' && heard === 'tick')) heard = tooth;
    }
    dialAt.current = value;
    setRun(r => ({ ...r, value, dir, clue: '' }));
    playTone(heard === 'tick' ? 'tick' : available ? heard : 'dull', sound);
  }
  function applyTool() {
    const next = spendTool(save, run, door);
    if (next.run === run) return;
    setSave(next.save); setRun(next.run);
    setNotice(`The ${toolInfo.name.toLowerCase()} is now in use for this safe.`);
  }
  function commit() {
    if (actionLock.current || run.status !== 'active') return;
    actionLock.current = true;
    const next = setNumber(run, door);
    setRun(next.run);
    if (['open', 'seized'].includes(next.outcome)) setSave(s => settle(s, next.run, door));
    playTone(next.outcome, sound, door.model);
    setTimeout(() => { actionLock.current = false; }, 180);
  }
  function startDoor(next, from = save) {
    actionLock.current = false; setAnswer(false); setSave(abandon(from, run)); setRun(makeRun(next)); setView('workshop');
  }
  function selectDoor(next) {
    setView('workshop');
    // A safe the player does not own opens as a preview in the workshop, not as a jump to the shop.
    if (next.id !== 'practice' && save.doors[next.id] < 1) { setPreview(next.id); return; }
    setPreview(null);
    if (run.status === 'active' && run.doorId === next.id) return;
    if (started && next.id !== run.doorId) { setNotice(`Finish the ${door.name} first. You have already started it.`); return; }
    startDoor(next);
  }
  function confirmBuy() {
    const { id, category } = asking;
    const next = purchase(save, id, category);
    setAsking(null);
    if (next === save) return;
    const item = (category === 'tool' ? TOOLS : DOORS).find(i => i.id === id);
    setNotice(category === 'tool' ? `You bought a ${item.name.toLowerCase()}. You have ${next.tools[id]}.` : `You bought a door for the ${item.name}.`);
    playTone('pin', sound);
    if (category === 'door' && preview === id) {
      setPreview(null);
      if (started) { setSave(next); setNotice(`Door bought. Finish the ${door.name} first, then open the ${item.name}.`); return; }
      startDoor(item, next); return;
    }
    setSave(next);
  }
  const askBuy = (id, category) => setAsking({ id, category });
  const askExchange = bars => setAsking({ category: 'exchange', bars });
  function confirmExchange() {
    const next = exchange(save, asking.bars);
    setAsking(null);
    if (next === save) return;
    setSave(next); playTone('pin', sound);
    setNotice(`You exchanged ${asking.bars} gold bar${asking.bars === 1 ? '' : 's'} for ${asking.bars * GOLD_RATE} brass.`);
  }
  function takeRescue() {
    const next = rescue(save);
    if (next === save) return;
    setSave(next); playTone('pin', sound);
    setNotice(`You got ${RESCUE_BRASS} free brass. Buy a door in the Shop.`);
  }
  const index = DOORS.indexOf(shown);

  return <div className="app-shell">
    <header className="topbar"><button className="home-link" onClick={() => setView('workshop')} aria-label="Vaultstead, back to the workshop"><Brand/></button><div className="wallet"><span className="wallet-item"><Coin/><span><strong>{save.brass.toLocaleString()}</strong><small>BRASS</small></span></span><span className="wallet-item"><Coin gold/><span><strong>{save.gold}</strong><small>GOLD BARS</small></span></span><button className="icon-button sound-button" onClick={() => setSound(s => !s)} aria-label={sound ? 'Turn sound off' : 'Turn sound on'}><Icon name={sound ? 'sound' : 'mute'}/></button></div></header>
    <nav className="main-nav" aria-label="Main navigation"><div className="nav-links"><button className={view === 'workshop' || view === 'gallery' ? 'active' : ''} onClick={() => setView('workshop')}><Icon name="lock" size={16}/>Workshop</button><button className={view === 'shop' ? 'active' : ''} onClick={() => setView('shop')}><Icon name="shop" size={16}/>Shop</button><button className={view === 'ledger' ? 'active' : ''} onClick={() => setView('ledger')}><Icon name="book" size={16}/>History</button></div><button className="guide-button" onClick={() => setHelp(true)}><Icon name="help" size={16}/><span>How to play</span></button></nav>
    <main>
      {view === 'workshop' ? <>
        <div className="page-heading"><div><span className="eyebrow">WORKSHOP</span><h1>Pick a safe. Find the code.</h1></div><span className="quiet-note"><span className="status-dot"/>{durable ? 'Progress saved' : 'Progress is not saved'}</span></div>
        <MoneyHelp save={save} onRescue={takeRescue} toShop={() => setView('shop')}/>
        <div className="door-tabs" role="group" aria-label="Choose a safe">{DOORS.map(d => {
          const owned = d.id === 'practice' || save.doors[d.id] > 0;
          const status = d.id === 'practice' ? 'FREE' : owned ? `${save.doors[d.id]} DOOR${save.doors[d.id] === 1 ? '' : 'S'}` : 'LOCKED';
          return <button key={d.id} className={`${shown.id === d.id ? 'selected' : ''} ${owned ? '' : 'is-locked'}`} onClick={() => selectDoor(d)} aria-label={`${d.name}, ${status.toLowerCase()}`} aria-pressed={shown.id === d.id}><span>{d.short}</span><small>{!owned && <Icon name="lock" size={11}/>}{status}</small>{shown.id === d.id && <span className="tab-dot"/>}</button>;
        })}</div>
        <div className="workbench">
          <section className="scene-panel" aria-label="The safe"><div className="scene-label"><span className="eyebrow">{shown.kind === 'dial' ? 'DIAL' : 'KEYPAD'} · {shown.pins} {shown.kind === 'dial' ? 'NUMBERS' : 'DIGITS'}</span><span className="scene-number">{index === 0 ? 'PRACTICE' : `LEVEL ${index} OF ${DOORS.length - 1}`}</span></div>
            {locked
              ? <SafeStage model={locked.model} kind={locked.kind} value={locked.kind === 'pad' ? -1 : 0} found={0} pins={locked.pins} locked={[]} open={false} glow={0}/>
              : <SafeStage model={door.model} kind={door.kind} value={run.value} found={run.locked.length} pins={door.pins} locked={run.locked} open={run.status === 'open'} glow={available ? strength : 0} loot={run.loot} onDial={run.status === 'active' && door.kind === 'dial' ? turn : undefined}/>}
            <div className="scene-footer"><span><Icon name={locked ? 'lock' : run.status === 'open' ? 'check' : 'turn'} size={16}/>{locked ? 'You need a door to play this safe.' : run.status === 'open' ? 'The safe is open.' : door.kind === 'dial' ? `Drag the ${door.model === 'street' ? 'top ' : ''}dial left or right, or press Lower / Higher.` : 'Press a key, then press Enter digit.'}</span><button className="text-button" onClick={() => setView('gallery')}>See all safes <Icon name="arrow" size={14}/></button></div>
          </section>
          <aside className="control-panel">
            {locked ? <>
              <div className="safe-description"><span className="eyebrow">LOCKED SAFE</span><h2>{locked.name}</h2><p>{locked.description}</p></div>
              <dl className="locked-facts">
                <div><dt>Code</dt><dd>{locked.difficulty.replace('Code: ', '')}</dd></div>
                <div><dt>Reward</dt><dd>{locked.brass} brass</dd></div>
                <div><dt>Gold bar chance</dt><dd>{Math.round(locked.goldChance * 100)}%</dd></div>
                <div><dt>Door price</dt><dd>{locked.cost} brass</dd></div>
              </dl>
              <p className="locked-note">You have no door for this safe. Buy one door to get one try.</p>
              <button className="primary-button" disabled={save.brass < locked.cost} onClick={() => askBuy(locked.id, 'door')}>{save.brass >= locked.cost ? `Buy a door for ${locked.cost} brass` : `You need ${locked.cost - save.brass} more brass`}<Icon name="arrow" size={16}/></button>
              <button className="text-button locked-back" onClick={() => setPreview(null)}>Back to the {door.name}</button>
            </> : <>
            <div className="safe-description"><span className="eyebrow">CURRENT SAFE</span><h2>{door.name}</h2><p>{door.description}</p></div>
            {run.status === 'active' ? <>
              <div className="attempt-row"><span>{door.id === 'practice' ? 'Wrong tries: no limit' : 'Wrong tries'}</span><span className="misses" aria-label={`${run.misses} wrong tries${door.id === 'practice' ? '' : ' out of 3'}`}>{door.id === 'practice' ? <span className="infinity">∞</span> : [0, 1, 2].map(n => <i key={n} className={n < run.misses ? 'used' : ''}/>)}</span></div>
              <div className="combination-label"><span className="eyebrow">THE CODE</span><span>{run.locked.length} of {door.pins} found</span></div>
              <div className="combination">{Array.from({ length: door.pins }, (_, i) => <div key={i} className={i < run.locked.length ? 'set' : i === run.locked.length ? 'current' : ''}>{i < run.locked.length ? String(run.locked[i]).padStart(door.kind === 'dial' ? 2 : 1, '0') : i === run.locked.length ? <span className="pin-wait"/> : '—'}{i < run.locked.length && <Icon name="check" size={9}/>}</div>)}</div>
              {door.kind === 'dial' ? <><div className="turn-instruction"><Icon name="turn" size={16} style={{ transform: requiredDirection === -1 ? 'scaleX(-1)' : undefined }}/><span>{requiredDirection === 1 ? 'Turn right (clockwise)' : 'Turn left (counterclockwise)'}</span><small>NUMBER {run.locked.length + 1} OF {door.pins}</small></div><div className="dial-controls"><button onClick={() => turn(wrap(run.value - 1), -1)} aria-label="Lower number, turn left"><Icon name="minus"/><span>Lower</span></button><div className="live-value"><span className="eyebrow">NUMBER</span><strong>{String(run.value).padStart(2, '0')}</strong><small>0 to 40</small></div><button onClick={() => turn(wrap(run.value + 1), 1)} aria-label="Higher number, turn right"><Icon name="plus"/><span>Higher</span></button></div></> : <><div className="keypad-instruction"><span>Digit {run.locked.length + 1} of {door.pins}</span><strong>{run.value < 0 ? '−' : run.value}</strong></div><div className="keypad" role="group" aria-label="Keypad">{[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => <button className={`${run.value === n ? 'selected' : ''} ${run.worn.includes(n) ? 'worn' : ''}`} key={n} onClick={() => turn(n, 1)} aria-label={`${n}${run.worn.includes(n) ? ', worn' : ''}`}>{n}</button>)}</div>
                {door.alarm > 0 && <div className={`alarm-row ${run.deadline ? 'is-armed' : ''}`} role="timer"><span>{run.deadline ? 'Alarm: time left' : `Alarm starts at your first key (${door.alarm} seconds)`}</span>{run.deadline && <strong>{Math.max(0, Math.ceil((run.deadline - now) / 1000))}s</strong>}</div>}</>}
              <ListeningMeter strength={strength} kind={door.kind} available={available}/>
              {!available && (save.tools[tool] > 0
                ? <button className="tool-button" onClick={applyTool}><Icon name="ear" size={15}/>Use a {toolInfo.name.toLowerCase()} on this safe<span>You have {save.tools[tool]}</span></button>
                : <button className="tool-button" onClick={() => askBuy(tool, 'tool')} disabled={save.brass < toolInfo.cost}><Icon name="ear" size={15}/>{save.brass >= toolInfo.cost ? `Buy a ${toolInfo.name.toLowerCase()}` : `Need ${toolInfo.cost - save.brass} more brass for a ${toolInfo.name.toLowerCase()}`}<span>{toolInfo.cost} brass</span></button>)}
              <button className="primary-button set-button" onClick={commit} disabled={run.value < 0 || (door.kind === 'dial' && run.dir === 0)}>{door.kind === 'dial' ? 'Set number' : 'Enter digit'}<Icon name="lock" size={16}/></button>
              <div className={`feedback ${run.clue ? 'has-clue' : ''}`} role="status">{run.clue || (door.kind === 'dial' && run.dir === 0 ? 'Turn the dial first. Then press Set number.' : door.kind === 'pad' && run.value < 0 ? 'Press a key first. Then press Enter digit.' : door.kind === 'dial' ? 'Turn slowly. Listen for the soft click.' : 'Press Enter digit to try this key.')}
                {door.id === 'practice' && <div className="practice-answer">{answer ? 'Answer: 12 · 28 · 07' : <button className="text-button" onClick={() => setAnswer(true)}>Show the answer</button>}</div>}</div>
            </> : <div className={`result ${run.status}`} role="status">
              <div className="result-seal">{run.status === 'seized' ? <Icon name="lock" size={29}/> : run.loot === 'gold' ? <Coin gold/> : <Icon name="check" size={29}/>}</div>
              <span className="eyebrow">{run.status === 'seized' ? run.cause === 'alarm' ? 'TIME IS UP' : '3 WRONG TRIES' : 'SAFE OPENED'}</span>
              <h3>{run.status === 'seized' ? 'This door is lost.' : run.loot === 'gold' ? 'You found a gold bar!' : run.loot === 'brass' ? 'You found brass.' : 'Practice complete.'}</h3>
              <p>{run.status === 'seized' ? 'Buy another door in the Shop, or try the Practice safe.' : run.loot === 'gold' ? '1 gold bar is added to your account.' : run.loot === 'brass' ? 'Use brass to buy more doors and tools.' : 'Practice gives no reward. Try a real safe next.'}</p>
              {run.status === 'open' && <div className="reward">{run.loot !== 'empty' && <Coin gold={run.loot === 'gold'}/>}<strong>{run.loot === 'gold' ? '+1' : run.loot === 'brass' ? `+${run.reward}` : 'No reward'}</strong><span>{run.loot === 'gold' ? 'GOLD BAR' : run.loot === 'brass' ? 'BRASS' : 'PRACTICE'}</span></div>}
              <button className="primary-button" onClick={() => { if (door.id === 'practice' || save.doors[door.id] > 0) startDoor(door); else setPreview(door.id); }}>{door.id === 'practice' ? 'Practice again' : save.doors[door.id] > 0 ? `Try the next door (${save.doors[door.id]} left)` : 'Buy another door'}<Icon name="arrow" size={16}/></button>
              {door.id !== 'practice' && <button className="text-button result-practice" onClick={() => selectDoor(DOORS[0])}>Go to the Practice safe</button>}
            </div>}
            </>}
            <div className="door-payout"><Coin gold/><span>{shown.id === 'practice' ? 'Practice: no reward' : `Gold bar chance: ${Math.round(shown.goldChance * 100)}%`}</span><small>{shown.id === 'practice' ? 'FREE' : `Otherwise ${shown.brass} brass`}</small></div>
          </aside>
        </div>
        <div className="field-notes"><div><span className="note-number">01</span><span><strong>Turn the dial slowly.</strong><small>On the correct number, the click sounds different.</small></span></div><div><span className="note-number">02</span><span><strong>3 wrong tries lose the door.</strong><small>The Practice safe is free and has no limit.</small></span></div><div><span className="note-number">03</span><span><strong>Most safes give brass.</strong><small>Some give a gold bar.</small></span></div></div>
      </> : view === 'shop' ? <Shop save={save} askBuy={askBuy} askExchange={askExchange} selectDoor={selectDoor} onRescue={takeRescue}/> : view === 'ledger' ? <History save={save} go={() => setView('workshop')}/> : <Gallery back={() => setView('workshop')}/>}
    </main>
    <footer className="site-footer"><span>VAULTSTEAD <span className="footer-divider">/</span> A NOMSTEAD GAME</span><span>Take your time.</span></footer>
    {notice && <div className="toast" role="status"><Icon name="check" size={16}/>{notice}</div>}
    {help && <Help close={() => setHelp(false)}/>}
    {asking?.category === 'exchange' && <ConfirmExchange bars={asking.bars} save={save} cancel={() => setAsking(null)} confirm={confirmExchange}/>}
    {asking && asking.category !== 'exchange' && <ConfirmBuy item={(asking.category === 'tool' ? TOOLS : DOORS).find(i => i.id === asking.id)} category={asking.category} brass={save.brass} cancel={() => setAsking(null)} confirm={confirmBuy}/>}
  </div>;
}

function Shop({ save, askBuy, askExchange, selectDoor, onRescue }) {
  return <><div className="page-heading"><div><span className="eyebrow">SHOP</span><h1>Buy doors and tools.</h1></div><span className="quiet-note">One door = one try at a safe.</span></div>
    <MoneyHelp save={save} onRescue={onRescue}/>
    <section className="exchange-card" aria-labelledby="exchange-title">
      <div className="exchange-rate"><Coin gold/><strong>1 gold bar = {GOLD_RATE} brass</strong></div>
      <div className="exchange-text"><span className="eyebrow">EXCHANGE · YOU HAVE {save.gold} GOLD BAR{save.gold === 1 ? '' : 'S'}</span><h2 id="exchange-title">Exchange gold for brass</h2><p>{save.gold ? 'Turn gold bars into brass to buy more doors and tools.' : 'You have no gold bars yet. Open real safes to find them.'}</p></div>
      <div className="exchange-actions">
        <button className="purchase-button" disabled={save.gold < 1} onClick={() => askExchange(1)}>Exchange 1 bar <span><Coin/>{GOLD_RATE}</span></button>
        {save.gold > 1 && <button className="purchase-button" onClick={() => askExchange(save.gold)}>Exchange all {save.gold} bars <span><Coin/>{save.gold * GOLD_RATE}</span></button>}
      </div>
    </section>
    <div className="shop-section-heading"><h2>Safes</h2><span>Each door gives one try. 3 wrong tries lose the door.</span></div>
    <div className="shop-grid">{DOORS.filter(d => d.cost).map(d => <article className="shop-card" key={d.id}><div className="shop-picture"><img src={safeAsset(`${d.model}-thumb.webp`)} alt={`Photographic ${SAFE_LOOKS[d.model]}`} loading="lazy"/><span className="shop-stock">YOU HAVE {save.doors[d.id]}</span></div><div className="shop-card-body"><span className="eyebrow">{d.difficulty}</span><h3>{d.name}</h3><p>{d.description}</p><div className="shop-odds"><span>Reward: {d.brass} brass</span><span>Gold bar: {Math.round(d.goldChance * 100)}%</span></div>
      {save.doors[d.id] > 0 && <button className="primary-button play-owned" onClick={() => selectDoor(d)}>Play this safe <Icon name="arrow" size={14}/></button>}
      <button className="purchase-button" disabled={save.brass < d.cost} onClick={() => askBuy(d.id, 'door')}>{priceLabel(save.doors[d.id] > 0 ? 'Buy one more door' : 'Buy a door', d.cost, save.brass)}</button></div></article>)}</div>
    <div className="shop-section-heading tools-heading"><h2>Tools</h2><span>Each tool works on one safe only.</span></div>
    <div className="tools-grid">{TOOLS.map(t => <article className="tool-card" key={t.id}><div className="tool-icon"><Icon name={t.id === 'stethoscope' ? 'ear' : 'lock'} size={30}/></div><div><span className="eyebrow">{t.id === 'stethoscope' ? 'FOR DIAL SAFES' : 'FOR KEYPAD SAFES'} · YOU HAVE {save.tools[t.id]}</span><h3>{t.name}</h3><p>{t.description}</p></div><button className="purchase-button" disabled={save.brass < t.cost} onClick={() => askBuy(t.id, 'tool')}>{priceLabel('Buy one', t.cost, save.brass)}</button></article>)}</div>
    <div className="cash-packs"><div><span className="eyebrow">CASH PACKS</span><h3>Coming later.</h3><p>These are not for sale.</p></div>{[500, 1500, 5000].map(n => <div className="cash-pack" key={n}><Coin/><strong>{n.toLocaleString()} brass</strong><small>NOT FOR SALE</small></div>)}</div>
  </>;
}
function History({ save, go }) { return <><div className="page-heading"><div><span className="eyebrow">HISTORY</span><h1>Your results.</h1></div></div><div className="ledger-stats">{[['Safes opened', save.opens], ['Gold bars found', save.gold], ['Doors lost', save.seizures]].map(([label, n]) => <div key={label}><span className="eyebrow">{label}</span><strong>{n}</strong></div>)}</div><section className="ledger-table"><div className="shop-section-heading"><h2>Recent tries</h2><span>Your last 12 safes</span></div>{save.history.length ? <table><thead><tr><th>Safe</th><th>Result</th><th>Reward</th></tr></thead><tbody>{save.history.map((h, i) => <tr key={i}><td>{h.door}</td><td><span className={`ledger-badge ${h.status}`}>{h.status === 'open' ? 'Opened' : 'Lost'}</span></td><td>{h.status === 'seized' ? '—' : h.loot === 'gold' ? '1 gold bar' : `${h.amount} brass`}</td></tr>)}</tbody></table> : <div className="empty-ledger"><Icon name="book" size={38}/><h3>No results yet.</h3><p>Open a safe (not Practice) to see it here.</p><button className="primary-button" onClick={go}>Go to the workshop <Icon name="arrow" size={16}/></button></div>}</section></>; }
function Gallery({ back }) { return <><div className="page-heading"><div><span className="eyebrow">ALL SAFES</span><h1>All seven safes.</h1></div><button className="primary-button gallery-back" onClick={back}>Back to the workshop <Icon name="arrow" size={16}/></button></div><p className="gallery-note">Each safe, closed and open. Looking here is free.</p><div className="gallery-grid">{DOORS.flatMap((d, i) => [[d, false, 'empty'], [d, true, d.id === 'practice' ? 'empty' : i % 2 ? 'gold' : 'brass']]).map(([d, open, loot]) => <figure key={d.id + open}><SafeStage model={d.model} kind={d.kind} value={d.kind === 'pad' ? 7 : 12} found={open ? d.pins : 0} pins={d.pins} locked={open ? [12, 28, 7] : []} open={open} glow={0} loot={loot}/><figcaption>{d.name}<span>{open ? loot === 'empty' ? 'OPEN · EMPTY' : `OPEN · ${loot === 'gold' ? 'GOLD BAR' : 'BRASS'}` : 'CLOSED'}</span></figcaption></figure>)}</div></>; }
createRoot(document.getElementById('root')).render(<App/>);
