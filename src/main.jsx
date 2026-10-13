import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { SafeStage, safeAsset } from './components/vault/safe-stage';
import { DOORS, TOOLS, SAVE_KEY, loadSave, makeRun, signal, wrap, setNumber, settle, purchase } from './game.mjs';
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
function Brand() { return <span className="brand"><span className="brand-mark"><Icon name="shelf" size={27}/></span><span>Vaultstead<span className="brand-caption">THE ART OF THE OPEN</span></span></span>; }
function Coin({ gold = false }) { return <span className={gold ? 'gold-ingot' : 'brass-coin'} aria-hidden="true"/>; }
let audio;
function playTone(type, active) {
  if (!active) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(type === 'open' ? 220 : type === 'miss' ? 90 : type === 'pin' ? 880 : 440, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(type === 'open' ? 660 : 65, audio.currentTime + (type === 'open' ? .45 : .08));
    gain.gain.setValueAtTime(.025, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + (type === 'open' ? .6 : .1));
    oscillator.start(); oscillator.stop(audio.currentTime + (type === 'open' ? .65 : .12));
  } catch { /* The game remains playable without audio. */ }
}
function readRun(save) {
  try {
    const saved = JSON.parse(storage.getItem(SAVE_KEY + '.run'));
    const door = DOORS.find(d => d.id === saved?.doorId);
    if (door && saved.status === 'active' && (door.id === 'practice' || save.doors[door.id] > 0) && saved.targets?.length === door.pins && saved.targets.every(n => Number.isInteger(n) && n >= 0 && n <= (door.kind === 'dial' ? 40 : 9)) && Array.isArray(saved.locked) && saved.locked.length < door.pins && Number.isInteger(saved.misses) && saved.misses >= 0 && (saved.misses < 3 || door.id === 'practice') && Number.isInteger(saved.value) && saved.value >= (door.kind === 'pad' ? -1 : 0) && saved.value <= (door.kind === 'pad' ? 9 : 40) && [-1, 0, 1].includes(saved.dir)) return saved;
  } catch { /* fresh game */ }
  return makeRun(DOORS[save.doors.street ? 1 : save.doors.keypad ? 2 : 0]);
}

function ListeningMeter({ strength, kind, available }) {
  const phrase = !available ? 'Tool not equipped' : strength === 1 ? 'Tumbler aligned' : strength > .7 ? 'Almost there' : strength > .3 ? 'A faint response' : 'Listen closely';
  return <div className={`listening ${strength === 1 && available ? 'is-aligned' : ''}`}>
    <div className="meter-label"><span><Icon name="ear" size={15}/>{kind === 'dial' ? 'LISTENING METER' : 'SIGNAL STRENGTH'}</span><span className="signal-light"/></div>
    <div className="meter-bars" role="meter" aria-label={kind === 'dial' ? 'Listening meter' : 'Signal strength'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={available ? Math.round(strength * 100) : 0}>
      {Array.from({ length: 35 }, (_, i) => { const wave = Math.sin(i * 1.55) * .4 + Math.cos(i * .55) * .25 + .35; return <i key={i} style={{ height: `${available ? 5 + (Math.abs(wave) * 24 + 6) * strength : 5}px`, opacity: available ? .3 + strength * .7 : .2 }} />; })}
    </div>
    <div className="meter-caption"><span>{phrase}</span><span>{available ? `${Math.round(strength * 100)}%` : '—'}</span></div>
  </div>;
}
function Help({ close }) {
  return <div className="modal-cover" onClick={close}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}>
    <button className="icon-button modal-close" onClick={close} aria-label="Close instructions"><Icon name="close"/></button>
    <span className="eyebrow">A SMALL FIELD GUIDE</span><h2 id="help-title">The safe speaks.<br/>Learn to listen.</h2>
    <p>Start with the free practice wheel. Turn the upper dial until the listening meter reaches its peak, then set the number.</p>
    <ol><li><strong>Follow the direction.</strong> Clockwise first. Counterclockwise next. Alternate for every dial number.</li><li><strong>Listen for alignment.</strong> Your stethoscope is included. For an electronic safe, buy a signal probe or try the digits.</li><li><strong>Mind your misses.</strong> Three misses seize a real door. Practice is unlimited and pays nothing.</li><li><strong>Open, collect, repeat.</strong> Most real opens pay brass. Street and keypad safes have a 1 in 5 gold chance. Heavier doors have slightly better odds.</li></ol>
    <p className="fine-print">This is a browser-local game. Gold bars are in-game rewards. Cash packs are listed in the counting house and are not for sale.</p>
    <button className="primary-button" onClick={close}>Back to the work <Icon name="arrow" size={16}/></button>
  </section></div>;
}

function App() {
  const [save, setSave] = useState(() => loadSave(storage));
  const [run, setRun] = useState(() => readRun(save));
  const [view, setView] = useState('workshop');
  const [help, setHelp] = useState(false);
  const [sound, setSound] = useState(true);
  const [notice, setNotice] = useState('');
  const [durable, setDurable] = useState(true);
  const actionLock = useRef(false);
  const door = DOORS.find(d => d.id === run.doorId);
  const strength = signal(run, door);
  const tool = door.kind === 'dial' ? 'stethoscope' : 'probe';
  const available = save.tools.includes(tool);
  const requiredDirection = run.locked.length % 2 === 0 ? 1 : -1;
  useEffect(() => { try { storage.setItem(SAVE_KEY, JSON.stringify(save)); storage.setItem(SAVE_KEY + '.run', JSON.stringify(run)); setDurable(true); } catch { setDurable(false); } }, [save, run]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [view]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3400); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { const escape = e => { if (e.key === 'Escape') setHelp(false); }; window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape); }, []);

  function turn(value, dir) {
    if (run.status !== 'active') return;
    setRun(r => ({ ...r, value, dir, clue: '' })); playTone('tick', sound);
  }
  function commit() {
    if (actionLock.current || run.status !== 'active') return;
    actionLock.current = true;
    const next = setNumber(run, door);
    setRun(next.run);
    if (['open', 'seized'].includes(next.outcome)) setSave(s => settle(s, next.run, door));
    playTone(next.outcome, sound);
    setTimeout(() => { actionLock.current = false; }, 180);
  }
  function selectDoor(next) {
    if (next.id !== 'practice' && save.doors[next.id] < 1) { setView('shop'); setNotice('Pick up a door in the counting house.'); return; }
    if (run.status === 'active' && run.doorId === next.id) return;
    if (run.status === 'active' && (run.locked.length > 0 || run.misses > 0) && next.id !== run.doorId) {
      setNotice('Finish this attempt before changing doors.'); setView('workshop'); return;
    }
    actionLock.current = false; setRun(makeRun(next)); setView('workshop');
  }
  function buy(id, category) {
    const next = purchase(save, id, category);
    if (next === save) return;
    setSave(next); const item = (category === 'tool' ? TOOLS : DOORS).find(i => i.id === id);
    setNotice(`${item.name} ${category === 'tool' ? 'equipped' : 'added to your doors'}.`); playTone('pin', sound);
  }

  return <div className="app-shell">
    <header className="topbar"><button className="home-link" onClick={() => setView('workshop')} aria-label="Vaultstead home"><Brand/></button><div className="wallet"><span className="wallet-item"><Coin/><span><strong>{save.brass.toLocaleString()}</strong><small>BRASS</small></span></span><span className="wallet-item"><Coin gold/><span><strong>{save.gold}</strong><small>GOLD BARS</small></span></span><button className="icon-button sound-button" onClick={() => setSound(s => !s)} aria-label={sound ? 'Mute sound' : 'Enable sound'}><Icon name={sound ? 'sound' : 'mute'}/></button></div></header>
    <nav className="main-nav" aria-label="Main navigation"><div className="nav-links"><button className={view === 'workshop' ? 'active' : ''} onClick={() => setView('workshop')}><Icon name="lock" size={16}/>Workshop</button><button className={view === 'shop' ? 'active' : ''} onClick={() => setView('shop')}><Icon name="shop" size={16}/>Counting house</button><button className={view === 'ledger' ? 'active' : ''} onClick={() => setView('ledger')}><Icon name="book" size={16}/>Ledger</button></div><button className="guide-button" aria-label="How to crack a safe" onClick={() => setHelp(true)}><Icon name="help" size={16}/><span>How to crack a safe</span></button></nav>
    <main>
      {view === 'workshop' ? <>
        <div className="page-heading"><div><span className="eyebrow">THE LOCKSMITH’S WORKSHOP</span><h1>A good ear. A steady hand.</h1></div><span className="quiet-note"><span className="status-dot"/>{durable ? 'Your progress is saved' : 'Playing for this session'}</span></div>
        <div className="door-tabs" role="group" aria-label="Choose a safe">{DOORS.map(d => <button key={d.id} className={door.id === d.id ? 'selected' : ''} onClick={() => selectDoor(d)}><span>{d.short}</span><small>{d.id === 'practice' ? 'FREE' : save.doors[d.id] ? `${save.doors[d.id]} DOOR${save.doors[d.id] === 1 ? '' : 'S'}` : 'GET A DOOR'}</small>{door.id === d.id && <span className="tab-dot"/>}</button>)}</div>
        <div className="workbench">
          <section className="scene-panel" aria-label="Safe opening stage"><div className="scene-label"><span className="eyebrow">{door.kind === 'dial' ? 'MECHANICAL' : 'ELECTRONIC'} · {door.pins} {door.kind === 'dial' ? 'TUMBLERS' : 'DIGITS'}</span><span className="scene-number">NO. {String(DOORS.indexOf(door)).padStart(3, '0')}</span></div>
            <SafeStage kind={door.kind} value={run.value} found={run.locked.length} pins={door.pins} locked={run.locked} open={run.status === 'open'} glow={available ? strength : 0} loot={run.loot} onDial={run.status === 'active' && door.kind === 'dial' ? turn : undefined}/>
            <div className="scene-footer"><span><Icon name={run.status === 'open' ? 'check' : 'turn'} size={16}/>{run.status === 'open' ? 'The door is open. Take a moment.' : door.kind === 'dial' ? 'Drag the upper dial, or use Lower / Higher.' : 'Choose a digit, then lock it in.'}</span><button className="text-button" onClick={() => setView('gallery')}>Inspect the safe <Icon name="arrow" size={14}/></button></div>
          </section>
          <aside className="control-panel">
            <div className="safe-description"><span className="eyebrow">YOUR NEXT OPEN</span><h2>{door.name}</h2><p>{door.description}</p></div>
            {run.status === 'active' ? <>
              <div className="attempt-row"><span>{door.id === 'practice' ? 'Unlimited practice' : 'Misses'}</span><span className="misses" aria-label={`${run.misses} misses${door.id === 'practice' ? '' : ' out of 3'}`}>{door.id === 'practice' ? <span className="infinity">∞</span> : [0, 1, 2].map(n => <i key={n} className={n < run.misses ? 'used' : ''}/>)}</span></div>
              <div className="combination-label"><span className="eyebrow">THE COMBINATION</span><span>{run.locked.length} / {door.pins}</span></div>
              <div className="combination">{Array.from({ length: door.pins }, (_, i) => <div key={i} className={i < run.locked.length ? 'set' : i === run.locked.length ? 'current' : ''}>{i < run.locked.length ? String(run.locked[i]).padStart(door.kind === 'dial' ? 2 : 1, '0') : i === run.locked.length ? <span className="pin-wait"/> : '—'}{i < run.locked.length && <Icon name="check" size={9}/>}</div>)}</div>
              {door.kind === 'dial' ? <><div className="turn-instruction"><Icon name="turn" size={16} style={{ transform: requiredDirection === -1 ? 'scaleX(-1)' : undefined }}/><span>Turn {requiredDirection === 1 ? 'clockwise' : 'counterclockwise'}</span><small>{run.locked.length + 1} OF {door.pins}</small></div><div className="dial-controls"><button onClick={() => turn(wrap(run.value - 1), -1)} aria-label="Lower dial value"><Icon name="minus"/><span>Lower</span></button><div className="live-value"><span className="eyebrow">ON THE DIAL</span><strong>{String(run.value).padStart(2, '0')}</strong><small>0 — 40</small></div><button onClick={() => turn(wrap(run.value + 1), 1)} aria-label="Higher dial value"><Icon name="plus"/><span>Higher</span></button></div></> : <><div className="keypad-instruction"><span>Select digit {run.locked.length + 1} of {door.pins}</span><strong>{run.value < 0 ? '−' : run.value}</strong></div><div className="keypad" role="group" aria-label="Electronic keypad">{[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => <button className={run.value === n ? 'selected' : ''} key={n} onClick={() => turn(n, 1)}>{n}</button>)}</div></>}
              <ListeningMeter strength={strength} kind={door.kind} available={available}/>
              {!available && <button className="tool-offer" onClick={() => buy(tool, 'tool')} disabled={save.brass < TOOLS.find(t => t.id === tool).cost}><Icon name="ear" size={14}/>Equip {tool === 'probe' ? 'signal probe' : 'stethoscope'} <span>{TOOLS.find(t => t.id === tool).cost} brass</span></button>}
              <button className="primary-button set-button" onClick={commit} disabled={run.value < 0 || (door.kind === 'dial' && run.dir === 0)}>{door.kind === 'dial' ? 'Set number' : 'Lock digit'}<Icon name="lock" size={16}/></button>
              <p className={`feedback ${run.clue ? 'has-clue' : ''}`} role="status">{run.clue || (door.id === 'practice' ? `Practice combination: 12 · 28 · 07` : 'Slow turns. Small sounds. Trust your ear.')}</p>
            </> : <div className={`result ${run.status}`} role="status">
              <div className="result-seal">{run.status === 'seized' ? <Icon name="lock" size={29}/> : run.loot === 'gold' ? <Coin gold/> : <Icon name="check" size={29}/>}</div>
              <span className="eyebrow">{run.status === 'seized' ? 'THREE MISSES' : 'A SATISFYING CLICK'}</span>
              <h3>{run.status === 'seized' ? 'The door seized.' : run.loot === 'gold' ? 'A rare find.' : run.loot === 'brass' ? 'Well opened.' : 'A steady beginning.'}</h3>
              <p>{run.status === 'seized' ? 'This door is spent. Pick up another, or find your rhythm on the practice wheel.' : run.loot === 'gold' ? 'One NomStead gold bar, waiting in the quiet.' : run.loot === 'brass' ? 'A little brass for the next door and a better set of tools.' : 'An empty shelf. Practice pays in confidence.'}</p>
              {run.status === 'open' && <div className="reward">{run.loot !== 'empty' && <Coin gold={run.loot === 'gold'}/>}<strong>{run.loot === 'gold' ? '+1' : run.loot === 'brass' ? `+${run.reward}` : 'No payout'}</strong><span>{run.loot === 'gold' ? 'GOLD BAR' : run.loot === 'brass' ? 'BRASS' : 'PRACTICE WHEEL'}</span></div>}
              <button className="primary-button" onClick={() => { if (door.id === 'practice' || save.doors[door.id] > 0) selectDoor(door); else setView('shop'); }}>{door.id === 'practice' ? 'Practice again' : save.doors[door.id] > 0 ? 'Open the next door' : 'Find another door'}<Icon name="arrow" size={16}/></button>
              <button className="text-button result-practice" onClick={() => selectDoor(DOORS[0])}>Return to the practice wheel</button>
            </div>}
            <div className="door-payout"><Coin gold/><span>{door.id === 'practice' ? 'Practice pays nothing' : `Gold chance · ${Math.round(door.goldChance * 100)}%`}</span><small>{door.id === 'practice' ? 'FREE' : `${door.brass} brass otherwise`}</small></div>
          </aside>
        </div>
        <div className="field-notes"><div><span className="note-number">01</span><span><strong>The upper dial is yours.</strong><small>The lower dial and wheel belong to the mechanism.</small></span></div><div><span className="note-number">02</span><span><strong>Three misses cost a door.</strong><small>Find your rhythm on the free practice wheel.</small></span></div><div><span className="note-number">03</span><span><strong>Most opens pay brass.</strong><small>Every so often, the shelf holds something rarer.</small></span></div></div>
      </> : view === 'shop' ? <CountingHouse save={save} buy={buy} selectDoor={selectDoor}/> : view === 'ledger' ? <Ledger save={save} go={() => setView('workshop')}/> : <Gallery back={() => setView('workshop')}/>}
    </main>
    <footer className="site-footer"><span>VAULTSTEAD <span className="footer-divider">/</span> A NOMSTEAD WORKSHOP</span><span>Patience opens more doors.</span></footer>
    {notice && <div className="toast" role="status"><Icon name="check" size={16}/>{notice}</div>}
    {help && <Help close={() => setHelp(false)}/>}
  </div>;
}

function CountingHouse({ save, buy, selectDoor }) {
  return <><div className="page-heading"><div><span className="eyebrow">A LITTLE BRASS GOES A LONG WAY</span><h1>The counting house.</h1></div><span className="quiet-note">New doors. Better tools. Another chance.</span></div>
    <div className="shop-section-heading"><h2>Pick your next door</h2><span>One attempt per door · Three misses seize it</span></div>
    <div className="shop-grid">{DOORS.filter(d => d.cost).map(d => <article className="shop-card" key={d.id}><div className="shop-picture"><img src={safeAsset(`thumb-${d.kind}.webp`)} alt={`Photographic ${d.kind === 'dial' ? 'combination' : 'keypad'} steel safe`} loading="lazy"/><span className="shop-stock">{save.doors[d.id]} IN YOUR WORKSHOP</span></div><div className="shop-card-body"><span className="eyebrow">{d.difficulty}</span><h3>{d.name}</h3><p>{d.description}</p><div className="shop-odds"><span>{d.brass} brass payout</span><span>{Math.round(d.goldChance * 100)}% gold</span></div><button className="purchase-button" disabled={save.brass < d.cost} onClick={() => buy(d.id, 'door')}>Buy a door <span><Coin/>{d.cost}</span></button>{save.doors[d.id] > 0 && <button className="text-button crack-owned" onClick={() => selectDoor(d)}>Crack an owned door <Icon name="arrow" size={13}/></button>}</div></article>)}</div>
    <div className="shop-section-heading tools-heading"><h2>A better set of ears</h2><span>Buy once. Keep forever.</span></div>
    <div className="tools-grid">{TOOLS.map(t => <article className="tool-card" key={t.id}><div className="tool-icon"><Icon name={t.id === 'stethoscope' ? 'ear' : 'lock'} size={30}/></div><div><span className="eyebrow">{t.id === 'stethoscope' ? 'MECHANICAL SAFES' : 'ELECTRONIC SAFES'}</span><h3>{t.name}</h3><p>{t.description}</p></div><button className="purchase-button" disabled={save.tools.includes(t.id) || save.brass < t.cost} onClick={() => buy(t.id, 'tool')}>{save.tools.includes(t.id) ? <><Icon name="check" size={16}/>Equipped</> : <>Equip <span><Coin/>{t.cost}</span></>}</button></article>)}</div>
    <div className="cash-packs"><div><span className="eyebrow">CASH PACKS</span><h3>Listed for another day.</h3><p>These packs are not for sale.</p></div>{[500, 1500, 5000].map(n => <div className="cash-pack" key={n}><Coin/><strong>{n.toLocaleString()} brass</strong><small>NOT FOR SALE</small></div>)}</div>
  </>;
}
function Ledger({ save, go }) { return <><div className="page-heading"><div><span className="eyebrow">EVERY OPEN LEAVES A MARK</span><h1>Your ledger.</h1></div></div><div className="ledger-stats">{[['Doors opened', save.opens], ['Gold bars found', save.gold], ['Doors seized', save.seizures]].map(([label, n]) => <div key={label}><span className="eyebrow">{label}</span><strong>{n}</strong></div>)}</div><section className="ledger-table"><div className="shop-section-heading"><h2>Recent attempts</h2><span>Your last twelve real doors</span></div>{save.history.length ? <table><thead><tr><th>Door</th><th>Result</th><th>Found inside</th></tr></thead><tbody>{save.history.map((h, i) => <tr key={i}><td>{h.door}</td><td><span className={`ledger-badge ${h.status}`}>{h.status === 'open' ? 'Opened' : 'Seized'}</span></td><td>{h.status === 'seized' ? '—' : h.loot === 'gold' ? '1 NomStead gold bar' : `${h.amount} brass`}</td></tr>)}</tbody></table> : <div className="empty-ledger"><Icon name="book" size={38}/><h3>The first page is yours.</h3><p>Crack a real safe to make your first entry.</p><button className="primary-button" onClick={go}>To the workshop <Icon name="arrow" size={16}/></button></div>}</section></>; }
function Gallery({ back }) { return <><div className="page-heading"><div><span className="eyebrow">A CLOSER LOOK</span><h1>Iron. Oak. A quiet room.</h1></div><button className="text-button" onClick={back}>Back to the workshop <Icon name="arrow" size={16}/></button></div><p className="gallery-note">The same photographed cabinet, in each state. This inspection does not spend a door or award a reward.</p><div className="gallery-grid">{[['Closed dial safe', 'dial', false, 'empty'], ['An empty shelf', 'dial', true, 'empty'], ['One gold bar', 'dial', true, 'gold'], ['The electronic variant', 'pad', false, 'empty'], ['Brass on the shelf', 'dial', true, 'brass']].map(([label, kind, open, loot]) => <figure key={label}><SafeStage kind={kind} value={kind === 'pad' ? 7 : 12} found={open ? 3 : 0} pins={3} locked={open ? [12,28,7] : []} open={open} glow={0} loot={loot}/><figcaption>{label}<span>{open ? 'OPEN' : 'CLOSED'}</span></figcaption></figure>)}</div></>; }
createRoot(document.getElementById('root')).render(<App/>);
