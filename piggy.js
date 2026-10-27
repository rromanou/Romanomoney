(() => {
  'use strict';

  const G = window.Game;
  if (!G) return;

  const $ = (s) => document.getElementById(s);
  const view = $('pig-view'), game = $('pig-game');
  const amountEl = $('pig-amount'), fillEl = $('pig-fill'), subEl = $('pig-sub'), breakBtn = $('pig-break');

  const ROUNDS = 5;
  const MISS_SHARE = 0.03;   // part du cochon libérée par un coup raté
  let timer = null, keyHandler = null;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const h = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };

  function fmtLimit(ms) {
    const mins = Math.round(ms / 60000), hh = Math.floor(mins / 60), mm = mins % 60;
    return hh + ' h' + (mm ? ' ' + (mm < 10 ? '0' : '') + mm : '');
  }

  /* ---------- Affichage du cochon ---------- */
  function refresh() {
    const p = G.pigInfo();
    amountEl.textContent = G.money(p.amount);
    const pct = G.B.isZero(p.cap) ? 0 : Math.min(100, G.B.toNum(G.B.div(p.amount, p.cap)) * 100);
    fillEl.style.width = pct.toFixed(1) + '%';
    subEl.textContent = 'Plein à ' + (pct < 10 ? pct.toFixed(1).replace('.', ',') : Math.round(pct)) + ' % | Limite : ' + G.money(p.cap) +
      ' (' + fmtLimit(p.limitMs) + ' d\'absence) | Gain : ' + G.money(p.rate) + '/s hors ligne';
    breakBtn.disabled = G.B.lt(p.amount, G.B.ONE) || !game.hidden;
  }
  G.hook(refresh);

  /* ---------- Petit jeu : casser la tirelire ---------- */
  function stopLoop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
  }

  function backToView() {
    stopLoop();
    game.hidden = true;
    game.innerHTML = '';
    view.hidden = false;
    refresh();
  }

  function start() {
    const info = G.pigInfo();
    const startAmount = info.amount;
    if (G.B.lt(startAmount, G.B.ONE)) return;
    const perHit = info.hit;
    let round = 0, hits = 0, pos = 0, dir = 1, speed = 0, zone = { c: 0.5, w: 0.3 }, locked = true;

    stopLoop();
    view.hidden = true;
    game.hidden = false;
    game.innerHTML = '';

    const bar = h('div', 'mg-bar');
    bar.appendChild(h('span', 'mg-title', 'Casse la tirelire'));
    const quit = h('button', 'mg-quit', 'Quitter');
    quit.addEventListener('click', backToView);
    bar.appendChild(quit);

    const head = h('div', 'mg-head');
    const rd = h('span', null, 'Coup : 0 / ' + ROUNDS);
    const ht = h('span', null, 'Réussis : 0');
    head.append(rd, ht);

    const track = h('div', 'pig-track');
    const zoneEl = h('div', 'pig-zone');
    const mark = h('div', 'pig-mark');
    track.append(zoneEl, mark);

    const info1 = h('div', 'pig-info', 'Arrête le curseur dans la zone verte. Chaque coup réussi libère ' + Math.round(perHit * 100) + ' % du cochon.');
    const fb = h('div', 'mg-fb');
    const hit = h('button', 'primary', 'Frapper');
    game.append(bar, head, track, hit, fb, info1);

    function setZone() {
      const w = Math.max(0.12, 0.30 - 0.04 * (round - 1));
      zone = { w, c: rnd(0.12 + w / 2, 0.88 - w / 2) };
      zoneEl.style.left = ((zone.c - zone.w / 2) * 100) + '%';
      zoneEl.style.width = (zone.w * 100) + '%';
    }

    function loop() {
      pos += dir * speed;
      if (pos >= 1) { pos = 1; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      mark.style.left = (pos * 100) + '%';
    }

    function nextRound() {
      if (round >= ROUNDS) return finish();
      round++;
      rd.textContent = 'Coup : ' + round + ' / ' + ROUNDS;
      fb.className = 'mg-fb'; fb.textContent = '';
      pos = 0; dir = 1; speed = 0.011 + 0.0035 * (round - 1);
      setZone();
      locked = false;
    }

    function strike() {
      if (locked) return;
      locked = true;
      const ok = Math.abs(pos - zone.c) <= zone.w / 2;
      if (ok) { hits++; fb.className = 'mg-fb good'; fb.textContent = 'Touché !'; }
      else { fb.className = 'mg-fb bad'; fb.textContent = 'Raté'; }
      ht.textContent = 'Réussis : ' + hits;
      setTimeout(nextRound, 650);
    }

    function finish() {
      stopLoop();
      const share = Math.min(1, hits * perHit + (ROUNDS - hits) * MISS_SHARE);
      const got = G.pigTake(G.B.mul(startAmount, share));
      game.innerHTML = '';
      const left = G.pigInfo().amount;
      game.append(
        h('div', 'mg-end-title', hits === ROUNDS ? 'Parfait !' : 'Tirelire secouée'),
        h('div', 'mg-line', 'Coups réussis : ' + hits + ' / ' + ROUNDS),
        h('div', 'mg-line', 'Part récupérée : ' + (share * 100).toFixed(share * 100 % 1 ? 1 : 0).replace('.', ',') + ' %'),
        h('div', 'mg-win', '+' + G.money(got)),
        h('div', 'mg-line', G.B.gte(left, G.B.ONE) ? 'Il reste ' + G.money(left) + ' dans le cochon.' : 'Le cochon est vide.')
      );
      if (G.B.gte(left, G.B.ONE)) {
        const again = h('button', 'primary', 'Casser encore');
        again.addEventListener('click', start);
        game.appendChild(again);
      }
      const back = h('button', 'primary', 'Retour au cochon');
      back.addEventListener('click', backToView);
      game.appendChild(back);
    }

    hit.addEventListener('click', strike);
    track.addEventListener('click', strike);
    keyHandler = (e) => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); strike(); } };
    document.addEventListener('keydown', keyHandler);
    timer = setInterval(loop, 16);
    nextRound();
  }

  breakBtn.addEventListener('click', start);
  refresh();
})();
