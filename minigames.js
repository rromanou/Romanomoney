(() => {
  'use strict';

  const G = window.Game;
  if (!G) return;

  const menu = document.getElementById('mg-menu');
  const stage = document.getElementById('mg-stage');

  const GAMES = [
    { id: 'coins',  name: 'Chasse aux pièces', cd: 60, desc: '15 secondes pour attraper un maximum de pièces. Les dorées valent 5, évite les bombes.', play: playCoins },
    { id: 'memory', name: 'Mémoire',           cd: 90, desc: 'Trouve les 6 paires en 16 coups maximum. Moins de coups, plus de gains.', play: playMemory },
    { id: 'math',   name: 'Calcul éclair',     cd: 60, desc: '30 secondes pour résoudre des calculs. La difficulté augmente à chaque bonne réponse.', play: playMath },
    { id: 'reflex', name: 'Réflexe',           cd: 45, desc: '5 manches. Clique dès que l\'écran devient vert. Trop tôt et la manche est perdue.', play: playReflex }
  ];

  let timers = [];
  let intervals = [];
  let onKey = null;

  function later(fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; }
  function every(fn, ms) { const t = setInterval(fn, ms); intervals.push(t); return t; }
  function cleanup() {
    timers.forEach(clearTimeout); intervals.forEach(clearInterval);
    timers = []; intervals = [];
    if (onKey) { stage.removeEventListener('keydown', onKey); onKey = null; }
  }

  function h(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

  /* ---------- Menu ---------- */
  function renderMenu() {
    menu.innerHTML = '';
    GAMES.forEach((g) => {
      const card = h('div', 'mg-card');
      const info = h('div', 'mg-info');
      info.append(h('div', 'mg-name', g.name), h('div', 'mg-desc', g.desc));
      const gain = h('div', 'mg-gain');
      info.appendChild(gain);
      const btn = h('button', 'mg-play', 'Jouer');
      btn.addEventListener('click', () => launch(g));
      card.append(info, btn);
      menu.appendChild(card);
      g.gain = gain; g.btn = btn;
    });
    refreshMenu();
  }

  function refreshMenu() {
    GAMES.forEach((g) => {
      if (!g.btn) return;
      const left = G.cdLeft(g.id);
      g.btn.disabled = left > 0;
      g.btn.textContent = left > 0 ? Math.ceil(left / 1000) + ' s' : 'Jouer';
      g.gain.textContent = 'Gain typique : ' + G.money(G.unit() * (g.id === 'memory' ? 3 : g.id === 'reflex' ? 3 : 2.5));
    });
  }
  setInterval(refreshMenu, 1000);

  function launch(g) {
    if (G.cdLeft(g.id) > 0) return;
    cleanup();
    menu.hidden = true;
    stage.hidden = false;
    stage.innerHTML = '';
    const bar = h('div', 'mg-bar');
    bar.appendChild(h('span', 'mg-title', g.name));
    const quit = h('button', 'mg-quit', 'Quitter');
    quit.addEventListener('click', () => { cleanup(); closeStage(); });
    bar.appendChild(quit);
    const body = h('div');
    stage.append(bar, body);
    G.cdStart(g.id, g.cd);
    g.play(body, (reward, lines) => finish(g, body, reward, lines));
  }

  function closeStage() {
    stage.hidden = true;
    stage.innerHTML = '';
    menu.hidden = false;
    refreshMenu();
  }

  function finish(g, body, reward, lines) {
    cleanup();
    reward = Math.max(0, reward);
    if (reward > 0) G.earn(reward);
    body.innerHTML = '';
    body.appendChild(h('div', 'mg-end-title', reward > 0 ? 'Terminé' : 'Raté'));
    (lines || []).forEach((l) => body.appendChild(h('div', 'mg-line', l)));
    body.appendChild(h('div', 'mg-win', reward > 0 ? '+' + G.money(reward) : 'Aucun gain'));
    const back = h('button', 'primary', 'Retour aux mini-jeux');
    back.addEventListener('click', closeStage);
    body.appendChild(back);
  }

  /* ---------- Chasse aux pièces ---------- */
  function playCoins(body, done) {
    let score = 0, caught = 0, left = 15;
    const head = h('div', 'mg-head');
    const sc = h('span', null, 'Score : 0');
    const tm = h('span', null, '15 s');
    head.append(sc, tm);
    const area = h('div', 'mg-area');
    body.append(head, area);

    function spawn() {
      const roll = Math.random();
      const kind = roll < 0.12 ? 'bomb' : roll < 0.27 ? 'gold' : 'normal';
      const c = h('button', 'coin' + (kind === 'normal' ? '' : ' ' + kind), kind === 'bomb' ? 'X' : kind === 'gold' ? '5' : '$');
      c.style.left = rnd(4, 260) + 'px';
      c.style.top = rnd(4, 156) + 'px';
      c.addEventListener('click', () => {
        if (kind === 'bomb') score = Math.max(0, score - 4);
        else { score += kind === 'gold' ? 5 : 1; caught++; }
        sc.textContent = 'Score : ' + score;
        c.remove();
      });
      area.appendChild(c);
      later(() => c.remove(), kind === 'gold' ? 800 : 1100);
    }

    every(spawn, 420);
    every(() => {
      left--;
      tm.textContent = left + ' s';
      if (left <= 0) {
        done(score * G.unit() * 0.12, ['Pièces attrapées : ' + caught, 'Score final : ' + score]);
      }
    }, 1000);
  }

  /* ---------- Mémoire ---------- */
  function playMemory(body, done) {
    const syms = ['A', 'B', 'C', 'D', 'E', 'F'];
    const deck = syms.concat(syms).sort(() => Math.random() - 0.5);
    let moves = 0, found = 0, first = null, lock = false;
    const MAX = 16;

    const head = h('div', 'mg-head');
    const mv = h('span', null, 'Coups : 0 / ' + MAX);
    const pr = h('span', null, 'Paires : 0 / 6');
    head.append(mv, pr);
    const grid = h('div', 'mem-grid');
    body.append(head, grid);

    deck.forEach((s) => {
      const c = h('button', 'mcard', '?');
      c.dataset.sym = s;
      c.addEventListener('click', () => {
        if (lock || c.classList.contains('up')) return;
        c.classList.add('up');
        c.textContent = s;
        if (!first) { first = c; return; }
        moves++;
        mv.textContent = 'Coups : ' + moves + ' / ' + MAX;
        const a = first;
        first = null;
        if (a.dataset.sym === s) {
          found++;
          a.classList.add('ok'); c.classList.add('ok');
          pr.textContent = 'Paires : ' + found + ' / 6';
          if (found === 6) {
            const bonus = (MAX - moves) * 0.5;
            later(() => done(G.unit() * (2 + bonus), ['Terminé en ' + moves + ' coups']), 400);
          }
        } else {
          lock = true;
          later(() => {
            a.classList.remove('up'); a.textContent = '?';
            c.classList.remove('up'); c.textContent = '?';
            lock = false;
            if (moves >= MAX) done(0, ['Trop de coups : ' + MAX + ' maximum']);
          }, 650);
        }
        if (moves >= MAX && found < 6 && a.dataset.sym === s) done(0, ['Trop de coups : ' + MAX + ' maximum']);
      });
      grid.appendChild(c);
    });
  }

  /* ---------- Calcul éclair ---------- */
  function playMath(body, done) {
    let left = 30, right = 0, wrong = 0, answer = 0;

    const head = h('div', 'mg-head');
    const sc = h('span', null, 'Bonnes : 0');
    const tm = h('span', null, '30 s');
    head.append(sc, tm);
    const q = h('div', 'mg-q');
    const input = h('input', 'mg-input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    const fb = h('div', 'mg-fb');
    const ok = h('button', 'primary', 'Valider');
    body.append(head, q, input, ok, fb);

    function next() {
      const lvl = Math.floor(right / 3);
      const kind = rnd(0, lvl >= 2 ? 2 : 1);
      let a, b;
      if (kind === 0) {
        a = rnd(2, 12 + lvl * 8); b = rnd(2, 12 + lvl * 8);
        answer = a + b; q.textContent = a + ' + ' + b;
      } else if (kind === 1) {
        a = rnd(10 + lvl * 6, 30 + lvl * 12); b = rnd(2, 10 + lvl * 6);
        answer = a - b; q.textContent = a + ' - ' + b;
      } else {
        a = rnd(2, 6 + Math.min(lvl, 8)); b = rnd(2, 9 + Math.min(lvl, 6));
        answer = a * b; q.textContent = a + ' x ' + b;
      }
      input.value = '';
      input.focus();
    }

    function submit() {
      const v = input.value.trim();
      if (v === '') return;
      if (Number(v) === answer) {
        right++;
        fb.className = 'mg-fb good'; fb.textContent = 'Correct';
      } else {
        wrong++;
        fb.className = 'mg-fb bad'; fb.textContent = 'Faux : ' + answer;
        left = Math.max(0, left - 2);
        tm.textContent = left + ' s';
      }
      sc.textContent = 'Bonnes : ' + right;
      next();
    }

    onKey = (e) => { if (e.key === 'Enter') submit(); };
    stage.addEventListener('keydown', onKey);
    ok.addEventListener('click', submit);

    every(() => {
      left--;
      tm.textContent = Math.max(0, left) + ' s';
      if (left <= 0) {
        const streakBonus = 1 + Math.min(right, 30) * 0.03;
        done(right * G.unit() * 0.4 * streakBonus, ['Bonnes réponses : ' + right, 'Erreurs : ' + wrong + ' (2 s perdues chacune)']);
      }
    }, 1000);

    next();
  }

  /* ---------- Réflexe ---------- */
  function playReflex(body, done) {
    const ROUNDS = 5;
    let round = 0, total = 0, state = 'idle', t0 = 0, times = [];

    const head = h('div', 'mg-head');
    const rd = h('span', null, 'Manche : 0 / ' + ROUNDS);
    const best = h('span', null, '');
    head.append(rd, best);
    const pad = h('button', 'reflex wait', 'Prépare-toi');
    body.append(head, pad);

    function setPad(cls, txt) { pad.className = 'reflex ' + cls; pad.textContent = txt; }

    function nextRound() {
      if (round >= ROUNDS) {
        const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        done(total, [times.length ? 'Temps moyen : ' + avg + ' ms' : 'Aucune manche réussie', 'Manches réussies : ' + times.length + ' / ' + ROUNDS]);
        return;
      }
      round++;
      rd.textContent = 'Manche : ' + round + ' / ' + ROUNDS;
      state = 'wait';
      setPad('wait', 'Attends le vert...');
      later(() => { state = 'go'; t0 = performance.now(); setPad('go', 'CLIQUE !'); }, rnd(1000, 3200));
    }

    pad.addEventListener('click', () => {
      if (state === 'idle') { nextRound(); return; }
      if (state === 'wait') {
        timers.forEach(clearTimeout); timers = [];
        state = 'pause';
        setPad('early', 'Trop tôt');
        later(nextRound, 1000);
        return;
      }
      if (state === 'go') {
        const ms = Math.round(performance.now() - t0);
        times.push(ms);
        const factor = Math.max(0, Math.min(1.2, (700 - ms) / 450));
        total += G.unit() * 0.7 * factor;
        best.textContent = 'Dernier : ' + ms + ' ms';
        state = 'pause';
        setPad('hit', ms + ' ms');
        later(nextRound, 900);
      }
    });
  }

  renderMenu();
})();
