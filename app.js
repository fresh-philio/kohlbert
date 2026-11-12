(() => {
  'use strict';

  const VERSION = '1.1';

  /* ---------- Helpers ---------- */
  const $ = s => document.querySelector(s);
  const now = () => Date.now();
  const clamp = KB.clamp;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  function h(tag, props = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of kids.flat()) e.append(c);
    return e;
  }

  /* ---------- State ---------- */
  const KEY = 'kohlbert.v1';
  const defaults = () => ({
    hunger: 80, happy: 80, energy: 90, clean: 80,
    sleeping: false, born: now(), last: now(),
    poops: [], poopDue: null,
    coins: 25, hats: [], hat: null, glasses: null, outfit: null,
    muted: false, notify: false, lastNotify: {}
  });
  function load() {
    try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY)) || {}); }
    catch (e) { return defaults(); }
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  /* ---------- Shop-Katalog (S.hats enthält alle gekauften IDs, IDs sind eindeutig) ---------- */
  const CATS = {
    hat: {
      label: 'Hüte', items: [
        { id: null,        name: 'Ohne',       emoji: '🌱', price: 0 },
        { id: 'party',     name: 'Partyhut',   emoji: '🎉', price: 20 },
        { id: 'chef',      name: 'Kochmütze',  emoji: '👨‍🍳', price: 35 },
        { id: 'cowboy',    name: 'Cowboy',     emoji: '🤠', price: 50 },
        { id: 'propeller', name: 'Propeller',  emoji: '🚁', price: 70 },
        { id: 'tophat',    name: 'Zylinder',   emoji: '🎩', price: 90 },
        { id: 'crown',     name: 'Krone',      emoji: '👑', price: 150 }
      ]
    },
    glasses: {
      label: 'Brillen', items: [
        { id: null,      name: 'Ohne',        emoji: '👀', price: 0 },
        { id: 'nerd',    name: 'Nerd',        emoji: '👓', price: 25 },
        { id: 'sun',     name: 'Sonnenbrille', emoji: '🕶️', price: 30 },
        { id: 'heart',   name: 'Herzchen',    emoji: '😍', price: 35 },
        { id: 'threed',  name: '3D-Brille',   emoji: '🥽', price: 40 },
        { id: 'monocle', name: 'Monokel',     emoji: '🧐', price: 45 }
      ]
    },
    outfit: {
      label: 'Outfits', items: [
        { id: null,        name: 'Ohne',       emoji: '🌱', price: 0 },
        { id: 'lederhose', name: 'Lederhose',  emoji: '🩳', price: 60 },
        { id: 'dirndl',    name: 'Dirndl',     emoji: '👗', price: 50 },
        { id: 'hawaii',    name: 'Hawaii',     emoji: '🌺', price: 45 },
        { id: 'suit',      name: 'Anzug',      emoji: '🤵', price: 70 },
        { id: 'cape',      name: 'Umhang',     emoji: '🦸', price: 80 }
      ]
    }
  };
  const SLOT = { hat: 'hat', glasses: 'glasses', outfit: 'outfit' };

  function combo() {
    const { hat, glasses, outfit } = S;
    if (outfit === 'lederhose' && hat === 'cowboy') return 'Ozapft is, Partner!';
    if (outfit === 'lederhose' && glasses === 'sun') return 'Servus, Bua!';
    if (outfit === 'lederhose') return 'Oans, zwoa, gsuffa!';
    if (hat === 'tophat' && glasses === 'monocle') return 'Sehr vornehm!';
    if (outfit === 'suit' && glasses === 'sun') return 'Men in Rettich';
    if (outfit === 'cape' && hat === 'crown') return 'König der Rüben!';
    if (outfit === 'hawaii' && glasses === 'sun') return 'Urlaub!';
    return null;
  }

  /* ---------- Sprüche ---------- */
  const SPRUECHE = ['Leben ist schön', 'Hallo Kitty', 'GuMo KoBe', 'GuMo', 'Laufi?', 'Seehr gut'];
  const isMorning = () => new Date().getHours() < 11;
  // GuMo-Sprüche nur vormittags
  const spruch = () => pick(SPRUECHE.filter(s => !(s.startsWith('GuMo') && !isMorning())));
  const greet = () => isMorning() ? pick(['GuMo KoBe', 'GuMo']) : pick(['Moin!', 'Moin moin!', 'Na du?']);

  /* ---------- Sound ---------- */
  const sfx = {
    ctx: null,
    tone(f, type, dur, delay = 0) {
      if (S.muted) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const c = this.ctx; if (c.state === 'suspended') c.resume();
        const t = c.currentTime + delay;
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + dur);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur);
      } catch (e) {}
    },
    happy() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 'triangle', i === 3 ? .25 : .12, i * .08)); },
    eat()   { this.tone(300, 'square', .05); this.tone(400, 'square', .05, .08); this.tone(350, 'square', .08, .16); },
    clean() { this.tone(600, 'sine', .08); this.tone(800, 'sine', .08, .07); this.tone(1000, 'sine', .12, .14); },
    sleep() { this.tone(400, 'sine', .2); this.tone(300, 'sine', .3, .2); },
    pop()   { this.tone(800, 'sine', .05); },
    bad()   { this.tone(180, 'sawtooth', .12); },
    click() { this.tone(1200, 'square', .03); this.tone(600, 'square', .05, .03); },
    sad()   { this.tone(300, 'sawtooth', .15); this.tone(250, 'sawtooth', .25, .15); }
  };

  /* ---------- Elements ---------- */
  const stage = $('#stage'), canvas = $('#canvas'), ctx = canvas.getContext('2d');
  const poopLayer = $('#poopLayer'), speech = $('#speech'), panel = $('#panel'), lcd = $('#lcd');
  const bars = { hunger: ['#bHunger', '#vHunger'], happy: ['#bHappy', '#vHappy'], energy: ['#bEnergy', '#vEnergy'], clean: ['#bClean', '#vClean'] };
  Object.keys(bars).forEach(k => bars[k] = bars[k].map($));
  $('#ver').textContent = 'Kohlbert v' + VERSION;

  let shopOpen = false;

  /* ---------- Sprechblase / Partikel ---------- */
  let speechTimer = null;
  function say(text, ms = 2200) {
    speech.textContent = text; speech.classList.remove('hidden');
    speech.style.animation = 'none'; void speech.offsetWidth; speech.style.animation = '';
    clearTimeout(speechTimer);
    speechTimer = setTimeout(() => speech.classList.add('hidden'), ms);
  }
  function particles(emoji, n = 4) {
    const w = stage.clientWidth, hgt = stage.clientHeight;
    const yf = shopOpen ? 0.25 : 0.5;
    for (let i = 0; i < n; i++) {
      const p = h('div', { class: 'particle' }, emoji);
      p.style.left = (w / 2 + rnd(-40, 40)) + 'px';
      p.style.top = (hgt * yf + rnd(-25, 25)) + 'px';
      p.style.fontSize = rnd(16, 28) + 'px';
      stage.append(p); setTimeout(() => p.remove(), 1200);
    }
  }

  /* ---------- Haufen ---------- */
  function addPoop() {
    if (S.poops.length >= 4) return;
    S.poops.push({ id: now() + Math.random(), x: rnd(10, 90), y: rnd(80, 90) });
    S.clean = clamp(S.clean - 15);
    renderPoops();
  }
  function renderPoops() {
    poopLayer.replaceChildren();
    for (const p of S.poops) {
      const el = h('div', { class: 'poop' }, '💩');
      el.style.left = p.x + '%'; el.style.top = p.y + '%';
      el.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        S.poops = S.poops.filter(q => q.id !== p.id);
        S.clean = clamp(S.clean + 15); S.happy = clamp(S.happy + 2);
        sfx.clean(); particles('✨', 2);
        renderPoops(); updateUI(); save();
      });
      poopLayer.append(el);
    }
  }

  /* ---------- UI ---------- */
  function updateUI() {
    for (const k of Object.keys(bars)) {
      const v = clamp(S[k]);
      bars[k][0].style.width = v + '%';
      bars[k][0].classList.toggle('low', v < 25);
      bars[k][1].textContent = Math.round(v) + '%';
    }
    $('#coins').textContent = S.coins;
    const avg = (S.hunger + S.happy + S.energy + S.clean) / 4;
    let t;
    if (S.sleeping) t = 'Schläft zzz';
    else if (S.hunger < 30) t = 'Hungrig!';
    else if (S.clean < 30) t = 'Schmutzig!';
    else if (S.energy < 25) t = 'Erschöpft';
    else if (avg > 75) t = 'Super glücklich!';
    else if (avg > 45) t = 'Zufrieden';
    else t = 'Traurig';
    $('#statusText').textContent = t;
    $('#dayBadge').textContent = 'Tag ' + (Math.floor((now() - S.born) / 86400000) + 1);
    const d = new Date();
    $('#clock').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    lcd.classList.toggle('night', S.sleeping);
    $('#sleepLabel').textContent = S.sleeping ? 'Aufwachen' : 'Schlafen';
    $('#btnSound').textContent = S.muted ? '🔇' : '🔊';
    const bell = $('#btnBell');
    bell.textContent = S.notify ? '🔔' : '🔕'; bell.classList.toggle('on', S.notify);
  }

  /* ---------- Zeitfortschritt ---------- */
  function advance(t) {
    const dt = (t - S.last) / 3600000;
    S.last = t;
    if (dt <= 0) return false;
    const { woke } = KB.step(S, dt);
    if (S.poopDue && t >= S.poopDue) { S.poopDue = null; addPoop(); }
    if (!S.sleeping) {
      let n = Math.min(dt, KB.RATES.maxHours) * 0.4;           // ca. 0,4 Haufen pro Stunde
      while (n >= 1) { addPoop(); n--; }
      if (Math.random() < n) addPoop();
    }
    if (woke) { renderPoops(); say(greet()); sfx.happy(); }
    return woke;
  }
  function tick() {
    const t = now();
    const woke = advance(t);
    save(); updateUI();
    if (document.hidden) { checkAlerts(woke); pushStateToSW(); }
  }
  setInterval(tick, 5000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { save(); pushStateToSW(); }
    else { advance(now()); renderPoops(); updateUI(); save(); }
  });

  // Gelegentlich plaudert Kohlbert von allein
  setInterval(() => {
    if (document.hidden || S.sleeping || shopOpen || !panel.classList.contains('hidden')) return;
    if (Math.random() < 0.5) say(spruch());
  }, 40000);

  /* ---------- Aktionen ---------- */
  let act = { name: null, until: 0 };
  function doAct(name, ms) { act = { name, until: now() + ms }; }

  function feed(kind) {
    if (S.sleeping) return say('Kohlbert schläft!');
    if (kind === 'pretzel') {
      if (S.hunger > 97) { sfx.sad(); return say('Ich bin satt!'); }
      S.hunger = clamp(S.hunger + 25); S.happy = clamp(S.happy + 5);
      doAct('eating', 2000); sfx.eat(); particles('🥨', 3);
      say(pick(['Mahlzeit!', 'Lecker!', 'Mmh, Brezel!', 'Köstlich!', 'Seehr gut']));
      if (Math.random() < 0.5 && !S.poopDue) S.poopDue = now() + rnd(60, 180) * 1000;
    } else {
      if (S.energy > 97) { sfx.sad(); return say('Bin hellwach!'); }
      S.energy = clamp(S.energy + 30); S.hunger = clamp(S.hunger + 5);
      doAct('drinking', 2000); sfx.eat(); particles('☕', 3);
      say(pick(['Kaffee!', 'Wach!', 'Zisch! ☕', isMorning() ? 'GuMo' : 'Kaffee!']));
    }
    updateUI(); save();
  }
  $('#btnFeed').addEventListener('click', () => feed('pretzel'));
  $('#btnPretzel').addEventListener('click', () => feed('pretzel'));
  $('#btnCoffee').addEventListener('click', () => feed('coffee'));

  $('#btnSleep').addEventListener('click', () => {
    S.sleeping = !S.sleeping;
    if (S.sleeping) { closePanel(); say('Gute Nacht! N8'); sfx.sleep(); }
    else { say(greet()); sfx.happy(); }
    updateUI(); save();
  });

  $('#btnClean').addEventListener('click', () => {
    if (S.poops.length === 0 && S.clean >= 95) return say('Schon sauber! ✨');
    S.clean = 100; S.poops = []; S.poopDue = null; renderPoops();
    sfx.clean(); particles('🧼', 4); particles('✨', 3); say('Blitzblank!');
    updateUI(); save();
  });

  canvas.addEventListener('pointerdown', () => {
    if (S.sleeping) { sfx.tone(200, 'sine', .1); return say('Zzz...'); }
    S.happy = clamp(S.happy + 6);
    doAct('pet', 1500); sfx.happy(); particles('💖', 4);
    say(Math.random() < 0.5 ? spruch() : pick(['Geil!', 'Super!', 'Juhu!', 'Danke!', 'Servus!']));
    updateUI(); save();
  });

  /* ---------- Panels ---------- */
  let cleanup = null;
  function closePanel() {
    if (cleanup) { const c = cleanup; cleanup = null; c(); }
    panel.className = 'panel hidden'; panel.replaceChildren();
    shopOpen = false; stage.classList.remove('shop-open');
  }
  function openPanel(node, cls) {
    if (cleanup) { const c = cleanup; cleanup = null; c(); }
    panel.className = 'panel' + (cls ? ' ' + cls : '');
    shopOpen = cls === 'sheet'; stage.classList.toggle('shop-open', shopOpen);
    panel.replaceChildren(node);
  }
  const xBtn = () => h('button', { class: 'x', onclick: () => closePanel() }, '✕');

  /* ---------- Shop ---------- */
  let shopTab = 'hat';
  function openShop() {
    const cat = CATS[shopTab];
    const slot = SLOT[shopTab];
    const tabs = h('div', { class: 'tabs' }, Object.entries(CATS).map(([k, c]) =>
      h('button', { class: 'tab' + (k === shopTab ? ' on' : ''), onclick: () => { shopTab = k; openShop(); } }, c.label)));
    const cards = cat.items.map(it => {
      const owned = it.id === null || S.hats.includes(it.id);
      const on = S[slot] === it.id;
      const sub = on ? 'Getragen ✓' : owned ? 'Anziehen' : '🪙 ' + it.price;
      return h('button', {
        class: 'hat' + (on ? ' on' : ''),
        onclick: () => {
          let msg;
          if (owned) { S[slot] = it.id; sfx.happy(); msg = it.id ? pick(['Steht mir!', 'Schick!', 'Seehr gut']) : 'Wieder schlicht'; }
          else if (S.coins >= it.price) { S.coins -= it.price; S.hats.push(it.id); S[slot] = it.id; sfx.happy(); particles('✨', 4); msg = 'Neu! ' + it.name; }
          else { sfx.sad(); say('Zu wenig Münzen'); return; }
          save(); updateUI(); openShop();
          say(combo() || msg, 2600);
        }
      }, h('span', { class: 'e' }, it.emoji), it.name, h('small', {}, sub));
    });
    openPanel(h('div', { class: 'pcol' },
      h('div', { class: 'ptitle' }, tabs, h('span', { class: 'grow' }), xBtn()),
      h('div', { class: 'shop' }, cards)), 'sheet');
  }
  $('#btnHats').addEventListener('click', openShop);

  /* ---------- Minispiele ---------- */
  function openGames() {
    if (S.sleeping) return say('Kohlbert schläft!');
    if (S.energy < 15) { sfx.sad(); return say('Zu müde zum Spielen...'); }
    const gb = (e, t, sub, fn) => h('button', { class: 'menu-btn', onclick: fn }, h('span', { class: 't' }, h('span', { class: 'e' }, e), h('b', {}, t)), h('small', {}, sub));
    openPanel(h('div', { class: 'pcol' },
      h('div', { class: 'ptitle' }, 'Minispiele', xBtn()),
      h('div', { class: 'menu' }, [
        gb('🍃', 'Blätter fangen', 'Steine meiden', startLeaves),
        gb('🔨', 'Rettich-Klopfen', 'Sprossen hauen', startWhack),
        gb('🃏', 'Memory', 'Paare finden', startMemory),
        gb('🐛', 'Rettich-Feld', 'Minesweeper', startSweeper),
        gb('📸', 'Schnappschuss', 'Promis knipsen', startSnap),
        gb('🎨', 'Pixel-Maler', 'Bild merken', startPixel),
        gb('🌈', 'Farbmischer', 'Farbe treffen', startMixer)
      ])));
  }
  $('#btnPlay').addEventListener('click', openGames);

  function endGame(title, scoreText, coins, again) {
    S.coins += coins;
    S.happy = clamp(S.happy + 8 + Math.min(20, coins));
    S.energy = clamp(S.energy - 10);
    save(); updateUI(); sfx.happy();
    openPanel(h('div', { class: 'pcol' },
      h('div', { class: 'ptitle' }, title, xBtn()),
      h('div', { class: 'center' },
        h('div', { class: 'big' }, coins > 0 ? '🎉' : '😅'),
        h('div', {}, scoreText),
        h('div', {}, '🪙 +' + coins),
        h('div', {}, coins >= 15 ? 'Seehr gut!' : coins > 0 ? 'Nicht schlecht!' : 'Leben ist schön'),
        h('div', {}, h('button', { class: 'cta', onclick: () => (S.energy < 15 ? (closePanel(), say('Zu müde...')) : again()) }, 'Nochmal'), ' ',
          h('button', { class: 'cta alt', onclick: () => closePanel() }, 'Fertig')))));
  }

  /* 30-Sekunden-Spiele (Blätter, Klopfen, Schnappschuss) */
  function timedGame(title, build) {
    let score = 0, time = 30;
    const sc = h('span', { class: 'pill' }, '0 Pkt'), tm = h('span', { class: 'pill' }, time + 's');
    const area = build.container();
    openPanel(h('div', { class: 'pcol' }, h('div', { class: 'ptitle' }, title, h('span', { class: 'grow' }), sc, tm, xBtn()), area));
    const add = n => { score += n; sc.textContent = score + ' Pkt'; (n > 0 ? sfx.pop() : sfx.bad()); };
    const stopFns = build.start(area, add);
    const t = setInterval(() => {
      time--; tm.textContent = time + 's';
      if (time <= 0) { const s = Math.max(0, score); cleanup && (cleanup(), cleanup = null); endGame(title, s + ' Punkte', Math.floor(s / 10), () => timedGame(title, build)); }
    }, 1000);
    cleanup = () => { clearInterval(t); stopFns(); };
  }

  /* --- Blätter fangen --- */
  const leavesGame = {
    container: () => h('div', { class: 'mg-area' }),
    start(area, add) {
      const spawn = () => {
        const bad = Math.random() < 0.2;
        const el = h('div', { class: 'fall' }, bad ? '🪨' : (Math.random() < 0.3 ? '🌱' : '🍃'));
        el.style.left = rnd(0, Math.max(10, area.clientWidth - 44)) + 'px';
        const dur = rnd(1.8, 3.4);
        el.style.transitionDuration = dur + 's';
        area.append(el);
        requestAnimationFrame(() => requestAnimationFrame(() => { el.style.top = area.clientHeight + 'px'; }));
        const rm = setTimeout(() => el.remove(), dur * 1000 + 150);
        el.addEventListener('pointerdown', e => { e.preventDefault(); clearTimeout(rm); el.remove(); add(bad ? -10 : 10); });
      };
      const iv = setInterval(spawn, 520);
      return () => clearInterval(iv);
    }
  };
  const startLeaves = () => timedGame('Blätter fangen', leavesGame);

  /* --- Rettich-Klopfen --- */
  const whackGame = {
    container: () => h('div', { class: 'holes' }),
    start(grid, add) {
      const holes = []; const timers = [];
      for (let i = 0; i < 9; i++) {
        const hole = h('div', { class: 'hole' }); hole.dataset.v = '';
        hole.addEventListener('pointerdown', e => {
          e.preventDefault();
          if (!hole.dataset.v) return;
          add(hole.dataset.v === 'good' ? 10 : -10);
          hole.textContent = ''; hole.dataset.v = '';
        });
        holes.push(hole); grid.append(hole);
      }
      const iv = setInterval(() => {
        const free = holes.filter(x => !x.dataset.v); if (!free.length) return;
        const hole = pick(free); const good = Math.random() < 0.75;
        hole.dataset.v = good ? 'good' : 'bad'; hole.textContent = good ? '🌱' : '🐛';
        timers.push(setTimeout(() => { hole.textContent = ''; hole.dataset.v = ''; }, 800));
      }, 650);
      return () => { clearInterval(iv); timers.forEach(clearTimeout); };
    }
  };
  const startWhack = () => timedGame('Rettich-Klopfen', whackGame);

  /* --- Memory (jede Karte hat Rück- und Vorderseite, iOS-sicher) --- */
  function startMemory() {
    const emojis = ['🥨', '☕', '🍃', '🎩', '👑', '🌱'];
    const deck = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
    let first = null, lock = false, moves = 0, found = 0;
    const mv = h('span', { class: 'pill' }, '0 Züge');
    const grid = h('div', { class: 'mem' });
    const timers = [];
    deck.forEach(e => {
      const c = h('div', { class: 'card' }, h('span', { class: 'cb' }, '?'), h('span', { class: 'cf' }, e)); c.dataset.e = e;
      c.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        if (lock || c.classList.contains('open') || c.classList.contains('done')) return;
        c.classList.add('open'); sfx.pop();
        if (!first) { first = c; return; }
        moves++; mv.textContent = moves + (moves === 1 ? ' Zug' : ' Züge');
        if (first.dataset.e === c.dataset.e) {
          first.classList.replace('open', 'done'); c.classList.replace('open', 'done'); first = null; found++; sfx.happy();
          if (found === emojis.length) timers.push(setTimeout(() => {
            endGame('Memory', moves + ' Züge', Math.max(3, 20 - moves), startMemory);
          }, 600));
        } else {
          lock = true; const a = first; first = null;
          timers.push(setTimeout(() => { a.classList.remove('open'); c.classList.remove('open'); lock = false; }, 700));
        }
      });
      grid.append(c);
    });
    openPanel(h('div', { class: 'pcol' }, h('div', { class: 'ptitle' }, 'Memory', h('span', { class: 'grow' }), mv, xBtn()), grid));
    cleanup = () => timers.forEach(clearTimeout);
  }

  /* --- Rettich-Feld (Minesweeper): 8x8, 8 Käfer --- */
  function startSweeper() {
    const W = 8, H = 8, N = 8;
    const cells = [];
    let started = false, over = false, flagMode = false, flags = 0, opened = 0, t0 = 0, clockIv = null;
    const timers = [];
    const info = h('span', { class: 'pill' }, '🚩 ' + N);
    const clock = h('span', { class: 'pill' }, '0s');
    const modeBtn = h('button', { class: 'tab', onclick: () => {
      flagMode = !flagMode; modeBtn.textContent = flagMode ? '🚩' : '⛏️'; modeBtn.classList.toggle('on', flagMode);
    } }, '⛏️');
    const grid = h('div', { class: 'ms' });
    grid.addEventListener('contextmenu', e => e.preventDefault());

    const neigh = i => {
      const x = i % W, y = (i / W) | 0, r = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H) r.push(ny * W + nx);
      }
      return r;
    };
    const place = safe => {
      const forbid = new Set([safe, ...neigh(safe)]);
      const pool = [...Array(W * H).keys()].filter(i => !forbid.has(i));
      for (let k = 0; k < N; k++) { const j = Math.floor(Math.random() * pool.length); cells[pool.splice(j, 1)[0]].m = true; }
      cells.forEach((c, i) => { c.n = neigh(i).filter(j => cells[j].m).length; });
    };
    const paint = k => {
      const d = cells[k];
      d.el.className = 'cell open' + (d.n ? ' n' + d.n : '');
      d.el.textContent = d.n ? String(d.n) : '';
    };
    const toggleFlag = i => {
      const c = cells[i]; if (over || c.o) return;
      c.f = !c.f; flags += c.f ? 1 : -1;
      c.el.textContent = c.f ? '🚩' : '';
      info.textContent = '🚩 ' + (N - flags); sfx.click();
    };
    const lose = i => {
      over = true; clearInterval(clockIv);
      cells.forEach((c, k) => { if (c.m) { c.el.className = 'cell open mine' + (k === i ? ' boom' : ''); c.el.textContent = '🐛'; } });
      sfx.bad();
      timers.push(setTimeout(() => endGame('Rettich-Feld', 'Käfer erwischt! 🐛', 1, startSweeper), 1200));
    };
    const win = () => {
      over = true; clearInterval(clockIv);
      const secs = Math.round((now() - t0) / 1000);
      const coins = 15 + Math.max(0, 20 - Math.floor(secs / 5));
      sfx.happy();
      timers.push(setTimeout(() => endGame('Rettich-Feld', 'Gelöst in ' + secs + 's', coins, startSweeper), 600));
    };
    const reveal = i => {
      if (over) return;
      const c = cells[i]; if (c.o || c.f) return;
      if (!started) {
        started = true; place(i); t0 = now();
        clockIv = setInterval(() => { clock.textContent = Math.round((now() - t0) / 1000) + 's'; }, 1000);
      }
      if (c.m) { lose(i); return; }
      const st = [i];
      while (st.length) {
        const k = st.pop(), d = cells[k];
        if (d.o || d.f) continue;
        d.o = true; opened++; paint(k);
        if (d.n === 0) neigh(k).forEach(j => { if (!cells[j].o) st.push(j); });
      }
      sfx.pop();
      if (opened === W * H - N) win();
    };

    for (let i = 0; i < W * H; i++) {
      const el = h('div', { class: 'cell' });
      cells.push({ m: false, o: false, f: false, n: 0, el });
      let timer = null, long = false;
      const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
      el.addEventListener('pointerdown', e => {
        e.preventDefault(); long = false;
        timer = setTimeout(() => { long = true; toggleFlag(i); }, 420);
      });
      el.addEventListener('pointerup', () => {
        if (!timer) return;
        stop();
        if (!long) (flagMode ? toggleFlag(i) : reveal(i));
      });
      el.addEventListener('pointerleave', stop);
      el.addEventListener('pointercancel', stop);
      grid.append(el);
    }
    openPanel(h('div', { class: 'pcol' },
      h('div', { class: 'ptitle' }, 'Rettich-Feld', h('span', { class: 'grow' }), info, clock, modeBtn, xBtn()), grid));
    cleanup = () => { clearInterval(clockIv); timers.forEach(clearTimeout); };
  }

  /* --- Schnappschuss (Paparazzi) --- */
  const snapGame = {
    container: () => h('div', { class: 'snap' }),
    start(area, add) {
      const W = area.clientWidth, H = area.clientHeight;
      const fw = W * 0.4, fh = H * 0.5, fx = (W - fw) / 2, fy = (H - fh) / 2;
      const frame = h('div', { class: 'frame' });
      Object.assign(frame.style, { left: fx + 'px', top: fy + 'px', width: fw + 'px', height: fh + 'px' });
      const flash = h('div', { class: 'flash' });
      const hint = h('div', { class: 'hint2' }, '📸 Tippen, wenn ein Promi im Rahmen ist. Keine Fotobomber!');
      area.append(frame, flash, hint);
      setTimeout(() => { hint.style.opacity = '0'; }, 4500);

      const STARS = ['🕺', '💃', '🧑‍🎤', '🤵', '👸', '🦸', '🧛', '🤠'];
      const BOMBS = ['🐔', '🦆', '🐕'];
      let actors = [], last = performance.now(), raf = 0, spawnAt = 0, lastShot = 0;

      const spawn = () => {
        const bomb = Math.random() < 0.25, dir = Math.random() < 0.5 ? 1 : -1;
        const el = h('div', { class: 'actor' }, bomb ? pick(BOMBS) : pick(STARS));
        area.append(el);
        actors.push({ el, x: dir > 0 ? -40 : W + 8, y: rnd(8, Math.max(20, H - 44)), vx: dir * rnd(80, 150), bomb });
      };
      const loop = t => {
        const dt = Math.min(0.05, (t - last) / 1000); last = t;
        if (t >= spawnAt) { spawn(); spawnAt = t + rnd(700, 1200); }
        for (const a of actors) { a.x += a.vx * dt; a.el.style.transform = `translate(${a.x}px,${a.y}px)`; }
        actors = actors.filter(a => { if (a.x < -60 || a.x > W + 30) { a.el.remove(); return false; } return true; });
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      const shoot = e => {
        e.preventDefault();
        const t = performance.now(); if (t - lastShot < 300) return; lastShot = t;
        flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
        const cx0 = fx + fw / 2, cy0 = fy + fh / 2;
        let best = null, bomber = false;
        for (const a of actors) {
          const cx = a.x + 18, cy = a.y + 18;
          if (cx > fx && cx < fx + fw && cy > fy && cy < fy + fh) {
            if (a.bomb) bomber = true;
            else {
              const q = 1 - Math.max(Math.abs(cx - cx0) / (fw / 2), Math.abs(cy - cy0) / (fh / 2));
              if (!best || q > best.q) best = { q, a };
            }
          }
        }
        let pts, msg, col = '#fff';
        if (bomber) { pts = -10; msg = 'Fotobomber! −10'; col = '#ff8a80'; }
        else if (best) { pts = Math.round(10 + 20 * best.q); msg = '+' + pts + (best.q > 0.8 ? ' 🔥' : ''); col = '#b9f6ca'; }
        else { pts = -5; msg = 'Leer −5'; col = '#ff8a80'; }
        add(pts);
        const p = h('div', { class: 'pts' }, msg);
        p.style.left = (cx0 - 36) + 'px'; p.style.top = (cy0 - 10) + 'px'; p.style.color = col;
        area.append(p); setTimeout(() => p.remove(), 1000);
      };
      area.addEventListener('pointerdown', shoot);
      return () => cancelAnimationFrame(raf);
    }
  };
  const startSnap = () => timedGame('Schnappschuss', snapGame);

  /* --- Pixel-Maler: Bild merken, dann aus dem Gedächtnis nachmalen --- */
  const PAL = { r: '#e53935', g: '#43a047', y: '#fdd835', b: '#1e88e5', k: '#8d6e63', w: '#ffffff', p: '#ec407a' };
  const EMPTY = '#1c1008';
  const PATTERNS = [
    ['........', '.rr..rr.', 'rrrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rrrr..', '...rr...', '........'],
    ['..yyyy..', '.yyyyyy.', 'yykyykyy', 'yyyyyyyy', 'ykyyyyky', 'yykkkkyy', '.yyyyyy.', '..yyyy..'],
    ['..rrrr..', '.rrwwrr.', 'rrwwrrrr', 'rrrrrwwr', 'rrrrrrrr', '..wwww..', '..wwww..', '..wwww..'],
    ['..g..g..', '...gg...', '..wwww..', '.wwwwww.', '.wkwwkw.', '.wwwwww.', '..wkkw..', '...ww...'],
    ['...rr...', '..rrrr..', '.rrrrrr.', 'rrrrrrrr', '.wwwwww.', '.wwbbww.', '.wwbbww.', '.wwbbww.']
  ];
  let lastPixel = -1;
  function startPixel() {
    let idx; do { idx = Math.floor(Math.random() * PATTERNS.length); } while (idx === lastPixel);
    lastPixel = idx;
    const pat = PATTERNS[idx].join('').split('');
    const painted = Array(64).fill('.');
    const colorOf = ch => ch === '.' ? EMPTY : PAL[ch];
    let phase = 'show', cur = 'r', down = false;
    const timers = [];

    const info = h('span', { class: 'pill' }, '👀 5');
    const doneBtn = h('button', { class: 'cta hidden', onclick: () => finish() }, 'Fertig');
    doneBtn.style.padding = '3px 12px';
    const grid = h('div', { class: 'px' });
    const cellsEl = [];
    for (let i = 0; i < 64; i++) { const el = h('i'); cellsEl.push(el); grid.append(el); }
    const wrap = h('div', { class: 'px-wrap' }, grid);

    const swatches = [];
    const pal = h('div', { class: 'pal', style: 'visibility:hidden' }, [...Object.keys(PAL), '.'].map(ch => {
      const b = h('button', { class: 'sw' + (ch === cur ? ' on' : ''), style: 'background:' + (ch === '.' ? EMPTY : PAL[ch]), onclick: () => {
        cur = ch; swatches.forEach(s => s.b.classList.toggle('on', s.ch === ch)); sfx.click();
      } }, ch === '.' ? '✖' : '');
      swatches.push({ ch, b });
      return b;
    }));

    openPanel(h('div', { class: 'pcol' },
      h('div', { class: 'ptitle' }, 'Pixel-Maler', h('span', { class: 'grow' }), info, doneBtn, xBtn()), wrap, pal));
    const size = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight));
    grid.style.width = grid.style.height = size + 'px';

    const showTarget = () => cellsEl.forEach((el, i) => { el.style.background = colorOf(pat[i]); });
    const showPainted = () => cellsEl.forEach((el, i) => { el.style.background = colorOf(painted[i]); });
    showTarget();

    let left = 5;
    const iv = setInterval(() => {
      left--;
      if (left > 0) { info.textContent = '👀 ' + left; return; }
      clearInterval(iv);
      phase = 'paint'; showPainted();
      info.textContent = '🖌️'; pal.style.visibility = 'visible'; doneBtn.classList.remove('hidden');
      sfx.click();
    }, 1000);
    timers.push(iv);

    const paintAt = e => {
      const r = grid.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / r.width * 8), y = Math.floor((e.clientY - r.top) / r.height * 8);
      if (x < 0 || x > 7 || y < 0 || y > 7) return;
      const i = y * 8 + x; painted[i] = cur; cellsEl[i].style.background = colorOf(cur);
    };
    grid.addEventListener('pointerdown', e => {
      if (phase !== 'paint') return;
      e.preventDefault(); down = true;
      try { grid.setPointerCapture(e.pointerId); } catch (_) {}
      paintAt(e);
    });
    grid.addEventListener('pointermove', e => { if (down && phase === 'paint') paintAt(e); });
    grid.addEventListener('pointerup', () => { down = false; });
    grid.addEventListener('pointercancel', () => { down = false; });

    function finish() {
      if (phase !== 'paint') return;
      phase = 'done';
      let correct = 0, tc = 0, extra = 0;
      for (let i = 0; i < 64; i++) {
        if (pat[i] !== '.') { tc++; if (painted[i] === pat[i]) correct++; }
        else if (painted[i] !== '.') extra++;
      }
      const score = Math.round(100 * correct / (tc + extra));
      showTarget(); pal.style.visibility = 'hidden'; doneBtn.classList.add('hidden');
      info.textContent = score + '% Treffer';
      timers.push(setTimeout(() => endGame('Pixel-Maler', score + '% Treffer', Math.round(score / 4), startPixel), 1800));
    }
    cleanup = () => timers.forEach(t => { clearTimeout(t); clearInterval(t); });
  }

  /* --- Farbmischer: Zielfarbe per RGB-Reglern treffen, 5 Runden --- */
  function startMixer() {
    const ROUNDS = 5;
    let round = 0, total = 0, locked = false, target = [0, 0, 0];
    const timers = [];
    const swT = h('div', { class: 'mix-sw' }, 'Ziel'), swY = h('div', { class: 'mix-sw' }, 'Du');
    const info = h('span', { class: 'pill' }, '1/' + ROUNDS);
    const fb = h('span', { class: 'fb' }, '');
    const inputs = [], vals = [];
    const css = a => `rgb(${a[0]},${a[1]},${a[2]})`;
    const cur = () => inputs.map(i => +i.value);
    const paintYou = () => { swY.style.background = css(cur()); };
    const rows = [['r', 'R'], ['g', 'G'], ['b', 'B']].map(([k, l]) => {
      const inp = h('input', { type: 'range', min: '0', max: '255', value: '128' });
      const v = h('b', {}, '128');
      inp.addEventListener('input', () => { v.textContent = inp.value; paintYou(); });
      inputs.push(inp); vals.push(v);
      return h('div', { class: 'sl ' + k }, h('span', {}, l), inp, v);
    });
    const next = () => {
      round++;
      target = [0, 0, 0].map(() => Math.floor(rnd(15, 241)));
      swT.style.background = css(target);
      inputs.forEach((i, k) => { i.value = 128; vals[k].textContent = '128'; });
      paintYou();
      info.textContent = round + '/' + ROUNDS; fb.textContent = ''; locked = false;
    };
    const okBtn = h('button', { class: 'cta', onclick: () => {
      if (locked) return; locked = true;
      const c = cur();
      const dist = Math.hypot(c[0] - target[0], c[1] - target[1], c[2] - target[2]);
      const score = Math.max(0, Math.round(100 - dist / 1.8));
      total += score; sfx.pop();
      fb.textContent = 'Abweichung ' + Math.round(dist) + ' → ' + score + ' Pkt';
      timers.push(setTimeout(() => {
        if (round >= ROUNDS) { const avg = Math.round(total / ROUNDS); endGame('Farbmischer', avg + '% Treffer', Math.round(avg / 5), startMixer); }
        else next();
      }, 1300));
    } }, 'Passt!');
    okBtn.style.padding = '6px 18px';
    openPanel(h('div', { class: 'pcol' },
      h('div', { class: 'ptitle' }, 'Farbmischer', h('span', { class: 'grow' }), info, xBtn()),
      h('div', { class: 'mix-row' }, swT, swY),
      rows,
      h('div', { class: 'mix-act' }, fb, okBtn)));
    cleanup = () => timers.forEach(clearTimeout);
    next();
  }

  /* ---------- Zeichnen ---------- */
  let anim = 0, dpr = 1;
  const view = { y: 0.52, s: 1 };
  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(stage.clientWidth * dpr);
    canvas.height = Math.round(stage.clientHeight * dpr);
  }
  new ResizeObserver(resize).observe(stage); resize();

  const BROWN = '#5A4033';
  function outline(fill, lw = 3.5) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = BROWN; ctx.lineJoin = 'round'; ctx.stroke(); }
  function rrect(x, y, w, hh, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function bodyPath() {
    ctx.beginPath();
    ctx.moveTo(-32, 20);
    ctx.bezierCurveTo(-44, -10, -35, -45, 0, -45);
    ctx.bezierCurveTo(35, -45, 44, -10, 32, 20);
    ctx.bezierCurveTo(25, 46, -25, 46, -32, 20);
    ctx.closePath();
  }
  function heart(x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.8);
    ctx.bezierCurveTo(x - s * 1.3, y - s * 0.1, x - s * 0.5, y - s * 1.0, x, y - s * 0.3);
    ctx.bezierCurveTo(x + s * 0.5, y - s * 1.0, x + s * 1.3, y - s * 0.1, x, y + s * 0.8);
    ctx.closePath();
  }

  function drawHat(id) {
    ctx.save();
    switch (id) {
      case 'party': {
        ctx.beginPath(); ctx.moveTo(-19, -40); ctx.lineTo(0, -90); ctx.lineTo(19, -40); ctx.closePath(); outline('#ff6fa5');
        ctx.fillStyle = '#ffe14d';
        [[-6, -52], [5, -62], [0, -48], [-2, -72]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); });
        ctx.beginPath(); ctx.arc(0, -91, 5.5, 0, 7); outline('#ffe14d', 3);
        break;
      }
      case 'chef': {
        [[-14, -62, 12], [14, -62, 12], [0, -70, 14]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); outline('#fff'); });
        rrect(-21, -54, 42, 14, 4); outline('#fff');
        break;
      }
      case 'cowboy': {
        ctx.beginPath(); ctx.ellipse(0, -42, 42, 9, 0, 0, 7); outline('#b07a3c');
        ctx.beginPath(); ctx.moveTo(-21, -44); ctx.bezierCurveTo(-25, -80, -6, -70, 0, -68); ctx.bezierCurveTo(6, -70, 25, -80, 21, -44); ctx.closePath(); outline('#c78d4a');
        ctx.beginPath(); ctx.moveTo(-21, -50); ctx.quadraticCurveTo(0, -44, 21, -50); ctx.lineWidth = 5; ctx.strokeStyle = '#7a3b1d'; ctx.stroke();
        break;
      }
      case 'propeller': {
        ctx.beginPath(); ctx.arc(0, -42, 25, Math.PI, 0); ctx.closePath(); outline('#3b82f6');
        ctx.beginPath(); ctx.moveTo(-8, -66); ctx.lineTo(-4, -43); ctx.moveTo(8, -66); ctx.lineTo(4, -43); ctx.lineWidth = 3; ctx.strokeStyle = '#facc15'; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -68, 3.5, 0, 7); outline('#ef4444', 3);
        ctx.save(); ctx.translate(0, -73); ctx.scale(Math.cos(anim * 14), 1);
        ctx.beginPath(); ctx.ellipse(-14, 0, 14, 3.5, 0, 0, 7); outline('#ef4444', 2.5);
        ctx.beginPath(); ctx.ellipse(14, 0, 14, 3.5, 0, 0, 7); outline('#facc15', 2.5);
        ctx.restore();
        break;
      }
      case 'tophat': {
        ctx.beginPath(); ctx.ellipse(0, -43, 31, 7, 0, 0, 7); outline('#2d2d34');
        ctx.beginPath(); ctx.rect(-19, -84, 38, 42); outline('#2d2d34');
        ctx.beginPath(); ctx.ellipse(0, -84, 19, 5, 0, 0, 7); outline('#3b3b45');
        ctx.beginPath(); ctx.rect(-19, -54, 38, 9); outline('#c0392b', 3);
        break;
      }
      case 'crown': {
        ctx.beginPath(); ctx.moveTo(-21, -42); ctx.lineTo(-24, -70); ctx.lineTo(-11, -57); ctx.lineTo(0, -76); ctx.lineTo(11, -57); ctx.lineTo(24, -70); ctx.lineTo(21, -42); ctx.closePath(); outline('#ffd23f');
        [[0, -52, '#ef4444'], [-12, -49, '#3b82f6'], [12, -49, '#22c55e']].forEach(([x, y, c]) => { ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); outline(c, 2); });
        break;
      }
    }
    ctx.restore();
  }

  /* Outfit hinter dem Körper (Umhang) */
  function drawCapeBack() {
    const sw = Math.sin(anim * 2) * 3;
    ctx.beginPath(); ctx.moveTo(-26, -28); ctx.lineTo(-58 + sw, 52); ctx.quadraticCurveTo(0, 66, 58 - sw, 52); ctx.lineTo(26, -28); ctx.closePath();
    outline('#d32f2f', 3.5);
  }

  /* Outfit auf dem Körper (auf die Körperform beschnitten) */
  function drawOutfit(id) {
    if (!id) return;
    ctx.save(); bodyPath(); ctx.clip();
    switch (id) {
      case 'lederhose': {
        ctx.fillStyle = '#8a5a2e'; ctx.fillRect(-50, 15, 100, 40);
        ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-50, 15); ctx.lineTo(50, 15); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 34); ctx.lineTo(0, 50); ctx.stroke();   // Naht zwischen den Beinen
        // Hosenträger (grün, mit Quersteg über dem Latz)
        ctx.strokeStyle = '#3f7d3a'; ctx.lineWidth = 6; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(-13, 17); ctx.lineTo(-29, -24); ctx.moveTo(13, 17); ctx.lineTo(29, -24); ctx.stroke();
        ctx.strokeStyle = '#2d5f2a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-13, 17); ctx.lineTo(-29, -24); ctx.moveTo(13, 17); ctx.lineTo(29, -24); ctx.stroke();
        // Latz
        rrect(-15, 14, 30, 19, 4); ctx.fillStyle = '#a0703c'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#5a3a1c'; ctx.stroke();
        ctx.fillStyle = '#3f7d3a'; ctx.fillRect(-15, 14, 30, 4);
        // Edelweiß
        ctx.fillStyle = '#fff';
        for (let a = 0; a < 6; a++) { ctx.beginPath(); ctx.arc(Math.cos(a * 1.047) * 4, 25 + Math.sin(a * 1.047) * 4, 2.2, 0, 7); ctx.fill(); }
        ctx.beginPath(); ctx.arc(0, 25, 2, 0, 7); ctx.fillStyle = '#ffd23f'; ctx.fill();
        break;
      }
      case 'dirndl': {
        ctx.fillStyle = '#2f6db5'; ctx.fillRect(-50, 12, 100, 45);
        ctx.beginPath(); ctx.moveTo(-17, 17); ctx.lineTo(17, 17); ctx.lineTo(27, 52); ctx.lineTo(-27, 52); ctx.closePath();
        ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#c0392b'; ctx.stroke();
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.ellipse(-6, 17, 6, 3.5, -0.4, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(6, 17, 6, 3.5, 0.4, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 17, 2.5, 0, 7); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-30, 14); ctx.lineTo(30, 14); ctx.stroke();
        break;
      }
      case 'hawaii': {
        ctx.fillStyle = '#f06a4d'; ctx.fillRect(-50, 12, 100, 45);
        [[-22, 24, 4, '#ffe14d'], [-8, 36, 4.5, '#fff'], [10, 23, 3.5, '#ffd1dc'], [23, 35, 4, '#ffe14d'], [0, 44, 3, '#fff'], [-26, 40, 3, '#ffd1dc'], [14, 44, 3, '#ffe14d']]
          .forEach(([x, y, r, c]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = c; ctx.fill(); });
        ctx.fillStyle = '#2e9e5b';
        [[-14, 28], [4, 32], [18, 28], [-4, 42]].forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x, y, 4, 2, 0.6, 0, 7); ctx.fill(); });
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(-12, 12); ctx.lineTo(0, 24); ctx.lineTo(-3, 12); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(12, 12); ctx.lineTo(0, 24); ctx.lineTo(3, 12); ctx.closePath(); ctx.fill();
        break;
      }
      case 'suit': {
        ctx.fillStyle = '#2d3748'; ctx.fillRect(-50, 12, 100, 45);
        ctx.beginPath(); ctx.moveTo(-11, 12); ctx.lineTo(11, 12); ctx.lineTo(0, 34); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = '#1a202c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-11, 12); ctx.lineTo(-4, 34); ctx.lineTo(-14, 50); ctx.moveTo(11, 12); ctx.lineTo(4, 34); ctx.lineTo(14, 50); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-3, 14); ctx.lineTo(3, 14); ctx.lineTo(5, 33); ctx.lineTo(0, 39); ctx.lineTo(-5, 33); ctx.closePath(); ctx.fillStyle = '#c0392b'; ctx.fill();
        break;
      }
      case 'cape': {
        // Spangen vorn am Hals
        ctx.fillStyle = '#ffd23f';
        [[-27, -20], [27, -20]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = BROWN; ctx.stroke(); });
        break;
      }
    }
    ctx.restore();
    bodyPath(); ctx.lineWidth = 4; ctx.strokeStyle = BROWN; ctx.lineJoin = 'round'; ctx.stroke();
  }

  function drawGlasses(id) {
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const legs = c => { ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-25, -11); ctx.lineTo(-34, -13); ctx.moveTo(25, -11); ctx.lineTo(34, -13); ctx.stroke(); };
    switch (id) {
      case 'nerd': {
        [-14, 14].forEach(x => { ctx.beginPath(); ctx.arc(x, -9, 9, 0, 7); ctx.fillStyle = 'rgba(180,220,255,.35)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#222'; ctx.stroke(); });
        ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(5, -10); ctx.stroke();
        legs('#222');
        break;
      }
      case 'sun': {
        ctx.fillStyle = '#111';
        rrect(-25, -17, 21, 14, 5); ctx.fill(); rrect(4, -17, 21, 14, 5); ctx.fill();
        ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(4, -12); ctx.stroke();
        legs('#111');
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-21, -14); ctx.lineTo(-16, -14); ctx.moveTo(8, -14); ctx.lineTo(13, -14); ctx.stroke();
        break;
      }
      case 'heart': {
        [-14, 14].forEach(x => { heart(x, -9, 9.5); ctx.fillStyle = '#ff4d88'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#7a1f45'; ctx.stroke(); });
        ctx.strokeStyle = '#7a1f45'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-5, -12); ctx.lineTo(5, -12); ctx.stroke();
        legs('#7a1f45');
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        [-18, 10].forEach(x => { ctx.beginPath(); ctx.arc(x, -12, 1.8, 0, 7); ctx.fill(); });
        break;
      }
      case 'threed': {
        rrect(-25, -17, 21, 15, 3); ctx.fillStyle = 'rgba(229,57,53,.85)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
        rrect(4, -17, 21, 15, 3); ctx.fillStyle = 'rgba(0,188,212,.85)'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(4, -12); ctx.stroke();
        legs('#fff');
        break;
      }
      case 'monocle': {
        ctx.beginPath(); ctx.arc(14, -9, 10, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#d4a017'; ctx.stroke();
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(23, -4); ctx.quadraticCurveTo(36, 8, 29, 28); ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  function drawKohlbert() {
    const w = stage.clientWidth, hh = stage.clientHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    anim += 0.05;
    if (act.name && now() > act.until) act.name = null;
    const a = act.name;

    // Ansicht: bei offenem Shop rückt Kohlbert nach oben und wird kleiner
    let tv = { y: 0.52, s: 1 };
    if (shopOpen) {                       // oberer Bereich (44%) minus Platz für die Sprechblase
      const s = Math.max(0.5, Math.min(0.85, (hh * 0.44 - 46) / 137));
      tv = { y: (42 + 91 * s) / hh, s };
    }
    view.y += (tv.y - view.y) * 0.18; view.s += (tv.s - view.s) * 0.18;

    let bounce = 0, rot = 0, eyes = 'normal', mouth = 'smile';
    if (S.sleeping) { bounce = Math.sin(anim * .8) * 2; eyes = 'sleeping'; mouth = 'sleeping'; }
    else if (a === 'pet') { bounce = -Math.abs(Math.sin(anim * 4) * 15); rot = Math.sin(anim * 3) * .1; eyes = 'happy'; mouth = 'open_big'; }
    else if (a === 'eating' || a === 'drinking') { bounce = Math.sin(anim * 5) * 4; mouth = Math.sin(anim * 6) > 0 ? 'open' : 'smile'; }
    else if (S.hunger < 30 || S.happy < 30 || S.clean < 25) { bounce = Math.sin(anim * 1.2); eyes = 'sad'; mouth = 'sad'; }
    else { bounce = Math.sin(anim * 2) * 4; rot = Math.sin(anim) * .03; }

    ctx.save();
    ctx.translate(w / 2, hh * view.y);
    ctx.scale(view.s, view.s);
    ctx.translate(0, bounce);

    // Schatten (bleibt am Boden)
    ctx.save(); ctx.translate(0, -bounce);
    ctx.beginPath(); ctx.ellipse(0, 50, 42 - Math.abs(bounce) * .5, 9, 0, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fill();
    ctx.restore();
    ctx.rotate(rot);

    // Umhang (hinter allem)
    if (S.outfit === 'cape') drawCapeBack();

    // Blätter (nur ohne Hut und ohne Schlafmütze)
    if (!S.hat && !S.sleeping) {
      ctx.save(); ctx.translate(0, -42);
      ctx.save(); ctx.rotate(-.2 + Math.sin(anim * 2) * .05);
      ctx.beginPath(); ctx.ellipse(-12, -22, 11, 24, -.3, 0, 7); outline('#A8C97F');
      ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(-14, -32); ctx.strokeStyle = 'rgba(90,64,51,.4)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.rotate(.35 + Math.cos(anim * 2) * .05);
      ctx.beginPath(); ctx.ellipse(10, -20, 10, 22, .4, 0, 7); outline('#94B96B');
      ctx.beginPath(); ctx.moveTo(8, -5); ctx.lineTo(12, -30); ctx.strokeStyle = 'rgba(90,64,51,.4)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      ctx.restore();
    }

    // Körper + Outfit
    bodyPath(); outline('#FFFDF9', 4);
    drawOutfit(S.outfit);

    // Hände
    ctx.beginPath(); (a === 'pet') ? ctx.arc(-37, -12, 6, 0, 7) : ctx.arc(-34, 5, 6, 0, 7); outline('#FFFDF9');
    ctx.beginPath(); (a === 'eating' || a === 'drinking') ? ctx.arc(20, 10, 6, 0, 7) : ctx.arc(34, 5, 6, 0, 7); outline('#FFFDF9');

    // Wangen
    ctx.fillStyle = 'rgba(255,154,162,.6)';
    ctx.beginPath(); ctx.ellipse(-20, 0, 7, 4, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(20, 0, 7, 4, 0, 0, 7); ctx.fill();

    // Augen
    ctx.fillStyle = BROWN; ctx.strokeStyle = BROWN; ctx.lineWidth = 3; ctx.lineCap = 'round';
    if (eyes === 'sleeping') { ctx.beginPath(); ctx.arc(-14, -8, 4, 0, Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(14, -8, 4, 0, Math.PI); ctx.stroke(); }
    else if (eyes === 'happy') { ctx.beginPath(); ctx.arc(-14, -7, 5, Math.PI + .2, -.2); ctx.stroke(); ctx.beginPath(); ctx.arc(14, -7, 5, Math.PI + .2, -.2); ctx.stroke(); }
    else if (eyes === 'sad') { ctx.beginPath(); ctx.arc(-14, -6, 4, Math.PI + .3, -.3); ctx.stroke(); ctx.beginPath(); ctx.arc(14, -6, 4, Math.PI + .3, -.3); ctx.stroke(); }
    else {
      ctx.beginPath(); ctx.arc(-14, -9, 4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(14, -9, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-15, -11, 1.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(13, -11, 1.5, 0, 7); ctx.fill();
    }

    // Brille
    if (S.glasses) drawGlasses(S.glasses);

    // Mund
    ctx.strokeStyle = BROWN; ctx.fillStyle = '#E56B70'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    if (mouth === 'sleeping') { ctx.beginPath(); ctx.arc(0, 4, 3, 0, 7); ctx.fillStyle = BROWN; ctx.fill(); }
    else if (mouth === 'open_big') { ctx.beginPath(); ctx.arc(0, 2, 7, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (mouth === 'open') { ctx.beginPath(); ctx.arc(0, 3, 4, 0, 7); ctx.fillStyle = BROWN; ctx.fill(); }
    else if (mouth === 'sad') { ctx.beginPath(); ctx.arc(0, 9, 5, Math.PI + .4, -.4); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(0, 0, 5, .2, Math.PI - .2); ctx.stroke(); }

    // Items
    if (a === 'eating') { ctx.font = '22px sans-serif'; ctx.fillText('🥨', 10, 18); }
    else if (a === 'drinking') { ctx.font = '20px sans-serif'; ctx.fillText('☕', 12, 16); }

    // Hut / Schlafmütze
    if (S.sleeping) {
      ctx.save(); ctx.translate(-3, -44); ctx.rotate(-.2);
      ctx.beginPath(); ctx.moveTo(-25, 5); ctx.quadraticCurveTo(-10, -35, 25, -5); ctx.quadraticCurveTo(5, -5, -25, 5); outline('#4A6FA5', 3);
      ctx.beginPath(); ctx.arc(-24, 5, 6, 0, 7); outline('#fff', 3);
      ctx.restore();
    } else if (S.hat) drawHat(S.hat);

    ctx.restore();
    requestAnimationFrame(drawKohlbert);
  }

  /* ---------- Benachrichtigungen ---------- */
  let swReg = null;
  function pushStateToSW() {
    try { const sw = (swReg && swReg.active) || navigator.serviceWorker.controller; if (sw) sw.postMessage({ type: 'state', state: S }); } catch (e) {}
  }
  async function notify(title, body, tag) {
    try {
      const reg = swReg || await navigator.serviceWorker.ready;
      await reg.showNotification(title, { body, tag, icon: 'icon-192.png', badge: 'icon-192.png', renotify: true });
    } catch (e) { try { new Notification(title, { body, icon: 'icon-192.png' }); } catch (_) {} }
  }
  function checkAlerts(woke) {
    if (!S.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
    const a = KB.due(Object.assign({}, S, { __woke: !!woke }), now());
    if (!a) return;
    S.lastNotify[a.id] = now(); save();
    notify(a.title, a.body, 'kohlbert-' + a.id);
  }
  async function toggleNotify() {
    if (S.notify) { S.notify = false; save(); updateUI(); return say('Alerts aus'); }
    if (!('Notification' in window)) return say('Alerts hier nicht möglich', 3000);
    let p = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission();
    if (p !== 'granted') { S.notify = false; updateUI(); return say('Alerts blockiert', 3000); }
    S.notify = true; save(); updateUI();
    try {
      const reg = swReg || await navigator.serviceWorker.ready;
      if ('periodicSync' in reg) await reg.periodicSync.register('kohlbert-check', { minInterval: 60 * 60 * 1000 });
    } catch (e) {}
    pushStateToSW();
    notify('Alerts aktiv 🔔', 'Ich melde mich, wenn Kohlbert etwas braucht.', 'kohlbert-welcome');
    say('Alerts an!');
  }
  $('#btnBell').addEventListener('click', toggleNotify);
  $('#btnSound').addEventListener('click', () => { S.muted = !S.muted; save(); updateUI(); if (!S.muted) sfx.happy(); });

  /* ---------- Start ---------- */
  if ('serviceWorker' in navigator) {
    // Neuer Service Worker übernimmt: Seite einmal neu laden, damit die neue Version läuft
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true; save(); location.reload();
    });
    navigator.serviceWorker.register('sw.js').then(r => { swReg = r; pushStateToSW(); }).catch(() => {});
  }
  const awayMs = now() - S.last;
  advance(now());
  renderPoops(); updateUI(); save();
  drawKohlbert();
  setTimeout(() => {
    if (awayMs > 30 * 60 * 1000) say(S.hunger < 30 ? 'Da bist du ja! Hunger!' : (isMorning() ? greet() : 'Da bist du ja!'), 3000);
    else say('Moin! Ich bin Kohlbert!');
    sfx.happy();
  }, 500);
})();
