(() => {
  'use strict';

  /* ---------- Constantes ---------- */
  const VERSION = '1.4.1';
  const DATA_VERSION = 3;
  const PRESTIGE_BONUS = 0.10;       // +10 % par point de prestige
  const PRESTIGE_DIVISOR = 1e9;      // 1 point de prestige pour 1 milliard $ gagné dans la partie
  const REBIRTH_DIVISOR = 1e24;      // 1 point de rebirth pour 1 quadrillion $ gagné depuis le dernier rebirth
  const OFFLINE_BASE_RATE = 0.2;     // 20 % du revenu passif hors ligne
  const AFK_BASE_MS = 8 * 3600 * 1000;
  const AFK_MAX_MS = 36 * 3600 * 1000;
  const AFK_STEP_MS = 20 * 60 * 1000;
  const SAVE_KEY = 'makeMoneySave';
  const META_KEY = 'romanomoneyMeta';
  const MAX_VALUE = 1e300;
  const MAX_OWNED = 5000;
  const SITE_PREFIXES = ['https://rromanou.github.io/', 'https://caplotz.github.io/'];
  const SITE_MULT = 1.15;
  const SECRET = 'rmn-v1|Romanomoney|k7Qz#92';

  const UPDATES = [
    {
      v: '1.4.1', d: '25 octobre 2026',
      notes: ['Correction : une sauvegarde peut maintenant être importée après une réinstallation (la vérification d\'installation est retirée).']
    },
    {
      v: '1.4.0', d: '25 octobre 2026',
      notes: [
        'Deux fois plus de paliers : 119 améliorations de clic, 199 revenus passifs et 59 multiplicateurs. Les nouveaux paliers s\'insèrent entre les anciens.',
        'Limite de temps AFK : prix de base 25 points et croissance de 25 % par achat.',
        'Surclics permanents : prix de base 15 points et croissance de 32 % par achat.'
      ]
    },
    {
      v: '1.3.0', d: '25 octobre 2026',
      notes: [
        '60 améliorations de clic (au lieu de 22) et 100 revenus passifs (au lieu de 40), jusqu\'à des nombres à plus de 280 chiffres.',
        '30 multiplicateurs à achat unique (x1,5, x2 puis x3) qui s\'appliquent à tous tes gains. Ils sont remis à zéro par le prestige et le rebirth.',
        'Crédits : Roman B.'
      ]
    },
    {
      v: '1.2.0', d: '25 octobre 2026',
      notes: [
        'Le jeu s\'appelle maintenant Romanomoney, et la fenêtre est plus petite.',
        'Surclics : chaque clic en donne 0,2. Réclame-les quand tu veux, en bas, pour gagner leur valeur en clics.',
        'Rebirth : un nouveau reset qui donne des points de rebirth pour 7 améliorations permanentes (clic, passif, AFK, casino, prix, limite AFK, surclics).',
        'Style : boutons et arrière-plans à acheter avec de l\'argent ou des points de rebirth.',
        'Sauvegarde : export chiffré et import, lié à cette installation. Le temps hors ligne est conservé.',
        'Bonus de x1,15 sur tes gains quand tu ouvres le jeu sur rromanou.github.io ou caplotz.github.io.',
        'Machine à sous refaite : 12 symboles dont BAR et VIP, avec une nouvelle table des gains.'
      ]
    },
    {
      v: '1.1.0', d: '25 octobre 2026',
      notes: [
        'Revenus hors ligne : 20 % du revenu passif pendant ton absence.',
        'Nombres jusqu\'au vigintilliard, puis notation scientifique.',
        '22 améliorations de clic et 40 revenus passifs, jusqu\'aux décilliards et au-delà.',
        'Achat par lots : x1, x10, x100 ou Max.',
        'Difficulté augmentée : coûts plus élevés, prestige à partir de 1 milliard $, +10 % par point.',
        '4 mini-jeux : Chasse aux pièces, Mémoire, Calcul éclair et Réflexe.',
        'Casino : pile ou face et roulette.',
        'Nouvel onglet Infos : mises à jour et crédits.'
      ]
    },
    {
      v: '1.0.0', d: '25 octobre 2026',
      notes: ['Première version : clic, boutique, machine à sous, prestige et sauvegarde automatique.']
    }
  ];

  /* ---------- Données du jeu ---------- */
  const sig2 = (x) => Number(x.toPrecision(2));

  const CLICK_NAMES = [
    'Meilleur curseur', 'Gants de travail', 'Bras robotisé', 'Assistant automatisé', 'Clavier mécanique',
    'Souris de précision', 'Double écran', 'Station de trading', 'Algorithme boursier', 'Réseau de courtiers',
    'Superordinateur', 'Calcul quantique', 'Réseau neuronal', 'Analyste orbital', 'Cerveau synthétique',
    'Doigt de Midas', 'Contrat galactique', 'Clic cosmique', 'Main du destin', 'Poing du multivers',
    'Clic d\'éternité', 'Pouvoir absolu',
    'Impulsion stellaire', 'Doigt de nébuleuse', 'Poing de supernova', 'Toucher de pulsar', 'Paume de quasar',
    'Main de trou noir', 'Geste dimensionnel', 'Clic hyperspatial', 'Étreinte du vide', 'Pression du cosmos',
    'Frappe temporelle', 'Impact de paradoxe', 'Clic d\'antimatière', 'Doigt de l\'entropie', 'Poing de l\'infini',
    'Touche primordiale', 'Clic fondateur', 'Main de la création', 'Souffle des origines', 'Pulsation universelle',
    'Étincelle divine', 'Clic omnipotent', 'Geste souverain', 'Décret absolu', 'Sceau de l\'éternité',
    'Empreinte du big bang', 'Doigt de l\'architecte', 'Clic de réalité', 'Frappe métaphysique', 'Main de l\'absolu',
    'Volonté pure', 'Clic transcendant', 'Poing du destin', 'Toucher d\'éternité', 'Geste ultime',
    'Clic au-delà du temps', 'Main du tout', 'Clic final'
  ];

  const GEN_NAMES = [
    'Kiosque', 'Boutique', 'Usine', 'Banque', 'Entreprise',
    'Mine d\'or', 'Port commercial', 'Raffinerie', 'Centrale électrique', 'Laboratoire',
    'Chaîne de télévision', 'Compagnie aérienne', 'Banque centrale', 'Bourse mondiale', 'Programme spatial',
    'Colonie lunaire', 'Base martienne', 'Ceinture d\'astéroïdes', 'Sphère de Dyson', 'Réseau interstellaire',
    'Forge d\'étoiles', 'Trou noir industriel', 'Empire galactique', 'Moissonneuse de quasars', 'Machine à univers',
    'Fabrique de dimensions', 'Banque du multivers', 'Horloge cosmique', 'Tisseur de réalités', 'Forge du temps',
    'Architecte de l\'infini', 'Source primordiale', 'Trésor des origines', 'Singularité économique', 'Moteur de l\'éternité',
    'Noyau de l\'existence', 'Bourse de l\'absolu', 'Gouverneur du néant', 'Dieu du commerce', 'Origine de toute richesse',
    'Atelier des mondes', 'Cité-État orbitale', 'Flotte de croiseurs', 'Réseau de portails', 'Usine à planètes',
    'Siphon de nébuleuse', 'Collecteur de matière noire', 'Réacteur à antimatière', 'Forge de galaxies', 'Tisseur de filaments',
    'Brasserie de supernovas', 'Cathédrale temporelle', 'Archive des futurs', 'Banque des paradoxes', 'Bourse des timelines',
    'Moissonneur d\'entropie', 'Distillerie de vide', 'Atelier des constantes', 'Fonderie de lois physiques', 'Imprimante d\'univers',
    'Gestionnaire de multivers', 'Cartel dimensionnel', 'Empire des réalités', 'Conseil des dieux', 'Panthéon marchand',
    'Sanctuaire du hasard', 'Loterie cosmique', 'Casino des destins', 'Marché des âmes', 'Banque des souvenirs',
    'Fabrique de concepts', 'Raffinerie d\'idées', 'Moteur de possibilités', 'Générateur de miracles', 'Autel de l\'abondance',
    'Cœur du cosmos', 'Rivière d\'infini', 'Océan de potentiel', 'Mer des origines', 'Source de toute énergie',
    'Matrice du réel', 'Code source de l\'univers', 'Éditeur de réalité', 'Compilateur d\'existence', 'Serveur du multivers',
    'Trône de l\'omniscience', 'Sceptre de la création', 'Couronne de l\'éternité', 'Livre du destin', 'Balance du cosmos',
    'Horloge du dernier instant', 'Écho du big bang', 'Ombre de l\'infini', 'Reflet de l\'absolu', 'Rêve du premier être',
    'Pensée du tout', 'Silence primordial', 'Dernier horizon', 'Au-delà du possible', 'La richesse elle-même'
  ];

  /* Multiplicateurs à achat unique : réinitialisés par le prestige et le rebirth */
  const UP_NAMES = [
    'Formation du personnel', 'Publicité locale', 'Réseau de contacts', 'Optimisation fiscale', 'Logiciel de gestion',
    'Marque réputée', 'Partenariats stratégiques', 'Franchise nationale', 'Monopole régional', 'Lobbying efficace',
    'Automatisation totale', 'Intelligence collective', 'Commerce interplanétaire', 'Économie d\'échelle galactique', 'Taxe cosmique',
    'Brevet universel', 'Contrôle des prix', 'Fusion des empires', 'Standard monétaire universel', 'Inflation maîtrisée',
    'Boucle de profit', 'Rentabilité infinie', 'Dividendes temporels', 'Spéculation dimensionnelle', 'Arbitrage du multivers',
    'Marché unifié des réalités', 'Loi de l\'abondance', 'Décret de prospérité', 'Bénédiction du hasard', 'Convergence absolue'
  ];
  /* Paliers intermédiaires : un palier de plus entre chaque paire de paliers existants (coût à mi-chemine) */
  const TIER_SUFFIX = ['Premium', 'Deluxe', 'Turbo', 'Élite', 'Plus', 'Max', 'Pro', 'Ultra', 'Prime', 'Suprême', 'Optimal', 'Légendaire'];

  function buildUps() {
    const out = [];
    UP_NAMES.forEach((name, k) => {
      const mult = k < 10 ? 1.5 : k < 20 ? 2 : 3;
      out.push({ id: 'u' + k, name, base: sig2(1e3 * Math.pow(10, 9.3 * k)), mult });
      if (k < UP_NAMES.length - 1) {
        out.push({
          id: 'v' + k, name: name + ' ' + TIER_SUFFIX[k % TIER_SUFFIX.length],
          base: sig2(1e3 * Math.pow(10, 9.3 * (k + 0.5))),
          mult: k < 10 ? 1.25 : k < 20 ? 1.5 : 2
        });
      }
    });
    return out;
  }
  const UPS = buildUps();

  function buildClicks() {
    const es = [];
    let e = 0;
    CLICK_NAMES.forEach((n, i) => { if (i > 0) e += i < 22 ? 1 + 0.2 * (i - 1) : 5.7; es.push(e); });
    const tier = (id, name, ex, t) => {
      const base = sig2(15 * Math.pow(10, ex));
      return { id, name, base, add: sig2(base / (15 * Math.pow(1.27, t))), g: 1.18 + 0.003 * t };
    };
    const out = [];
    CLICK_NAMES.forEach((name, i) => {
      out.push(tier('c' + i, name, es[i], i));
      if (i < CLICK_NAMES.length - 1) out.push(tier('d' + i, name + ' ' + TIER_SUFFIX[i % TIER_SUFFIX.length], (es[i] + es[i + 1]) / 2, i + 0.5));
    });
    return out;
  }

  function buildGens() {
    const es = [];
    let e = 0;
    GEN_NAMES.forEach((n, i) => { if (i > 0) e += i < 40 ? 1 + 0.055 * (i - 1) : 3.4; es.push(e); });
    const tier = (id, name, ex, t) => {
      const base = sig2(50 * Math.pow(10, ex));
      return { id, name, base, cps: sig2(base / (100 * Math.pow(1.08, t))), g: 1.16 + 0.002 * t };
    };
    const out = [];
    GEN_NAMES.forEach((name, i) => {
      out.push(tier('g' + i, name, es[i], i));
      if (i < GEN_NAMES.length - 1) out.push(tier('h' + i, name + ' ' + TIER_SUFFIX[i % TIER_SUFFIX.length], (es[i] + es[i + 1]) / 2, i + 0.5));
    });
    return out;
  }

  const CLICKS = buildClicks();
  const GENS = buildGens();

  /* Améliorations permanentes de rebirth (prix de base donnés, croissance par achat) */
  const RB = [
    { id: 'click',  name: 'Multiplicateur par clic', base: 1, g: 1.35, max: Infinity },
    { id: 'pass',   name: 'Revenu passif',           base: 1, g: 1.35, max: Infinity },
    { id: 'afk',    name: 'Revenu AFK',              base: 4, g: 1.40, max: Infinity },
    { id: 'casino', name: 'Gains au casino',         base: 7, g: 1.45, max: Infinity },
    { id: 'disc',   name: 'Prix des améliorations',  base: 8, g: 1.45, max: 37 },
    { id: 'time',   name: 'Limite de temps AFK',     base: 25, g: 1.25, max: 84 },
    { id: 'over',   name: 'Surclics permanents',     base: 15, g: 1.32, max: Infinity }
  ];

  /* Cosmétiques : money = prix en argent, rp = prix en points de rebirth */
  const BUTTON_SKINS = [
    { id: 'classic', name: 'Classique' },
    { id: 'ocean',   name: 'Océan',     money: 1e7 },
    { id: 'ember',   name: 'Braise',    money: 1e15 },
    { id: 'violet',  name: 'Améthyste', money: 1e24 },
    { id: 'gold',    name: 'Or massif', rp: 3 },
    { id: 'neon',    name: 'Néon',      rp: 6 },
    { id: 'void',    name: 'Néant',     rp: 12 }
  ];
  const BACKGROUNDS = [
    { id: 'dark',     name: 'Sombre' },
    { id: 'forest',   name: 'Forêt',      money: 5e7 },
    { id: 'midnight', name: 'Nuit bleue', money: 5e15 },
    { id: 'dusk',     name: 'Crépuscule', money: 5e24 },
    { id: 'aurora',   name: 'Aurore',     rp: 4 },
    { id: 'galaxy',   name: 'Galaxie',    rp: 9 }
  ];

  /* Machine à sous : 12 symboles pondérés (total 100) */
  const SLOT_SYMS = [
    { s: '1', w: 10 }, { s: '2', w: 10 }, { s: '3', w: 10 }, { s: '4', w: 10 }, { s: '5', w: 10 },
    { s: '6', w: 10 }, { s: '7', w: 10 }, { s: '8', w: 10 }, { s: '9', w: 10 },
    { s: '0', w: 5 }, { s: 'BAR', w: 3 }, { s: 'VIP', w: 2 }
  ];
  const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

  const fresh = () => ({
    v: DATA_VERSION,
    money: 0, run: 0, rrun: 0, total: 0,
    clicks: {}, gens: {}, ups: {},
    prestige: 0, resets: 0,
    rp: 0, rebirths: 0, rb: {},
    over: 0, clicksMade: 0, cd: {},
    skins: { classic: 1 }, bgs: { dark: 1 }, skin: 'classic', bg: 'dark',
    lastSeen: Date.now()
  });

  let S = fresh();
  let meta = { id: '' };
  let siteActive = false;

  /* ---------- Formatage des nombres (échelle longue) ---------- */
  const PREFIXES = ['m', 'b', 'tr', 'quadr', 'quint', 'sext', 'sept', 'oct', 'non', 'déc',
    'undéc', 'duodéc', 'trédéc', 'quattuordéc', 'quindéc', 'sexdéc', 'septendéc', 'octodéc', 'novemdéc', 'vigint'];
  const NAMES = {};
  PREFIXES.forEach((p, k) => {
    NAMES[6 + 6 * k] = p + 'illion';
    NAMES[9 + 6 * k] = p + 'illiard';
  });

  function sig3(v) {
    const d = v < 10 ? 2 : v < 100 ? 1 : 0;
    let s = v.toFixed(d);
    if (s.indexOf('.') !== -1) s = s.replace(/\.?0+$/, '');
    return s.replace('.', ',');
  }

  function fmt(n) {
    if (!isFinite(n)) return 'Infini';
    n = Math.max(0, n);
    if (n < 1000) return n < 10 && n % 1 !== 0 ? dec(n, 2) : String(Math.floor(n));
    const parts = n.toExponential(6).split('e');
    const m = Number(parts[0]);
    const e = Number(parts[1]);
    if (e < 6) return sig3(n / 1000) + ' K';
    if (e <= 123) {
      const g = e - (e % 3);
      const v = m * Math.pow(10, e - g);
      return sig3(v) + ' ' + NAMES[g] + (v >= 2 ? 's' : '');
    }
    return m.toFixed(2).replace('.', ',') + 'e' + e;
  }
  const money = (n) => fmt(n) + ' $';

  // Décimales fixes (jusqu'à d), virgule française, zéros finaux retirés
  function dec(x, d) {
    let s = Number(x).toFixed(d);
    if (s.indexOf('.') !== -1) s = s.replace(/\.?0+$/, '');
    return s.replace('.', ',');
  }
  const fmtOver = (n) => (n < 1000 ? dec(n, n < 10 ? 2 : 1) : fmt(n));

  function fmtDur(ms) {
    const mins = Math.round(ms / 60000);
    const h = Math.floor(mins / 60), m = mins % 60;
    return h + ' h' + (m ? ' ' + (m < 10 ? '0' : '') + m : '');
  }

  /* ---------- Calculs ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const owned = (map, id) => map[id] || 0;
  const rbn = (id) => (S.rb && S.rb[id]) || 0;

  const discount = () => Math.max(0.25, 1 - 0.02 * rbn('disc'));
  const clickRb = () => 1 + 0.2 * rbn('click');
  const passRb = () => 1 + 0.2 * rbn('pass');
  const afkMult = () => 1 + 0.2 * rbn('afk');
  const casinoMult = () => 1 + 0.05 * rbn('casino');
  const afkLimit = () => Math.min(AFK_MAX_MS, AFK_BASE_MS + AFK_STEP_MS * rbn('time'));
  const overPerClick = () => 0.2 + 0.1 * rbn('over');
  const siteMult = () => (siteActive ? SITE_MULT : 1);

  const priceOf = (d, have, n) => d.base * Math.pow(d.g, have) * (Math.pow(d.g, n) - 1) / (d.g - 1) * discount();
  function maxAfford(d, have, budget) {
    const first = d.base * Math.pow(d.g, have) * discount();
    if (!(budget >= first)) return 0;
    let n = Math.floor(Math.log(budget / discount() * (d.g - 1) / (d.base * Math.pow(d.g, have)) + 1) / Math.log(d.g));
    if (!isFinite(n) || n < 0) n = 0;
    n = Math.min(n, MAX_OWNED);
    while (n > 0 && priceOf(d, have, n) > budget) n--;
    while (n < MAX_OWNED && priceOf(d, have, n + 1) <= budget) n++;
    return n;
  }

  const mult = () => 1 + PRESTIGE_BONUS * S.prestige;
  const upMult = () => UPS.reduce((a, d) => (S.ups && S.ups[d.id] ? a * d.mult : a), 1);
  const perClick = () => (1 + CLICKS.reduce((a, d) => a + owned(S.clicks, d.id) * d.add, 0)) * mult() * upMult() * clickRb() * siteMult();
  const perSecond = () => GENS.reduce((a, d) => a + owned(S.gens, d.id) * d.cps, 0) * mult() * upMult() * passRb() * siteMult();
  const prestigeGain = () => Math.floor(Math.sqrt(S.run / PRESTIGE_DIVISOR));
  const rebirthGain = () => Math.floor(Math.cbrt(S.rrun / REBIRTH_DIVISOR));

  function earn(x) {
    S.money = Math.min(MAX_VALUE, S.money + x);
    S.run = Math.min(MAX_VALUE, S.run + x);
    S.rrun = Math.min(MAX_VALUE, S.rrun + x);
    S.total = Math.min(MAX_VALUE, S.total + x);
  }

  /* ---------- Stockage ---------- */
  const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  const store = {
    get(key) {
      return new Promise((res) => {
        if (hasChrome) chrome.storage.local.get(key, (o) => res((o && o[key]) || null));
        else { try { res(JSON.parse(localStorage.getItem(key) || 'null')); } catch (e) { res(null); } }
      });
    },
    set(key, v) {
      if (hasChrome) chrome.storage.local.set({ [key]: v });
      else { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* ignore */ } }
    }
  };
  function save() { S.lastSeen = Date.now(); store.set(SAVE_KEY, S); }

  function randomId() {
    const b = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
    else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    return Array.from(b).map((x) => (x < 16 ? '0' : '') + x.toString(16)).join('');
  }

  function migrate(o) {
    if (!o.v || o.v < 2) {
      const mapG = { stand: 'g0', shop: 'g1', factory: 'g2', bank: 'g3', corp: 'g4' };
      const mapC = { cursor: 'c0', glove: 'c1', arm: 'c2', assist: 'c3' };
      const ng = {}, nc = {};
      Object.keys(o.gens || {}).forEach((k) => { ng[mapG[k] || k] = o.gens[k]; });
      Object.keys(o.clicks || {}).forEach((k) => { nc[mapC[k] || k] = o.clicks[k]; });
      o.gens = ng; o.clicks = nc;
    }
    if (!o.rrun) o.rrun = o.run || 0;
    o.v = DATA_VERSION;
    return o;
  }

  /* ---------- Chiffrement simple de la sauvegarde ---------- */
  function hash32(str, seed) {
    let h = (0x811c9dc5 ^ seed) >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function prng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    };
  }
  function toB64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }
  function fromB64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function put32(arr, off, v) { arr[off] = v >>> 24; arr[off + 1] = (v >>> 16) & 255; arr[off + 2] = (v >>> 8) & 255; arr[off + 3] = v & 255; }
  function get32(arr, off) { return ((arr[off] << 24) | (arr[off + 1] << 16) | (arr[off + 2] << 8) | arr[off + 3]) >>> 0; }

  function encode(obj) {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    const nonce = new Uint8Array(8);
    crypto.getRandomValues(nonce);
    const rnd = prng(hash32(SECRET + Array.from(nonce).join(','), 7));
    const out = new Uint8Array(16 + bytes.length);
    out.set(nonce, 0);
    put32(out, 8, hash32(SECRET + json, 11));
    put32(out, 12, hash32(json + SECRET, 13));
    for (let i = 0; i < bytes.length; i++) {
      const k = rnd();
      out[16 + i] = ((bytes[i] + (k & 255)) & 255) ^ ((k >>> 8) & 255);
    }
    return 'RMN1.' + toB64(out);
  }

  function decode(text) {
    const t = String(text || '').replace(/\s+/g, '');
    if (t.indexOf('RMN1.') !== 0) throw new Error('format');
    let raw;
    try { raw = fromB64(t.slice(5)); } catch (e) { throw new Error('format'); }
    if (raw.length < 17) throw new Error('format');
    const nonce = raw.slice(0, 8);
    const rnd = prng(hash32(SECRET + Array.from(nonce).join(','), 7));
    const bytes = new Uint8Array(raw.length - 16);
    for (let i = 0; i < bytes.length; i++) {
      const k = rnd();
      bytes[i] = (((raw[16 + i] ^ ((k >>> 8) & 255)) - (k & 255)) & 255);
    }
    const json = new TextDecoder().decode(bytes);
    if (get32(raw, 8) !== hash32(SECRET + json, 11) || get32(raw, 12) !== hash32(json + SECRET, 13)) throw new Error('altered');
    return JSON.parse(json);
  }

  /* ---------- Validation d'une sauvegarde importée ---------- */
  function num(v, max) {
    v = Number(v);
    if (!isFinite(v) || v < 0) return 0;
    return Math.min(v, max === undefined ? MAX_VALUE : max);
  }
  function countMap(src, defs, max) {
    const out = {};
    defs.forEach((d) => {
      const n = Math.floor(num(src && src[d.id], max));
      if (n > 0) out[d.id] = n;
    });
    return out;
  }
  function sanitize(o) {
    const s = fresh();
    s.money = num(o.money); s.run = num(o.run); s.rrun = num(o.rrun); s.total = num(o.total);
    s.clicks = countMap(o.clicks, CLICKS, MAX_OWNED);
    s.gens = countMap(o.gens, GENS, MAX_OWNED);
    UPS.forEach((d) => { if (o.ups && o.ups[d.id]) s.ups[d.id] = 1; });
    s.prestige = Math.floor(num(o.prestige));
    s.resets = Math.floor(num(o.resets));
    s.rp = Math.floor(num(o.rp));
    s.rebirths = Math.floor(num(o.rebirths));
    s.over = num(o.over);
    s.clicksMade = Math.floor(num(o.clicksMade));
    RB.forEach((d) => {
      const n = Math.min(Math.floor(num(o.rb && o.rb[d.id], 100000)), d.max);
      if (n > 0) s.rb[d.id] = n;
    });
    BUTTON_SKINS.forEach((d) => { if (d.id === 'classic' || (o.skins && o.skins[d.id])) s.skins[d.id] = 1; });
    BACKGROUNDS.forEach((d) => { if (d.id === 'dark' || (o.bgs && o.bgs[d.id])) s.bgs[d.id] = 1; });
    s.skin = s.skins[o.skin] ? o.skin : 'classic';
    s.bg = s.bgs[o.bg] ? o.bg : 'dark';
    GAMES_CD_KEYS.forEach((k) => {
      const t = num(o.cd && o.cd[k], Date.now() + 3600000);
      if (t > 0) s.cd[k] = t;
    });
    const ls = num(o.lastSeen, Date.now());
    s.lastSeen = ls > 0 ? ls : Date.now();
    return s;
  }
  const GAMES_CD_KEYS = ['coins', 'memory', 'math', 'reflex'];

  /* ---------- Interface : références ---------- */
  const el = {
    money: $('#money'), cps: $('#cps'), cpc: $('#cpc'),
    earn: $('#earn'), notice: $('#notice'), siteBadge: $('#site-badge'),
    stClicks: $('#st-clicks'), stTotal: $('#st-total'), stMult: $('#st-mult'),
    listClicks: $('#list-clicks'), listGens: $('#list-gens'), listUps: $('#list-ups'), upsTitle: $('#ups-title'),
    reels: $$('#reels .reel'), spin: $('#spin'), result: $('#result'),
    betShow: $('#bet-show'),
    flipFace: $('#flip-face'), flipBtns: [$('#flip-heads'), $('#flip-tails')],
    rouFace: $('#rou-face'), rouBtns: $$('#cg-roulette [data-color]'),
    prPoints: $('#pr-points'), prGain: $('#pr-gain'), prResets: $('#pr-resets'), prHint: $('#pr-hint'),
    prestige: $('#prestige'), wipe: $('#wipe'),
    rbPoints: $('#rb-points'), rbGain: $('#rb-gain'), rbCount: $('#rb-count'), rbHint: $('#rb-hint'),
    rebirth: $('#rebirth'), rbList: $('#rb-list'),
    skinList: $('#skin-list'), bgList: $('#bg-list'),
    updates: $('#updates'), version: $('#version'),
    expFile: $('#exp-file'), expCopy: $('#exp-copy'), expText: $('#exp-text'),
    impFile: $('#imp-file'), impText: $('#imp-text'), impBtn: $('#imp-btn'), dataMsg: $('#data-msg'),
    overPer: $('#over-per'), overCount: $('#over-count'), overVal: $('#over-val'), claim: $('#claim')
  };

  const rows = { clicks: {}, gens: {}, ups: {}, rb: {}, skins: {}, bgs: {} };
  let buyMode = '1';

  /* ---------- Boutique ---------- */
  function buildShop() {
    UPS.forEach((d) => { rows.ups[d.id] = makeRow(el.listUps, () => buyUp(d)); });
    CLICKS.forEach((d) => { rows.clicks[d.id] = makeRow(el.listClicks, () => buy('clicks', d)); });
    GENS.forEach((d) => { rows.gens[d.id] = makeRow(el.listGens, () => buy('gens', d)); });
  }

  function makeRow(parent, onBuy, extraClass) {
    const item = document.createElement('div');
    item.className = 'item' + (extraClass ? ' ' + extraClass : '');
    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('div'); name.className = 'name';
    const desc = document.createElement('div'); desc.className = 'desc';
    const own = document.createElement('div'); own.className = 'owned';
    info.append(name, desc, own);
    const btn = document.createElement('button');
    const qty = document.createElement('span'); qty.className = 'qty';
    const price = document.createElement('span'); price.className = 'price';
    btn.append(qty, price);
    btn.addEventListener('click', onBuy);
    item.append(info, btn);
    parent.appendChild(item);
    return { item, name, desc, own, btn, qty, price };
  }

  function buy(kind, d) {
    const have = owned(S[kind], d.id);
    const n = buyMode === 'max' ? maxAfford(d, have, S.money) : Number(buyMode);
    if (n < 1 || have + n > MAX_OWNED * 4) return;
    const price = priceOf(d, have, n);
    if (!(S.money >= price)) return;
    S.money = Math.max(0, S.money - price);
    S[kind][d.id] = have + n;
    render();
    save();
  }

  function buyUp(d) {
    if (S.ups[d.id]) return;
    const price = d.base * discount();
    if (!(S.money >= price)) return;
    S.money = Math.max(0, S.money - price);
    S.ups[d.id] = 1;
    render();
    save();
  }

  function updateUps() {
    let teaser = false, bought = 0;
    UPS.forEach((d) => {
      const r = rows.ups[d.id];
      if (S.ups[d.id]) { bought++; r.item.style.display = 'none'; return; }
      const revealed = S.total >= d.base * 0.4;
      if (!revealed && teaser) { r.item.style.display = 'none'; return; }
      r.item.style.display = '';
      r.item.classList.toggle('locked', !revealed);
      r.name.textContent = revealed ? d.name : '???';
      r.desc.textContent = revealed ? 'x' + dec(d.mult, 2) + ' sur tous les gains' : 'Continue de gagner de l\'argent';
      r.own.textContent = '';
      r.qty.textContent = revealed ? 'Achat unique' : '';
      const price = d.base * discount();
      r.price.textContent = money(price);
      r.btn.disabled = !revealed || !(S.money >= price);
      if (!revealed) teaser = true;
    });
    el.upsTitle.textContent = 'Multiplicateurs (' + bought + ' / ' + UPS.length + ') : x' + fmt(upMult());
  }

  function updateRows(kind, defs, rowMap, text) {
    const map = S[kind];
    let teaser = false;
    defs.forEach((d) => {
      const r = rowMap[d.id];
      const have = owned(map, d.id);
      const revealed = have > 0 || S.total >= d.base * 0.4;
      if (!revealed) {
        if (teaser) { r.item.style.display = 'none'; return; }
        teaser = true;
        r.item.style.display = '';
        r.item.classList.add('locked');
        r.name.textContent = '???';
        r.desc.textContent = 'Continue de gagner de l\'argent';
        r.own.textContent = '';
        r.qty.textContent = '';
        r.price.textContent = money(d.base * discount());
        r.btn.disabled = true;
        return;
      }
      r.item.style.display = '';
      r.item.classList.remove('locked');
      r.name.textContent = d.name;
      r.desc.textContent = text(d);
      r.own.textContent = 'Possédés : ' + have;

      let n, label;
      if (buyMode === 'max') {
        n = maxAfford(d, have, S.money);
        label = n > 0 ? 'x' + n : 'Max';
        if (n < 1) n = 1;
      } else {
        n = Number(buyMode);
        label = 'x' + n;
      }
      const price = priceOf(d, have, n);
      r.qty.textContent = label;
      r.price.textContent = money(price);
      r.btn.disabled = !(S.money >= price);
    });
  }

  $$('#buy-mode button').forEach((b) => b.addEventListener('click', () => {
    buyMode = b.dataset.mode;
    $$('#buy-mode button').forEach((x) => x.classList.toggle('active', x === b));
    render();
  }));

  /* ---------- Rebirth : améliorations permanentes ---------- */
  const rbCost = (d) => Math.ceil(d.base * Math.pow(d.g, rbn(d.id)));

  function rbText(d) {
    const n = rbn(d.id);
    switch (d.id) {
      case 'click':  return 'Actuel : x' + dec(clickRb(), 2) + ' (+0,2x par achat)';
      case 'pass':   return 'Actuel : x' + dec(passRb(), 2) + ' (+0,2x par achat)';
      case 'afk':    return 'Hors ligne : ' + dec(OFFLINE_BASE_RATE * afkMult() * 100, 1) + ' % du passif (+0,2x par achat)';
      case 'casino': return 'Gains : x' + dec(casinoMult(), 2) + ' (+0,05x par achat)';
      case 'disc':   return 'Prix : x' + dec(discount(), 2) + ' (-0,02x par achat, min. x0,26)';
      case 'time':   return 'Limite : ' + fmtDur(afkLimit()) + ' (+20 min par achat, max. 36 h)';
      case 'over':   return 'Par clic : ' + dec(overPerClick(), 2) + ' surclic (+0,1 par achat)';
      default:       return String(n);
    }
  }

  function buildRebirth() {
    RB.forEach((d) => { rows.rb[d.id] = makeRow(el.rbList, () => buyRb(d), 'rp'); });
  }

  function buyRb(d) {
    const n = rbn(d.id);
    if (n >= d.max) return;
    const cost = rbCost(d);
    if (S.rp < cost) return;
    S.rp -= cost;
    S.rb[d.id] = n + 1;
    render();
    save();
  }

  function updateRebirthRows() {
    RB.forEach((d) => {
      const r = rows.rb[d.id];
      const n = rbn(d.id);
      r.name.textContent = d.name;
      r.desc.textContent = rbText(d);
      r.own.textContent = 'Niveau : ' + n + (d.max !== Infinity ? ' / ' + d.max : '');
      if (n >= d.max) {
        r.qty.textContent = '';
        r.price.textContent = 'Maximum';
        r.btn.disabled = true;
      } else {
        const cost = rbCost(d);
        r.qty.textContent = 'Points';
        r.price.textContent = fmt(cost);
        r.btn.disabled = S.rp < cost;
      }
    });
  }

  /* ---------- Cosmétiques ---------- */
  function buildCosmetics() {
    BUTTON_SKINS.forEach((d) => { rows.skins[d.id] = makeRow(el.skinList, () => cosmeticAction('skin', d), ''); });
    BACKGROUNDS.forEach((d) => { rows.bgs[d.id] = makeRow(el.bgList, () => cosmeticAction('bg', d), ''); });
  }

  function cosmeticAction(kind, d) {
    const own = kind === 'skin' ? S.skins : S.bgs;
    if (!own[d.id]) {
      if (d.rp) { if (S.rp < d.rp) return; S.rp -= d.rp; }
      else if (d.money) { if (!(S.money >= d.money)) return; S.money -= d.money; }
      own[d.id] = 1;
    }
    S[kind] = d.id;
    render();
    save();
  }

  function updateCosmetics(defs, rowMap, own, current) {
    defs.forEach((d) => {
      const r = rowMap[d.id];
      r.name.textContent = d.name;
      r.item.classList.toggle('rp', !!d.rp);
      r.item.classList.toggle('equipped', current === d.id);
      r.own.textContent = '';
      if (own[d.id]) {
        r.desc.textContent = current === d.id ? 'Équipé' : 'Possédé';
        r.qty.textContent = '';
        r.price.textContent = current === d.id ? 'Équipé' : 'Équiper';
        r.btn.disabled = current === d.id;
      } else if (d.rp) {
        r.desc.textContent = 'Prix en points de rebirth';
        r.qty.textContent = 'Points';
        r.price.textContent = fmt(d.rp);
        r.btn.disabled = S.rp < d.rp;
      } else {
        r.desc.textContent = 'Prix en argent';
        r.qty.textContent = 'Acheter';
        r.price.textContent = money(d.money);
        r.btn.disabled = !(S.money >= d.money);
      }
    });
  }

  /* ---------- Rendu ---------- */
  function render() {
    const t = money(S.money);
    el.money.textContent = t;
    el.money.style.fontSize = t.length > 24 ? '17px' : t.length > 19 ? '20px' : t.length > 14 ? '23px' : '';
    el.cps.textContent = money(perSecond()) + '/s';
    el.cpc.textContent = money(perClick()) + '/clic';
    el.stClicks.textContent = fmt(S.clicksMade);
    el.stTotal.textContent = money(S.total);
    el.stMult.textContent = 'x' + fmt(mult());
    el.siteBadge.hidden = !siteActive;

    updateUps();
    updateRows('clicks', CLICKS, rows.clicks, (d) => '+' + fmt(d.add * mult() * upMult() * clickRb() * siteMult()) + ' $ par clic');
    updateRows('gens', GENS, rows.gens, (d) => '+' + fmt(d.cps * mult() * upMult() * passRb() * siteMult()) + ' $ par seconde');

    const gain = prestigeGain();
    el.prPoints.textContent = fmt(S.prestige);
    el.prGain.textContent = '+' + fmt(gain);
    el.prResets.textContent = fmt(S.resets);
    el.prestige.disabled = gain < 1;
    el.prHint.textContent = gain < 1
      ? 'Il faut gagner ' + money(PRESTIGE_DIVISOR) + ' dans cette partie pour obtenir un premier point.'
      : 'Partie en cours : ' + money(S.run) + ' gagnés.';

    const rgain = rebirthGain();
    el.rbPoints.textContent = fmt(S.rp);
    el.rbGain.textContent = '+' + fmt(rgain);
    el.rbCount.textContent = fmt(S.rebirths);
    el.rebirth.disabled = rgain < 1;
    el.rbHint.textContent = rgain < 1
      ? 'Il faut gagner ' + money(REBIRTH_DIVISOR) + ' depuis le dernier rebirth pour obtenir 1 point. Actuel : ' + money(S.rrun) + '.'
      : 'Depuis le dernier rebirth : ' + money(S.rrun) + ' gagnés.';
    updateRebirthRows();

    updateCosmetics(BUTTON_SKINS, rows.skins, S.skins, S.skin);
    updateCosmetics(BACKGROUNDS, rows.bgs, S.bgs, S.bg);
    document.body.dataset.skin = S.skin;
    document.body.dataset.bg = S.bg;

    el.overPer.textContent = '+' + dec(overPerClick(), 2) + '/clic';
    el.overCount.textContent = fmtOver(S.over);
    el.overVal.textContent = '= ' + money(S.over * perClick());
    el.claim.disabled = !(S.over > 0);

    const canPlay = !busy && S.money >= 1;
    el.spin.disabled = !canPlay;
    el.flipBtns.forEach((b) => { b.disabled = !canPlay; });
    el.rouBtns.forEach((b) => { b.disabled = !canPlay; });
    el.betShow.textContent = 'Mise : ' + money(effBet());
  }

  /* ---------- Clic et surclics ---------- */
  el.earn.addEventListener('click', (e) => {
    const gain = perClick();
    earn(gain);
    S.over = Math.min(MAX_VALUE, S.over + overPerClick());
    S.clicksMade++;
    floatText('+' + fmt(gain), e);
    render();
  });

  el.claim.addEventListener('click', () => {
    if (!(S.over > 0)) return;
    const gain = S.over * perClick();
    S.over = 0;
    earn(gain);
    flash('Surclics réclamés : +' + money(gain));
    render();
    save();
  });

  function floatText(txt, e) {
    const zone = $('.click-zone');
    const zr = zone.getBoundingClientRect();
    const s = document.createElement('span');
    s.className = 'float';
    s.textContent = txt;
    s.style.left = (e.clientX - zr.left - 10) + 'px';
    s.style.top = (e.clientY - zr.top - 10) + 'px';
    s.addEventListener('animationend', () => s.remove());
    zone.appendChild(s);
  }

  /* ---------- Casino ---------- */
  let busy = false;
  let bet = 10;
  const effBet = () => Math.max(0, Math.min(bet, Math.floor(S.money)));

  function drawSlot() {
    let r = Math.random() * 100;
    for (let i = 0; i < SLOT_SYMS.length; i++) {
      r -= SLOT_SYMS[i].w;
      if (r < 0) return SLOT_SYMS[i].s;
    }
    return '1';
  }
  const anySlot = () => SLOT_SYMS[Math.floor(Math.random() * SLOT_SYMS.length)].s;

  function paintReel(r, sym) {
    r.textContent = sym;
    r.classList.toggle('vip', sym === 'VIP');
    r.classList.toggle('bar', sym === 'BAR');
  }

  /* Table des gains de la machine à sous. Retourne le multiplicateur de la mise. */
  function payoutSlots(r) {
    const vip = r.filter((x) => x === 'VIP').length;
    const bar = r.filter((x) => x === 'BAR').length;
    const nums = r.filter((x) => x !== 'VIP' && x !== 'BAR');

    if (vip === 3) return { mult: 18.45, label: 'Trois VIP' };
    if (vip === 2 && bar === 1) return { mult: 10.39, label: 'Deux VIP et un BAR' };
    if (bar === 2 && vip === 1) return { mult: 9.15, label: 'Deux BAR et un VIP' };
    if (bar === 3) return { mult: 16.17, label: 'Trois BAR' };
    if (vip === 2) return { mult: 8, label: 'Deux VIP' };
    if (bar === 2) return { mult: 5, label: 'Deux BAR' };
    if (vip === 1) return nums.length === 2 && nums[0] === nums[1]
      ? { mult: 5.15, label: 'VIP et paire de ' + nums[0] } : { mult: 0, label: 'Perdu' };
    if (bar === 1) return nums.length === 2 && nums[0] === nums[1]
      ? { mult: 4.39, label: 'BAR et paire de ' + nums[0] } : { mult: 0, label: 'Perdu' };

    if (r[0] === r[1] && r[1] === r[2]) {
      if (r[0] === '0') return { mult: 4.72, label: 'Trois 0' };
      if (r[0] === '6') return { mult: 0, label: 'Trois 6' };
      if (r[0] === '7') return { mult: 7, label: 'Trois 7' };
      return { mult: 3.15, label: 'Trois ' + r[0] };
    }
    if (r.indexOf('0') !== -1) return { mult: 0, label: 'Un 0' };
    if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) return { mult: 2, label: 'Paire' };
    return { mult: 0, label: 'Perdu' };
  }

  function setResult(cls, txt) {
    el.result.className = 'result ' + cls;
    el.result.textContent = txt;
  }

  function takeBet() {
    const b = effBet();
    if (b < 1) { setResult('lose', 'Solde insuffisant.'); return 0; }
    S.money -= b;
    return b;
  }

  // Les gains reçoivent le bonus de rebirth du casino puis le bonus de site, en dernier.
  function settle(b, mult, label) {
    const win = mult > 0 ? Math.floor(b * mult * casinoMult() * siteMult() * (1 + 1e-9)) : 0;
    S.money = Math.min(MAX_VALUE, S.money + win);
    if (win > b) setResult('win', label + ' : +' + money(win - b));
    else if (win > 0) setResult('lose', label + ' : ' + money(win) + ' récupérés sur ' + money(b));
    else setResult('lose', label + ' : -' + money(b));
    busy = false;
    render();
    save();
  }

  $$('#quick button').forEach((b) => b.addEventListener('click', () => {
    bet = b.dataset.bet === 'min' ? 1 : Math.max(1, Math.floor(S.money * Number(b.dataset.bet)));
    render();
  }));

  $$('#seg button').forEach((b) => b.addEventListener('click', () => {
    $$('#seg button').forEach((x) => x.classList.toggle('active', x === b));
    $$('.cgame').forEach((s) => { s.hidden = s.id !== 'cg-' + b.dataset.game; });
  }));

  // Machine à sous
  el.spin.addEventListener('click', () => {
    if (busy) return;
    const b = takeBet();
    if (!b) return;
    busy = true;
    setResult('', 'Les rouleaux tournent...');
    el.reels.forEach((r) => r.classList.add('spinning'));
    render();

    const final = [drawSlot(), drawSlot(), drawSlot()];
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
      el.reels.forEach((r, i) => {
        if (ticks >= 8 + i * 4) { paintReel(r, final[i]); r.classList.remove('spinning'); }
        else paintReel(r, anySlot());
      });
      if (ticks >= 8 + 2 * 4) {
        clearInterval(timer);
        const p = payoutSlots(final);
        settle(b, p.mult, p.label);
      }
    }, 70);
  });

  // Pile ou face
  el.flipBtns.forEach((btn, idx) => btn.addEventListener('click', () => {
    if (busy) return;
    const b = takeBet();
    if (!b) return;
    busy = true;
    el.flipFace.textContent = '...';
    setResult('', 'La pièce tourne...');
    render();
    setTimeout(() => {
      const win = Math.random() < 0.48;
      const face = win ? idx : 1 - idx;
      el.flipFace.textContent = face === 0 ? 'Pile' : 'Face';
      settle(b, win ? 2 : 0, face === 0 ? 'Pile' : 'Face');
    }, 600);
  }));

  // Roulette
  el.rouBtns.forEach((btn) => btn.addEventListener('click', () => {
    if (busy) return;
    const b = takeBet();
    if (!b) return;
    busy = true;
    setResult('', 'La bille tourne...');
    render();
    const colorOf = (n) => (n === 0 ? 'green' : REDS.indexOf(n) !== -1 ? 'red' : 'black');
    const number = Math.floor(Math.random() * 37);
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
      const shown = ticks >= 10 ? number : Math.floor(Math.random() * 37);
      el.rouFace.textContent = String(shown);
      el.rouFace.className = 'bigface ' + colorOf(shown);
      if (ticks >= 10) {
        clearInterval(timer);
        const choice = btn.dataset.color;
        const m = colorOf(number) === choice ? (choice === 'green' ? 36 : 2) : 0;
        settle(b, m, 'Numéro ' + number);
      }
    }, 70);
  }));

  /* ---------- Prestige, rebirth et réinitialisation ---------- */
  function twoStep(btn, label, action) {
    let armed = false, timer = null;
    btn.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        btn.dataset.label = btn.textContent;
        btn.textContent = label;
        timer = setTimeout(() => { armed = false; btn.textContent = btn.dataset.label; }, 3000);
        return;
      }
      clearTimeout(timer);
      armed = false;
      btn.textContent = btn.dataset.label;
      action();
    });
  }

  const keepAlways = () => ({
    total: S.total, clicksMade: S.clicksMade, cd: S.cd, resets: S.resets,
    rp: S.rp, rebirths: S.rebirths, rb: S.rb,
    skins: S.skins, bgs: S.bgs, skin: S.skin, bg: S.bg
  });

  twoStep(el.prestige, 'Confirmer le prestige', () => {
    const gain = prestigeGain();
    if (gain < 1) return;
    const keep = Object.assign(keepAlways(), {
      prestige: S.prestige + gain, resets: S.resets + 1, rrun: S.rrun, over: S.over
    });
    S = Object.assign(fresh(), keep);
    flash('Prestige effectué : +' + fmt(gain) + ' point(s).');
    render();
    save();
  });

  twoStep(el.rebirth, 'Confirmer le rebirth', () => {
    const gain = rebirthGain();
    if (gain < 1) return;
    const keep = keepAlways();
    keep.rp = S.rp + gain;
    keep.rebirths = S.rebirths + 1;
    S = Object.assign(fresh(), keep);
    flash('Rebirth effectué : +' + fmt(gain) + ' point(s) de rebirth.');
    render();
    save();
  });

  twoStep(el.wipe, 'Confirmer la suppression', () => {
    S = fresh();
    flash('Sauvegarde réinitialisée.');
    render();
    save();
  });

  /* ---------- Infos : mises à jour, crédits, sauvegarde ---------- */
  function renderInfos() {
    el.updates.innerHTML = '';
    UPDATES.forEach((u) => {
      const box = document.createElement('div'); box.className = 'upd';
      const head = document.createElement('div'); head.className = 'upd-head';
      const v = document.createElement('span'); v.className = 'upd-v'; v.textContent = 'Version ' + u.v;
      const d = document.createElement('span'); d.className = 'upd-d'; d.textContent = u.d;
      head.append(v, d);
      const ul = document.createElement('ul');
      u.notes.forEach((n) => { const li = document.createElement('li'); li.textContent = n; ul.appendChild(li); });
      box.append(head, ul);
      el.updates.appendChild(box);
    });
    el.version.textContent = 'Romanomoney - version ' + VERSION;
  }

  function dataMsg(cls, txt) {
    el.dataMsg.className = 'datamsg ' + cls;
    el.dataMsg.textContent = txt;
  }

  function buildExport() {
    save();
    return encode({ g: 'romanomoney', ver: VERSION, dev: meta.id, t: Date.now(), s: S });
  }

  el.expFile.addEventListener('click', () => {
    try {
      const code = buildExport();
      el.expText.value = code;
      const blob = new Blob([code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'romanomoney-sauvegarde.rmn';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      dataMsg('good', 'Fichier exporté.');
    } catch (e) {
      dataMsg('bad', 'Export impossible.');
    }
  });

  el.expCopy.addEventListener('click', () => {
    try {
      const code = buildExport();
      el.expText.value = code;
      el.expText.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      if (!ok && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(() => dataMsg('good', 'Code copié.'), () => dataMsg('bad', 'Copie impossible, copie le code à la main.'));
        return;
      }
      dataMsg(ok ? 'good' : 'bad', ok ? 'Code copié.' : 'Copie impossible, copie le code à la main.');
    } catch (e) {
      dataMsg('bad', 'Export impossible.');
    }
  });

  function importCode(text) {
    let data;
    try { data = decode(text); } catch (e) {
      return dataMsg('bad', e.message === 'altered' ? 'Fichier modifié ou corrompu.' : 'Fichier non reconnu.');
    }
    if (!data || data.g !== 'romanomoney' || !data.s || typeof data.s !== 'object') return dataMsg('bad', 'Fichier non reconnu.');
    S = sanitize(data.s);
    applyOffline();
    render();
    save();
    el.impText.value = '';
    dataMsg('good', 'Sauvegarde importée.');
  }

  el.impBtn.addEventListener('click', () => importCode(el.impText.value));
  el.impFile.addEventListener('change', () => {
    const f = el.impFile.files && el.impFile.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => { el.impText.value = String(fr.result || ''); importCode(el.impText.value); el.impFile.value = ''; };
    fr.onerror = () => dataMsg('bad', 'Lecture du fichier impossible.');
    fr.readAsText(f);
  });

  /* ---------- Divers ---------- */
  let flashTimer = null;
  function flash(msg) {
    el.notice.textContent = msg;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { el.notice.textContent = ''; }, 6000);
  }

  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + t.dataset.tab));
  }));

  /* ---------- API pour les mini-jeux ---------- */
  window.Game = {
    unit: () => Math.max(perClick() * 25, perSecond() * 45),
    earn: (x) => { earn(x); render(); save(); },
    fmt, money, flash,
    cdLeft: (id) => Math.max(0, ((S.cd || {})[id] || 0) - Date.now()),
    cdStart: (id, sec) => { S.cd = S.cd || {}; S.cd[id] = Date.now() + sec * 1000; save(); }
  };

  /* ---------- Démarrage ---------- */
  function detectSite() {
    return new Promise((res) => {
      try {
        if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) return res(false);
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime && chrome.runtime.lastError) return res(false);
          const url = (tabs && tabs[0] && tabs[0].url) || '';
          res(SITE_PREFIXES.some((p) => url.indexOf(p) === 0));
        });
      } catch (e) { res(false); }
    });
  }

  function applyOffline() {
    const raw = Math.max(0, Date.now() - (S.lastSeen || Date.now()));
    if (raw < 60000) return;
    const limit = afkLimit();
    const delta = Math.min(raw, limit);
    const rate = OFFLINE_BASE_RATE * afkMult();
    const gained = perSecond() * rate * delta / 1000;
    if (gained >= 1) {
      earn(gained);
      flash('Hors ligne (' + fmtDur(delta) + (raw > limit ? ', limite atteinte' : '') + ') : +' + money(gained));
    }
  }

  function start() {
    buildShop();
    buildRebirth();
    buildCosmetics();
    renderInfos();
    applyOffline();
    render();
    setInterval(() => {
      const cps = perSecond();
      if (cps > 0) { earn(cps / 10); render(); }
    }, 100);
    setInterval(save, 2000);
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', save);
  }

  Promise.all([store.get(SAVE_KEY), store.get(META_KEY), detectSite()]).then((r) => {
    const saved = r[0];
    meta = (r[1] && r[1].id) ? r[1] : { id: randomId() };
    if (!r[1] || !r[1].id) store.set(META_KEY, meta);
    siteActive = r[2];
    if (saved && typeof saved === 'object') S = Object.assign(fresh(), migrate(saved));
    start();
  });
})();
