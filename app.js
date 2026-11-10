(() => {
  'use strict';

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
    coins: 25, hats: [], hat: null,
    muted: false, notify: false, lastNotify: {}
  });
  function load() {
    try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY)) || {}); }
    catch (e) { return defaults(); }
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  const HATS = [
    { id: null,        name: 'Ohne',       emoji: '🌱', price: 0 },
    { id: 'party',     name: 'Partyhut',   emoji: '🎉', price: 20 },
    { id: 'chef',      name: 'Kochmütze',  emoji: '👨‍🍳', price: 35 },
    { id: 'cowboy',    name: 'Cowboy',     emoji: '🤠', price: 50 },
    { id: 'propeller', name: 'Propeller',  emoji: '🚁', price: 70 },
    { id: 'tophat',    name: 'Zylinder',   emoji: '🎩', price: 90 },
    { id: 'crown',     name: 'Krone',      emoji: '👑', price: 150 }
  ];

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
    sad()   { this.tone(300, 'sawtooth', .15); this.tone(250, 'sawtooth', .25, .15); }
  };

  /* ---------- Elements ---------- */
  const stage = $('#stage'), canvas = $('#canvas'), ctx = canvas.getContext('2d');
  const poopLayer = $('#poopLayer'), speech = $('#speech'), panel = $('#panel'), lcd = $('#lcd');
  const bars = { hunger: ['#bHunger', '#vHunger'], happy: ['#bHappy', '#vHappy'], energy: ['#bEnergy', '#vEnergy'], clean: ['#bClean', '#vClean'] };
  Object.keys(bars).forEach(k => bars[k] = bars[k].map($));

  /* ---------- Sprechblase / Partikel ---------- */
  let speechTimer = null;
  function say(text, ms = 2200) {
    speech.textContent = text; speech.classList.remove('hidden');
    // Animation neu starten
    speech.style.animation = 'none'; void speech.offsetWidth; speech.style.animation = '';
    clearTimeout(speechTimer);
    speechTimer = setTimeout(() => speech.classList.add('hidden'), ms);
  }
  function particles(emoji, n = 4) {
    const w = stage.clientWidth, hgt = stage.clientHeight;
    for (let i = 0; i < n; i++) {
      const p = h('div', { class: 'particle' }, emoji);
      p.style.left = (w / 2 + rnd(-40, 40)) + 'px';
      p.style.top = (hgt * 0.5 + rnd(-25, 25)) + 'px';
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
    if (woke) { renderPoops(); say('Moin! Ausgeschlafen ☀️'); sfx.happy(); }
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

  /* ---------- Aktionen ---------- */
  let act = { name: null, until: 0 };
  function doAct(name, ms) { act = { name, until: now() + ms }; }

  function feed(kind) {
    if (S.sleeping) return say('Kohlbert schläft!');
    if (kind === 'pretzel') {
      if (S.hunger > 97) { sfx.sad(); return say('Ich bin satt!'); }
      S.hunger = clamp(S.hunger + 25); S.happy = clamp(S.happy + 5);
      doAct('eating', 2000); sfx.eat(); particles('🥨', 3);
      say(pick(['Mahlzeit!', 'Lecker!', 'Mmh, Brezel!', 'Köstlich!']));
      if (Math.random() < 0.5 && !S.poopDue) S.poopDue = now() + rnd(60, 180) * 1000;
    } else {
      if (S.energy > 97) { sfx.sad(); return say('Bin hellwach!'); }
      S.energy = clamp(S.energy + 30); S.hunger = clamp(S.hunger + 5);
      doAct('drinking', 2000); sfx.eat(); particles('☕', 3);
      say(pick(['Kaffee!', 'Wach!', 'Zisch! ☕']));
    }
    updateUI(); save();
  }
  $('#btnFeed').addEventListener('click', () => feed('pretzel'));
  $('#btnPretzel').addEventListener('click', () => feed('pretzel'));
  $('#btnCoffee').addEventListener('click', () => feed('coffee'));

  $('#btnSleep').addEventListener('click', () => {
    S.sleeping = !S.sleeping;
    if (S.sleeping) { closePanel(); say('Gute Nacht! N8'); sfx.sleep(); }
    else { say(pick(['Moin!', 'Moin moin!', 'Na du?'])); sfx.happy(); }
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
    say(pick(['Geil!', 'Super!', 'Juhu!', 'Danke!', 'Servus!']));
    updateUI(); save();
  });

  /* ---------- Panels ---------- */
  let cleanup = null;
  function closePanel() {
    if (cleanup) { const c = cleanup; cleanup = null; c(); }
    panel.classList.add('hidden'); panel.replaceChildren();
  }
  function openPanel(node) {
    if (cleanup) { const c = cleanup; cleanup = null; c(); }
    panel.replaceChildren(node); panel.classList.remove('hidden');
  }
  const xBtn = () => h('button', { class: 'x', onclick: () => closePanel() }, '✕');

  /* ---------- Hüte ---------- */
  function openHats() {
    const cards = HATS.map(hat => {
      const owned = hat.id === null || S.hats.includes(hat.id);
      const on = S.hat === hat.id;
      const sub = on ? 'Getragen ✓' : owned ? 'Aufsetzen' : '🪙 ' + hat.price;
      return h('button', {
        class: 'hat' + (on ? ' on' : ''),
        onclick: () => {
          if (owned) { S.hat = hat.id; sfx.happy(); say(hat.id ? 'Schicker Hut!' : 'Ohne Hut'); }
          else if (S.coins >= hat.price) { S.coins -= hat.price; S.hats.push(hat.id); S.hat = hat.id; sfx.happy(); particles('✨', 4); say('Neuer Hut!'); }
          else { sfx.sad(); say('Zu wenig Münzen'); return; }
          save(); updateUI(); openHats();
        }
      }, h('span', { class: 'e' }, hat.emoji), hat.name, h('small', {}, sub));
    });
    openPanel(h('div', { class: 'pcol' },
      h('div', { class: 'ptitle' }, 'Hüte', h('span', { class: 'pill' }, '🪙 ' + S.coins), xBtn()),
      h('div', { class: 'shop' }, cards)));
  }
  $('#btnHats').addEventListener('click', openHats);

  /* ---------- Minispiele ---------- */
  function openGames() {
    if (S.sleeping) return say('Kohlbert schläft!');
    if (S.energy < 15) { sfx.sad(); return say('Zu müde zum Spielen...'); }
    const gb = (e, t, sub, fn) => h('button', { class: 'menu-btn', onclick: fn }, h('span', { class: 'e' }, e), h('span', {}, h('b', {}, t), h('small', {}, sub)));
    openPanel(h('div', { class: 'pcol' },
      h('div', { class: 'ptitle' }, 'Minispiele', xBtn()),
      gb('🍃', 'Blätter fangen', 'Fang Blätter, weich den Steinen aus', startLeaves),
      gb('🔨', 'Rettich-Klopfen', 'Hau auf Sprossen, nicht auf Käfer', startWhack),
      gb('🃏', 'Memory', 'Finde alle Paare mit wenig Zügen', startMemory)));
  }
  $('#btnPlay').addEventListener('click', openGames);

  function endGame(title, score, coins, again) {
    S.coins += coins;
    S.happy = clamp(S.happy + 8 + Math.min(20, coins));
    S.energy = clamp(S.energy - 10);
    save(); updateUI(); sfx.happy();
    openPanel(h('div', { class: 'pcol' },
      h('div', { class: 'ptitle' }, title, xBtn()),
      h('div', { class: 'center' },
        h('div', { class: 'big' }, coins > 0 ? '🎉' : '😅'),
        h('div', {}, score + ' Punkte'),
        h('div', {}, '🪙 +' + coins),
        h('div', {}, h('button', { class: 'cta', onclick: () => (S.energy < 15 ? (closePanel(), say('Zu müde...')) : again()) }, 'Nochmal'), ' ',
          h('button', { class: 'cta alt', onclick: () => closePanel() }, 'Fertig')))));
  }

  function timedGame(title, build) {
    let score = 0, time = 30;
    const sc = h('span', { class: 'pill' }, '0 Pkt'), tm = h('span', { class: 'pill' }, time + 's');
    const area = build.container();
    openPanel(h('div', { class: 'pcol' }, h('div', { class: 'ptitle' }, title, h('span', { class: 'grow' }), sc, tm, xBtn()), area));
    const add = n => { score += n; sc.textContent = score + ' Pkt'; (n > 0 ? sfx.pop() : sfx.bad()); };
    const stopFns = build.start(area, add);
    const t = setInterval(() => {
      time--; tm.textContent = time + 's';
      if (time <= 0) { const s = Math.max(0, score); cleanup && (cleanup(), cleanup = null); endGame(title, s, Math.floor(s / 10), () => timedGame(title, build)); }
    }, 1000);
    cleanup = () => { clearInterval(t); stopFns(); };
  }

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

  function startMemory() {
    const emojis = ['🥨', '☕', '🍃', '🎩', '👑', '🌱'];
    const deck = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
    let first = null, lock = false, moves = 0, found = 0;
    const mv = h('span', { class: 'pill' }, '0 Züge');
    const grid = h('div', { class: 'mem' });
    const timers = [];
    deck.forEach(e => {
      const c = h('div', { class: 'card' }, e); c.dataset.e = e;
      c.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        if (lock || c.classList.contains('open') || c.classList.contains('done')) return;
        c.classList.add('open'); sfx.pop();
        if (!first) { first = c; return; }
        moves++; mv.textContent = moves + ' Züge';
        if (first.dataset.e === c.dataset.e) {
          first.classList.replace('open', 'done'); c.classList.replace('open', 'done'); first = null; found++; sfx.happy();
          if (found === emojis.length) timers.push(setTimeout(() => {
            const coins = Math.max(3, 20 - moves);
            endGame('Memory', moves + ' Züge', coins, startMemory);
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

  /* ---------- Zeichnen ---------- */
  let anim = 0, dpr = 1;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(stage.clientWidth * dpr);
    canvas.height = Math.round(stage.clientHeight * dpr);
  }
  new ResizeObserver(resize).observe(stage); resize();

  const BROWN = '#5A4033';
  function outline(fill, lw = 3.5) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = BROWN; ctx.lineJoin = 'round'; ctx.stroke(); }

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
        ctx.beginPath(); ctx.roundRect(-21, -54, 42, 14, 4); outline('#fff');
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

  function drawKohlbert() {
    const w = stage.clientWidth, hh = stage.clientHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    anim += 0.05;
    if (act.name && now() > act.until) act.name = null;
    const a = act.name;

    let bounce = 0, rot = 0, eyes = 'normal', mouth = 'smile';
    if (S.sleeping) { bounce = Math.sin(anim * .8) * 2; eyes = 'sleeping'; mouth = 'sleeping'; }
    else if (a === 'pet') { bounce = -Math.abs(Math.sin(anim * 4) * 15); rot = Math.sin(anim * 3) * .1; eyes = 'happy'; mouth = 'open_big'; }
    else if (a === 'eating' || a === 'drinking') { bounce = Math.sin(anim * 5) * 4; mouth = Math.sin(anim * 6) > 0 ? 'open' : 'smile'; }
    else if (S.hunger < 30 || S.happy < 30 || S.clean < 25) { bounce = Math.sin(anim * 1.2); eyes = 'sad'; mouth = 'sad'; }
    else { bounce = Math.sin(anim * 2) * 4; rot = Math.sin(anim) * .03; }

    ctx.save();
    ctx.translate(w / 2, hh * 0.52 + bounce);

    // Schatten (bleibt am Boden)
    ctx.save(); ctx.translate(0, -bounce);
    ctx.beginPath(); ctx.ellipse(0, 50, 42 - Math.abs(bounce) * .5, 9, 0, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fill();
    ctx.restore();
    ctx.rotate(rot);

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

    // Körper
    ctx.beginPath();
    ctx.moveTo(-32, 20);
    ctx.bezierCurveTo(-44, -10, -35, -45, 0, -45);
    ctx.bezierCurveTo(35, -45, 44, -10, 32, 20);
    ctx.bezierCurveTo(25, 46, -25, 46, -32, 20);
    ctx.closePath(); outline('#FFFDF9', 4);

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

    // Mund
    ctx.strokeStyle = BROWN; ctx.fillStyle = '#E56B70'; ctx.lineWidth = 3;
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
    navigator.serviceWorker.register('sw.js').then(r => { swReg = r; pushStateToSW(); }).catch(() => {});
  }
  const awayMs = now() - S.last;
  advance(now());
  renderPoops(); updateUI(); save();
  drawKohlbert();
  setTimeout(() => {
    if (awayMs > 30 * 60 * 1000) say(S.hunger < 30 ? 'Da bist du ja! Hunger!' : 'Da bist du ja!', 3000);
    else say('Moin! Ich bin Kohlbert!');
    sfx.happy();
  }, 500);
})();
