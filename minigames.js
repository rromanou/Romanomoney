(() => {
  'use strict';

  const G = window.Game;
  const U = (k) => G.B.mul(G.unit(), k);
  if (!G) return;

  const menu = document.getElementById('mg-menu');
  const stage = document.getElementById('mg-stage');

  const GAMES = [
    { id: 'coins',  name: 'Chasse aux pièces', cd: 60, desc: '15 secondes pour attraper un maximum de pièces. Les dorées valent 5, évite les bombes.', play: playCoins },
    { id: 'memory', name: 'Mémoire',           cd: 90, desc: 'Trouve les 6 paires en 16 coups maximum. Moins de coups, plus de gains.', play: playMemory },
    { id: 'math',   name: 'Calcul éclair',     cd: 60, desc: '30 secondes pour résoudre des calculs. La difficulté augmente à chaque bonne réponse.', play: playMath },
    { id: 'reflex', name: 'Réflexe',           cd: 45, desc: '5 manches. Clique dès que l\'écran devient vert. Trop tôt et la manche est perdue.', play: playReflex },
    { id: 'mole',   name: 'Taupes',            cd: 60, desc: '20 secondes pour assommer les taupes. Les dorées valent 3, les casquées coûtent 2.', play: playMole },
    { id: 'simon',  name: 'Simon',             cd: 75, desc: 'Reproduis la séquence de couleurs. Elle s\'allonge à chaque tour, une erreur arrête la partie.', play: playSimon },
    { id: 'hilo',   name: 'Plus ou moins',     cd: 60, desc: 'Le prochain nombre est-il plus haut ou plus bas ? Encaisse quand tu veux, une erreur fait tout perdre.', play: playHiLo },
    { id: 'catch',  name: 'Attrape-pièces',    cd: 60, desc: '15 secondes pour rattraper les pièces avec le panier. Évite les bombes.', play: playCatch }
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
      g.gain.textContent = 'Gain typique : ' + G.money(U(g.id === 'memory' ? 3 : g.id === 'reflex' ? 3 : 2.5));
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
    reward = G.B.from(reward);
    const won = G.B.gt(reward, G.B.ZERO);
    if (won) G.earn(reward);
    body.innerHTML = '';
    body.appendChild(h('div', 'mg-end-title', won ? 'Terminé' : 'Raté'));
    (lines || []).forEach((l) => body.appendChild(h('div', 'mg-line', l)));
    body.appendChild(h('div', 'mg-win', won ? '+' + G.money(reward) : 'Aucun gain'));
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
        done(U(score * 0.12), ['Pièces attrapées : ' + caught, 'Score final : ' + score]);
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
            later(() => done(U(2 + bonus), ['Terminé en ' + moves + ' coups']), 400);
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
        done(U(right * 0.4 * streakBonus), ['Bonnes réponses : ' + right, 'Erreurs : ' + wrong + ' (2 s perdues chacune)']);
      }
    }, 1000);

    next();
  }

  /* ---------- Réflexe ---------- */
  function playReflex(body, done) {
    const ROUNDS = 5;
    let round = 0, total = G.B.ZERO, state = 'idle', t0 = 0, times = [];

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
        total = G.B.add(total, U(0.7 * factor));
        best.textContent = 'Dernier : ' + ms + ' ms';
        state = 'pause';
        setPad('hit', ms + ' ms');
        later(nextRound, 900);
      }
    });
  }

  /* ---------- Taupes ---------- */
  function playMole(body, done) {
    let score = 0, hits = 0, left = 20;
    const head = h('div', 'mg-head');
    const sc = h('span', null, 'Score : 0');
    const tm = h('span', null, '20 s');
    head.append(sc, tm);
    const grid = h('div', 'mole-grid');
    body.append(head, grid);

    const holes = [];
    for (let i = 0; i < 9; i++) {
      const hole = h('button', 'hole');
      hole.addEventListener('click', () => {
        const kind = hole.dataset.kind;
        if (!kind) return;
        if (kind === 'bomb') score = Math.max(0, score - 2);
        else { score += kind === 'gold' ? 3 : 1; hits++; }
        sc.textContent = 'Score : ' + score;
        hole.dataset.kind = ''; hole.className = 'hole'; hole.textContent = '';
      });
      grid.appendChild(hole);
      holes.push(hole);
    }

    function pop() {
      const free = holes.filter((x) => !x.dataset.kind);
      if (!free.length) return;
      const hole = free[rnd(0, free.length - 1)];
      const roll = Math.random();
      const kind = roll < 0.12 ? 'bomb' : roll < 0.27 ? 'gold' : 'mole';
      hole.dataset.kind = kind;
      hole.className = 'hole up ' + kind;
      hole.textContent = kind === 'bomb' ? 'X' : kind === 'gold' ? '3' : '';
      later(() => { if (hole.dataset.kind === kind) { hole.dataset.kind = ''; hole.className = 'hole'; hole.textContent = ''; } }, kind === 'gold' ? 650 : 850);
    }

    every(pop, 480);
    every(() => {
      left--;
      tm.textContent = left + ' s';
      if (left <= 0) done(U(score * 0.1), ['Taupes assommées : ' + hits, 'Score final : ' + score]);
    }, 1000);
  }

  /* ---------- Simon ---------- */
  function playSimon(body, done) {
    const COLORS = ['red', 'blue', 'green', 'yellow'];
    let seq = [], step = 0, rounds = 0, accepting = false;

    const head = h('div', 'mg-head');
    const rd = h('span', null, 'Tours réussis : 0');
    const st = h('span', null, 'Regarde...');
    head.append(rd, st);
    const pad = h('div', 'simon-pad');
    const btns = COLORS.map((c) => {
      const b = h('button', 'simon-btn ' + c);
      b.addEventListener('click', () => press(c));
      pad.appendChild(b);
      return b;
    });
    body.append(head, pad);

    function flashBtn(c, ms) {
      const b = btns[COLORS.indexOf(c)];
      b.classList.add('lit');
      later(() => b.classList.remove('lit'), ms);
    }

    function play() {
      accepting = false; step = 0;
      st.textContent = 'Regarde...';
      seq.push(COLORS[rnd(0, 3)]);
      seq.forEach((c, i) => { later(() => flashBtn(c, 380), 700 + i * 560); });
      later(() => { accepting = true; st.textContent = 'À toi !'; }, 700 + seq.length * 560);
    }

    function press(c) {
      if (!accepting) return;
      flashBtn(c, 180);
      if (c !== seq[step]) {
        accepting = false;
        later(() => done(U(rounds * 0.35 * (1 + Math.min(rounds, 20) * 0.05)), ['Séquence de ' + seq.length + ' (erreur)', 'Tours réussis : ' + rounds]), 400);
        return;
      }
      step++;
      if (step === seq.length) {
        rounds++;
        rd.textContent = 'Tours réussis : ' + rounds;
        accepting = false;
        if (rounds >= 25) { later(() => done(U(rounds * 0.35 * 2), ['Séquence parfaite de ' + rounds]), 400); return; }
        later(play, 700);
      }
    }

    later(play, 300);
  }

  /* ---------- Plus ou moins ---------- */
  function playHiLo(body, done) {
    let cur = rnd(1, 100), streak = 0;
    const head = h('div', 'mg-head');
    const sk = h('span', null, 'Série : 0');
    const pot = h('span', null, 'Gain : 0 $');
    head.append(sk, pot);
    const num = h('div', 'mg-q', String(cur));
    const two = h('div', 'two');
    const hi = h('button', 'primary', 'Plus haut');
    const lo = h('button', 'primary', 'Plus bas');
    two.append(hi, lo);
    const cash = h('button', 'primary cashout', 'Encaisser');
    const fb = h('div', 'mg-fb');
    body.append(head, num, two, cash, fb);

    const value = () => (streak === 0 ? G.B.ZERO : U(0.3 * streak * (1 + 0.1 * streak)));
    function upd() {
      sk.textContent = 'Série : ' + streak;
      pot.textContent = 'Gain : ' + G.money(value());
      cash.disabled = streak === 0;
    }

    function guess(higher) {
      let nxt = rnd(1, 100);
      while (nxt === cur) nxt = rnd(1, 100);
      const ok = higher ? nxt > cur : nxt < cur;
      num.textContent = String(nxt);
      if (!ok) {
        fb.className = 'mg-fb bad'; fb.textContent = 'Perdu : ' + nxt;
        hi.disabled = lo.disabled = cash.disabled = true;
        later(() => done(0, ['Le nombre était ' + nxt, 'Série perdue : ' + streak]), 900);
        return;
      }
      streak++;
      cur = nxt;
      fb.className = 'mg-fb good'; fb.textContent = 'Bien joué';
      upd();
      if (streak >= 15) { hi.disabled = lo.disabled = cash.disabled = true; later(() => done(value(), ['Série maximale : ' + streak]), 600); }
    }

    hi.addEventListener('click', () => guess(true));
    lo.addEventListener('click', () => guess(false));
    cash.addEventListener('click', () => { if (streak > 0) done(value(), ['Encaissé à la série ' + streak]); });
    upd();
  }

  /* ---------- Attrape-pièces ---------- */
  function playCatch(body, done) {
    const W = 302, H = 200, BW = 58;
    let score = 0, caught = 0, left = 15, bx = (W - BW) / 2;
    const head = h('div', 'mg-head');
    const sc = h('span', null, 'Score : 0');
    const tm = h('span', null, '15 s');
    head.append(sc, tm);
    const area = h('div', 'mg-area');
    const basket = h('div', 'basket');
    basket.style.left = bx + 'px';
    area.appendChild(basket);
    body.append(head, area);
    const items = [];

    function setX(x) { bx = Math.max(0, Math.min(W - BW, x - BW / 2)); basket.style.left = bx + 'px'; }
    area.addEventListener('mousemove', (e) => { setX(e.clientX - area.getBoundingClientRect().left); });
    area.addEventListener('touchmove', (e) => { if (e.touches[0]) setX(e.touches[0].clientX - area.getBoundingClientRect().left); });
    onKey = (e) => {
      if (e.key === 'ArrowLeft') setX(bx + BW / 2 - 28);
      if (e.key === 'ArrowRight') setX(bx + BW / 2 + 28);
    };
    document.addEventListener('keydown', onKey);
    const prevCleanup = cleanup;

    function spawn() {
      const roll = Math.random();
      const kind = roll < 0.16 ? 'bomb' : roll < 0.30 ? 'gold' : 'normal';
      const el = h('div', 'drop ' + kind, kind === 'bomb' ? 'X' : kind === 'gold' ? '3' : '$');
      const it = { el, x: rnd(0, W - 26), y: -26, v: 2.4 + Math.random() * 1.6, kind };
      el.style.left = it.x + 'px'; el.style.top = it.y + 'px';
      area.appendChild(el);
      items.push(it);
    }

    function tick() {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.y += it.v;
        it.el.style.top = it.y + 'px';
        if (it.y >= H - 40 && it.y <= H - 14 && it.x + 26 >= bx && it.x <= bx + BW) {
          if (it.kind === 'bomb') score = Math.max(0, score - 3);
          else { score += it.kind === 'gold' ? 3 : 1; caught++; }
          sc.textContent = 'Score : ' + score;
          it.el.remove(); items.splice(i, 1);
        } else if (it.y > H) { it.el.remove(); items.splice(i, 1); }
      }
    }

    every(spawn, 420);
    every(tick, 30);
    every(() => {
      left--;
      tm.textContent = left + ' s';
      if (left <= 0) {
        document.removeEventListener('keydown', onKey);
        done(U(score * 0.1), ['Pièces rattrapées : ' + caught, 'Score final : ' + score]);
      }
    }, 1000);
  }

  renderMenu();
})();
