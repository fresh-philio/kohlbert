// Gemeinsame Logik für App und Service Worker (Decay + Alert-Regeln)
(function (g) {
  'use strict';
  // Punkte pro Stunde
  const RATES = { hunger: 12, happy: 6, energy: 5, clean: 4, sleepEnergy: 25, sleepHunger: 4, maxHours: 12 };
  const clamp = v => Math.max(0, Math.min(100, v));

  // Mutiert s; dt in Stunden. Gibt { woke } zurück.
  function step(s, dt) {
    let woke = false;
    dt = Math.min(Math.max(dt, 0), RATES.maxHours);
    if (dt <= 0) return { woke };
    const poops = (s.poops && s.poops.length) || 0;
    if (s.sleeping) {
      s.energy += RATES.sleepEnergy * dt;
      s.hunger -= RATES.sleepHunger * dt;
      s.clean -= 1 * dt;
      if (s.energy >= 100) { s.sleeping = false; woke = true; }
    } else {
      s.hunger -= RATES.hunger * dt;
      s.happy -= (RATES.happy + poops * 2) * dt;
      s.energy -= RATES.energy * dt;
      s.clean -= RATES.clean * dt;
    }
    s.clean -= poops * 3 * dt;
    s.hunger = clamp(s.hunger); s.happy = clamp(s.happy);
    s.energy = clamp(s.energy); s.clean = clamp(s.clean);
    return { woke };
  }

  const ALERTS = [
    { id: 'woke',   test: s => !!s.__woke, title: 'Kohlbert ist ausgeschlafen ☀️', body: 'Moin! Er ist wach und will spielen.' },
    { id: 'hunger', test: s => !s.sleeping && s.hunger < 25, title: 'Kohlbert hat Hunger 🥨', body: 'Sein Magen knurrt. Brezel gefällig?' },
    { id: 'poop',   test: s => (s.poops || []).length >= 2, title: 'Kohlbert hat Haufen gemacht 💩', body: 'Bitte aufräumen, es müffelt.' },
    { id: 'clean',  test: s => s.clean < 25, title: 'Kohlbert ist schmutzig 🚿', body: 'Er braucht dringend eine Dusche.' },
    { id: 'energy', test: s => !s.sleeping && s.energy < 20, title: 'Kohlbert ist müde 😴', body: 'Schlafenszeit, oder ein Kaffee?' },
    { id: 'happy',  test: s => !s.sleeping && s.happy < 20, title: 'Kohlbert langweilt sich 🥺', body: 'Streicheln oder ein Minispiel wäre schön.' }
  ];

  // Erster fälliger Alert (mit Cooldown) oder null
  function due(s, t, cooldownMs) {
    cooldownMs = cooldownMs == null ? 60 * 60 * 1000 : cooldownMs;
    const ln = s.lastNotify || {};
    for (const a of ALERTS) {
      if (a.test(s) && t - (ln[a.id] || 0) > cooldownMs) return a;
    }
    return null;
  }

  g.KB = { RATES, step, ALERTS, due, clamp };
})(typeof self !== 'undefined' ? self : window);
