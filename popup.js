(() => {
  'use strict';

  /* ---------- Constantes ---------- */
  const VERSION = '1.6.0';
  const DATA_VERSION = 4;
  const PRESTIGE_BONUS = 0.10;       // +10 % par point de prestige
  const PRESTIGE_DIVISOR = 1e9;      // 1 point de prestige pour 1 milliard $ gagné dans la partie
  const REBIRTH_DIVISOR = 1e24;      // 1 point de rebirth pour 1 quadrillion $ gagné depuis le dernier rebirth
  const OFFLINE_BASE_RATE = 0.2;     // 20 % du revenu passif hors ligne
  const AFK_BASE_MS = 8 * 3600 * 1000;
  const AFK_MAX_MS = 36 * 3600 * 1000;
  const AFK_STEP_MS = 20 * 60 * 1000;
  const SAVE_KEY = 'makeMoneySave';
  const META_KEY = 'romanomoneyMeta';
  const MAX_OWNED = 1e6;
  const MAX_BUY = 100000;
  const SITE_PREFIXES = ['https://rromanou.github.io/', 'https://caplotz.github.io/'];
  const SITE_MULT = 1.15;
  const SECRET = 'rmn-v1|Romanomoney|k7Qz#92';

  /* ---------- Grands nombres sans limite : mantisse m dans [1, 10[ et exposant entier e ---------- */
  class Big { constructor(m, e) { this.m = m; this.e = e; } }
  const ZERO = new Big(0, 0), ONE = new Big(1, 0);

  function mk(m, e) {
    if (!(m > 0) || !isFinite(m)) return ZERO;
    if (m >= 10 || m < 1) {
      const k = Math.floor(Math.log10(m));
      m = m / Math.pow(10, k); e += k;
      if (m >= 10) { m /= 10; e++; } else if (m < 1) { m *= 10; e--; }
    }
    return new Big(m, e);
  }
  const NUM_RE = /^(\d+\.?\d*|\.\d+)(?:e([+-]?\d+))?$/;
  function from(x) {
    if (x instanceof Big) return x;
    if (typeof x === 'number') return isFinite(x) && x > 0 ? mk(x, 0) : ZERO;
    if (typeof x === 'string') {
      const r = NUM_RE.exec(x.trim().replace(',', '.').toLowerCase());
      if (r) {
        const m = parseFloat(r[1]), e = r[2] ? parseInt(r[2], 10) : 0;
        if (isFinite(m) && Math.abs(e) < 1e9) return mk(m, e);
      }
    }
    return ZERO;
  }
  // Vrai si la valeur est un nombre acceptable (nombre positif, texte comme "1,5e400" ou Big)
  function valid(x) {
    if (x instanceof Big) return true;
    if (typeof x === 'number') return isFinite(x) && x >= 0;
    if (typeof x === 'string') {
      const r = NUM_RE.exec(x.trim().replace(',', '.').toLowerCase());
      return !!r && isFinite(parseFloat(r[1])) && (!r[2] || Math.abs(parseInt(r[2], 10)) < 1e9);
    }
    return false;
  }
  function cmp(a, b) {
    a = from(a); b = from(b);
    if (a.m === 0) return b.m === 0 ? 0 : -1;
    if (b.m === 0) return 1;
    if (a.e !== b.e) return a.e > b.e ? 1 : -1;
    const d = a.m - b.m;
    if (Math.abs(d) <= 1e-11 * b.m) return 0;
    return d > 0 ? 1 : -1;
  }
  const lt = (a, b) => cmp(a, b) < 0;
  const gt = (a, b) => cmp(a, b) > 0;
  const gte = (a, b) => cmp(a, b) >= 0;
  const lte = (a, b) => cmp(a, b) <= 0;
  const isZero = (a) => from(a).m === 0;
  const bmax = (a, b) => (cmp(a, b) >= 0 ? from(a) : from(b));
  const bmin = (a, b) => (cmp(a, b) <= 0 ? from(a) : from(b));
  function add(a, b) {
    a = from(a); b = from(b);
    if (a.m === 0) return b;
    if (b.m === 0) return a;
    if (a.e < b.e) { const t = a; a = b; b = t; }
    const d = a.e - b.e;
    if (d > 17) return a;
    return mk(a.m + b.m / Math.pow(10, d), a.e);
  }
  function sub(a, b) {
    a = from(a); b = from(b);
    if (cmp(a, b) <= 0) return ZERO;
    if (b.m === 0) return a;
    const d = a.e - b.e;
    if (d > 17) return a;
    return mk(a.m - b.m / Math.pow(10, d), a.e);
  }
  function mul(a, b) {
    a = from(a); b = from(b);
    if (a.m === 0 || b.m === 0) return ZERO;
    return mk(a.m * b.m, a.e + b.e);
  }
  function div(a, b) {
    a = from(a); b = from(b);
    if (a.m === 0 || b.m === 0) return ZERO;
    return mk(a.m / b.m, a.e - b.e);
  }
  function pow10(l) {
    if (!isFinite(l)) return ZERO;
    const e = Math.floor(l);
    return mk(Math.pow(10, l - e), e);
  }
  const log10 = (a) => { a = from(a); return a.m === 0 ? -Infinity : a.e + Math.log10(a.m); };
  // base (nombre) puissance n (nombre) ; exact quand le résultat est petit
  function powN(base, n) {
    const l = n * Math.log10(base);
    if (l < 15 && l > -15) return from(Math.pow(base, n));
    return pow10(l);
  }
  function toNum(a) {
    a = from(a);
    if (a.m === 0) return 0;
    if (a.e > 308) return Infinity;
    if (a.e < -323) return 0;
    return a.m * Math.pow(10, a.e);
  }
  function floor(a) {
    a = from(a);
    if (a.e >= 15 || a.m === 0) return a;
    return from(Math.floor(toNum(a) * (1 + 1e-12)));
  }
  function ceil(a) {
    a = from(a);
    if (a.e >= 15 || a.m === 0) return a;
    return from(Math.ceil(toNum(a) * (1 - 1e-12)));
  }
  function sqrt(a) {
    a = from(a);
    if (a.m === 0) return ZERO;
    const r = ((a.e % 2) + 2) % 2;
    return mk(Math.sqrt(a.m * Math.pow(10, r)), (a.e - r) / 2);
  }
  function cbrt(a) {
    a = from(a);
    if (a.m === 0) return ZERO;
    const r = ((a.e % 3) + 3) % 3;
    return mk(Math.cbrt(a.m * Math.pow(10, r)), (a.e - r) / 3);
  }
  const bstr = (a) => { a = from(a); return a.m === 0 ? '0' : String(Number(a.m.toPrecision(15))) + 'e' + a.e; };
  const B = { Big, ZERO, ONE, from, valid, cmp, lt, gt, gte, lte, isZero, max: bmax, min: bmin, add, sub, mul, div, pow10, log10, powN, toNum, floor, ceil, sqrt, cbrt, str: bstr };


  const UPDATES = [
    {
      v: '1.6.0', d: '26 octobre 2026',
      notes: [
        'Liaison avec le site Communicer : le jeu peut maintenant s\'ouvrir sur https://rromanou.github.io/Communicer/ et y sauvegarde ta progression dans ton compte, pour la retrouver même si tu perds ton ordinateur.',
        'Infos, Sauvegarde : nouvelle option « Charger automatiquement la progression ». Quand tu ouvres le site, la progression la plus avancée est gardée des deux côtés, dans cet ordre : rebirths, prestiges, améliorations, argent.',
        'Infos, Sauvegarde : nouveau bouton « Actualiser », vert seulement quand tu es sur le site. Il envoie ta sauvegarde chiffrée au site, qui remplace son ancienne sauvegarde par celle de l\'extension.',
        'Hors du site, l\'extension fonctionne toute seule et ne se connecte jamais à un serveur.',
        'Nouveau fichier sync.js qui gère toute cette liaison.'
      ]
    },
    {
      v: '1.5.0', d: '26 octobre 2026',
      notes: [
        'Plus aucune limite d\'argent : les nombres montent maintenant sans plafond (notation 1,23e456 et au-delà).',
        'Deuxième ère de contenu : 477 améliorations de clic, 399 revenus passifs, 119 multiplicateurs et 80 technologies, avec des secteurs d\'Andromède à Kepler.',
        'Après un prestige ou un rebirth, les améliorations trop chères disparaissent de la boutique jusqu\'à ce que tu aies gagné assez d\'argent pour les revoir. Les achats uniques déjà obtenus restent cachés.',
        'Boutique en colonnes : clics, passifs, multiplicateurs et recherche côte à côte. La fenêtre s\'élargit dans la boutique.',
        'Nouvelle catégorie Recherche : 80 technologies à achat unique (clics, passif, surclics, mini-jeux, cochon, casino, prix, clics automatiques). Elles survivent au prestige mais pas au rebirth.',
        '9 nouvelles améliorations de rebirth : multiplicateur global, bonus et gain de prestige, gain de rebirth, valeur des surclics, gains et délai des mini-jeux, cochon généreux, capital de départ.',
        '12 nouveaux styles avec images (6 boutons, 6 arrière-plans), beaucoup plus chers.',
        'Revenu hors ligne refait : il s\'accumule dans un cochon tirelire. Une fenêtre t\'affiche tes gains à ton retour, et tu casses le cochon avec un petit jeu de timing. La limite est le montant maximum du cochon.',
        'Nouveaux jeux : Taupes, Simon, Plus ou moins et Attrape-pièces dans les mini-jeux, Dés au casino.'
      ]
    },
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
  const sig2B = (b) => (b.m === 0 ? b : mk(Number(b.m.toPrecision(2)), b.e));

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

  /* Deuxième ère : des secteurs de la galaxie */
  const PLACES = ['d\'Andromède', 'de Cassiopée', 'de Sirius', 'd\'Orion', 'de Véga', 'd\'Antarès', 'de Pégase', 'de Bételgeuse', 'de l\'Hydre', 'de Kepler'];
  PLACES.forEach((p) => {
    ['Clic', 'Poing', 'Frappe', 'Toucher', 'Doigt', 'Souffle'].forEach((n) => CLICK_NAMES.push(n + ' ' + p));
    ['Forge', 'Banque', 'Bourse', 'Fabrique', 'Citadelle', 'Flotte', 'Raffinerie', 'Académie', 'Armada', 'Chantier'].forEach((n) => GEN_NAMES.push(n + ' ' + p));
    ['Pacte', 'Traité', 'Édit'].forEach((n) => UP_NAMES.push(n + ' ' + p));
  });

  function buildUps() {
    const out = [];
    const decade = (k, a) => a[Math.min(a.length - 1, Math.floor(k / 10))];
    UP_NAMES.forEach((name, k) => {
      out.push({ id: 'u' + k, name, base: sig2B(pow10(3 + 9.3 * k)), mult: decade(k, [1.5, 2, 3, 4, 5, 6]) });
      if (k < UP_NAMES.length - 1) {
        out.push({
          id: 'v' + k, name: name + ' ' + TIER_SUFFIX[k % TIER_SUFFIX.length],
          base: sig2B(pow10(3 + 9.3 * (k + 0.5))), mult: decade(k, [1.25, 1.5, 2, 2.5, 3, 4])
        });
      }
    });
    out.forEach((d) => { d.revealB = mul(d.base, 0.4); });
    return out;
  }
  const UPS = buildUps();

  function buildClicks() {
    const es = [];
    let e = 0;
    CLICK_NAMES.forEach((n, i) => { if (i > 0) e += i < 22 ? 1 + 0.2 * (i - 1) : i < 60 ? 5.7 : 6.5; es.push(e); });
    const tier = (id, name, ex, t) => {
      const base = sig2B(pow10(Math.log10(15) + ex));
      const dv = mul(15, mul(powN(1.27, Math.min(t, 60)), powN(1.08, Math.max(0, t - 60))));
      return { id, name, base, add: sig2B(div(base, dv)), g: 1.18 + 0.003 * t, revealB: mul(base, 0.4) };
    };
    const out = [];
    CLICK_NAMES.forEach((name, i) => {
      out.push(tier('c' + i, name, es[i], i));
      if (i < CLICK_NAMES.length - 1) {
        const sfx = (o) => TIER_SUFFIX[(i + o) % TIER_SUFFIX.length];
        const gap = es[i + 1] - es[i];
        out.push(tier('e' + i, name + ' ' + sfx(4), es[i] + gap * 0.25, i + 0.25));
        out.push(tier('d' + i, name + ' ' + sfx(0), (es[i] + es[i + 1]) / 2, i + 0.5));
        out.push(tier('f' + i, name + ' ' + sfx(8), es[i] + gap * 0.75, i + 0.75));
      }
    });
    return out;
  }

  function buildGens() {
    const es = [];
    let e = 0;
    GEN_NAMES.forEach((n, i) => { if (i > 0) e += i < 40 ? 1 + 0.055 * (i - 1) : i < 100 ? 3.4 : 3.8; es.push(e); });
    const tier = (id, name, ex, t) => {
      const base = sig2B(pow10(Math.log10(50) + ex));
      const dv = mul(100, mul(powN(1.08, Math.min(t, 100)), powN(1.03, Math.max(0, t - 100))));
      return { id, name, base, cps: sig2B(div(base, dv)), g: 1.16 + 0.002 * t, revealB: mul(base, 0.4) };
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

  /* Recherche : 80 technologies à achat unique (8 types x 10 niveaux), survivent au prestige */
  const TECH_TYPES = ['click', 'pass', 'over', 'mini', 'pig', 'casino', 'disc', 'auto'];
  const TECH_NAMES = [
    ['Ergonomie du poste', 'Souris gaming', 'Gants haptiques', 'Interface neuronale', 'Clic quantique'],
    ['Comptabilité rigoureuse', 'Gestion des stocks', 'Logistique mondiale', 'Chaîne d\'approvisionnement cosmique', 'Économie circulaire universelle'],
    ['Habitude du clic', 'Rythme soutenu', 'Cadence infernale', 'Flux continu', 'Rafale perpétuelle'],
    ['Échauffement', 'Entraînement quotidien', 'Concentration zen', 'Maîtrise des jeux', 'Sixième sens'],
    ['Cochon bien nourri', 'Fente élargie', 'Cochon en acier', 'Coffre-fort rose', 'Tirelire sans fond'],
    ['Porte-bonheur', 'Trèfle à quatre feuilles', 'Dés pipés légalement', 'Étoile de la chance', 'Faveur du hasard'],
    ['Négociation', 'Fournisseurs directs', 'Commandes en gros', 'Contrats exclusifs', 'Monopole d\'achat'],
    ['Script de clic', 'Robot cliqueur', 'Escouade de bots', 'Ferme de clics', 'Armée d\'automates']
  ];
  const TECH_VALS = {
    click: [1.5, 1.8, 2.2, 3, 4, 5, 6.5, 8, 10, 15], pass: [1.5, 1.8, 2.2, 3, 4, 5, 6.5, 8, 10, 15],
    over: [0.05, 0.08, 0.12, 0.18, 0.25, 0.3, 0.4, 0.55, 0.75, 1],
    mini: [1.2, 1.3, 1.5, 1.8, 2.2, 2.5, 3, 3.5, 4, 5], pig: [1.2, 1.3, 1.5, 1.8, 2.2, 2.5, 3, 3.5, 4, 5],
    casino: [1.03, 1.04, 1.05, 1.07, 1.1, 1.12, 1.15, 1.2, 1.25, 1.3],
    disc: [0.98, 0.97, 0.96, 0.95, 0.93, 0.92, 0.9, 0.88, 0.85, 0.8],
    auto: [0.5, 1.5, 4, 10, 25, 60, 150, 400, 1000, 3000]
  };
  const TECHS = [];
  for (let c = 0; c < 10; c++) {
    TECH_TYPES.forEach((type, t) => {
      const k = c * 8 + t;
      const base = sig2B(pow10(5 + 6.3 * k));
      TECHS.push({ id: 't' + k, name: TECH_NAMES[t][c % 5] + (c >= 5 ? ' II' : ''), type, val: TECH_VALS[type][c], base, revealB: mul(base, 0.4) });
    });
  }
  const BY = { clicks: {}, gens: {}, ups: {}, tech: {} };
  CLICKS.forEach((d) => { BY.clicks[d.id] = d; });
  GENS.forEach((d) => { BY.gens[d.id] = d; });
  UPS.forEach((d) => { BY.ups[d.id] = d; });
  TECHS.forEach((d) => { BY.tech[d.id] = d; });
  const TECH_OF = {};
  TECH_TYPES.forEach((t) => { TECH_OF[t] = TECHS.filter((d) => d.type === t); });

  /* Améliorations permanentes de rebirth (prix de base donnés, croissance par achat) */
  const RB = [
    { id: 'click',  name: 'Multiplicateur par clic', base: 1, g: 1.35, max: Infinity },
    { id: 'pass',   name: 'Revenu passif',           base: 1, g: 1.35, max: Infinity },
    { id: 'afk',    name: 'Revenu AFK',              base: 4, g: 1.40, max: Infinity },
    { id: 'casino', name: 'Gains au casino',         base: 7, g: 1.45, max: Infinity },
    { id: 'disc',   name: 'Prix des améliorations',  base: 8, g: 1.45, max: 37 },
    { id: 'time',   name: 'Limite de temps AFK',     base: 25, g: 1.25, max: 84 },
    { id: 'over',   name: 'Surclics permanents',     base: 15, g: 1.32, max: Infinity },
    { id: 'glob',   name: 'Multiplicateur global',   base: 20, g: 1.5, max: Infinity },
    { id: 'prest',  name: 'Bonus de prestige',       base: 10, g: 1.4, max: 40 },
    { id: 'prgain', name: 'Gain de prestige',        base: 6, g: 1.4, max: Infinity },
    { id: 'rbgain', name: 'Gain de rebirth',         base: 15, g: 1.5, max: Infinity },
    { id: 'claim',  name: 'Valeur des surclics',     base: 12, g: 1.4, max: Infinity },
    { id: 'mini',   name: 'Gains des mini-jeux',     base: 5, g: 1.35, max: Infinity },
    { id: 'cdr',    name: 'Délai des mini-jeux',     base: 6, g: 1.4, max: 20 },
    { id: 'pig',    name: 'Cochon généreux',         base: 10, g: 1.5, max: 8 },
    { id: 'start',  name: 'Capital de départ',       base: 5, g: 1.6, max: Infinity }
  ];

  /* Cosmétiques : money = prix en argent, rp = prix en points de rebirth, img = image, sw = couleur d'aperçu */
  const BUTTON_SKINS = [
    { id: 'classic', name: 'Classique',       sw: '#3ddc84' },
    { id: 'ocean',   name: 'Océan',           sw: '#2aa9e8', money: 1e7 },
    { id: 'ember',   name: 'Braise',          sw: '#ff6a2b', money: 1e15 },
    { id: 'violet',  name: 'Améthyste',       sw: '#9b5cf0', money: 1e24 },
    { id: 'gold',    name: 'Or massif',       sw: '#f2c14e', rp: 3 },
    { id: 'neon',    name: 'Néon',            sw: '#ff3df2', rp: 6 },
    { id: 'void',    name: 'Néant',           sw: '#14141f', rp: 12 },
    { id: 'planet',  name: 'Planète bleue',   img: 'assets/btn-planet.jpg',  money: 1e40 },
    { id: 'lava',    name: 'Lave en fusion',  img: 'assets/btn-lava.jpg',    money: 1e80 },
    { id: 'crystal', name: 'Cristal',         img: 'assets/btn-crystal.jpg', money: 1e130 },
    { id: 'circuit', name: 'Circuit imprimé', img: 'assets/btn-circuit.jpg', money: 1e200 },
    { id: 'coin',    name: 'Pièce gravée',    img: 'assets/btn-coin.jpg',    rp: 60 },
    { id: 'prism',   name: 'Prisme',          img: 'assets/btn-prism.jpg',   rp: 250 }
  ];
  const BACKGROUNDS = [
    { id: 'dark',      name: 'Sombre',        sw: '#0f1613' },
    { id: 'forest',    name: 'Forêt',         sw: '#143321', money: 5e7 },
    { id: 'midnight',  name: 'Nuit bleue',    sw: '#14234a', money: 5e15 },
    { id: 'dusk',      name: 'Crépuscule',    sw: '#43204a', money: 5e24 },
    { id: 'aurora',    name: 'Aurore',        sw: '#0d3a3a', rp: 4 },
    { id: 'galaxy',    name: 'Galaxie',       sw: '#1a0f3a', rp: 9 },
    { id: 'nebula',    name: 'Nébuleuse',     img: 'assets/bg-nebula.jpg',    money: 1e50 },
    { id: 'mountains', name: 'Montagnes',     img: 'assets/bg-mountains.jpg', money: 1e100 },
    { id: 'synth',     name: 'Ville néon',    img: 'assets/bg-synth.jpg',     money: 1e160 },
    { id: 'deep',      name: 'Océan profond', img: 'assets/bg-deep.jpg',      money: 1e230 },
    { id: 'marble',    name: 'Marbre et or',  img: 'assets/bg-marble.jpg',    rp: 100 },
    { id: 'matrix',    name: 'Pluie de code', img: 'assets/bg-matrix.jpg',    rp: 300 }
  ];

  /* Machine à sous : 12 symboles pondérés (total 100) */
  const SLOT_SYMS = [
    { s: '1', w: 10 }, { s: '2', w: 10 }, { s: '3', w: 10 }, { s: '4', w: 10 }, { s: '5', w: 10 },
    { s: '6', w: 10 }, { s: '7', w: 10 }, { s: '8', w: 10 }, { s: '9', w: 10 },
    { s: '0', w: 5 }, { s: 'BAR', w: 3 }, { s: 'VIP', w: 2 }
  ];
  const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

  const BIG_FIELDS = ['money', 'run', 'rrun', 'total', 'pig', 'prestige', 'rp'];
  const fresh = () => ({
    v: DATA_VERSION,
    money: ZERO, run: ZERO, rrun: ZERO, total: ZERO,
    clicks: {}, gens: {}, ups: {}, tech: {}, pig: ZERO,
    prestige: ZERO, resets: 0,
    rp: ZERO, rebirths: 0, rb: {},
    over: 0, clicksMade: 0, cd: {},
    skins: { classic: 1 }, bgs: { dark: 1 }, skin: 'classic', bg: 'dark',
    lastSeen: Date.now()
  });
  // Les grands nombres sont stockés et exportés sous forme de texte ("1,5e400")
  function pack(s) {
    const o = Object.assign({}, s);
    BIG_FIELDS.forEach((k) => { o[k] = bstr(s[k]); });
    return o;
  }
  function unpack(o) {
    BIG_FIELDS.forEach((k) => { o[k] = from(o[k]); });
    return o;
  }

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

  // Accepte un nombre ou un grand nombre
  function fmt(x) {
    const b = from(x);
    if (b.m === 0) return '0';
    const e = b.e;
    if (e < 3) {
      const n = toNum(b);
      return n < 10 && n % 1 !== 0 ? dec(n, 2) : String(Math.floor(n * (1 + 1e-12)));
    }
    if (e < 6) return sig3(toNum(b) / 1000) + ' K';
    if (e <= 123) {
      const g = e - (e % 3);
      const v = b.m * Math.pow(10, e - g);
      return sig3(v) + ' ' + NAMES[g] + (v >= 2 ? 's' : '');
    }
    let m = Number(b.m.toPrecision(3)), ee = e;
    if (m >= 10) { m /= 10; ee++; }
    return m.toFixed(2).replace('.', ',') + 'e' + ee;
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
    if (ms < 60000) return Math.max(0, Math.round(ms / 1000)) + ' s';
    const mins = Math.round(ms / 60000);
    if (mins < 60) return mins + ' min';
    const h = Math.floor(mins / 60), m = mins % 60;
    return h + ' h' + (m ? ' ' + (m < 10 ? '0' : '') + m : '');
  }

  /* ---------- Calculs ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const owned = (map, id) => map[id] || 0;
  const rbn = (id) => (S.rb && S.rb[id]) || 0;

  const techOwned = (type) => TECH_OF[type].filter((d) => S.tech && S.tech[d.id]);
  const techProd = (type) => techOwned(type).reduce((a, d) => a * d.val, 1);
  const techSum = (type) => techOwned(type).reduce((a, d) => a + d.val, 0);

  const discount = () => Math.max(0.2, (1 - 0.02 * rbn('disc')) * techProd('disc'));
  const clickRb = () => 1 + 0.2 * rbn('click');
  const passRb = () => 1 + 0.2 * rbn('pass');
  const globMult = () => 1 + 0.1 * rbn('glob');
  const afkMult = () => (1 + 0.2 * rbn('afk')) * techProd('pig');
  const casinoMult = () => (1 + 0.05 * rbn('casino')) * techProd('casino');
  const miniMult = () => (1 + 0.1 * rbn('mini')) * techProd('mini');
  const cdrMult = () => 1 - 0.03 * Math.min(20, rbn('cdr'));
  const afkLimit = () => Math.min(AFK_MAX_MS, AFK_BASE_MS + AFK_STEP_MS * rbn('time'));
  const overPerClick = () => 0.2 + 0.1 * rbn('over') + techSum('over');
  const claimMult = () => 1 + 0.1 * rbn('claim');
  const startMoney = () => (rbn('start') > 0 ? mul(1000, powN(5, rbn('start'))) : ZERO);
  const siteMult = () => (siteActive ? SITE_MULT : 1);

  // Prix de n achats consécutifs : base * g^possédés * (g^n - 1) / (g - 1) * réduction
  function priceOf(d, have, n, disc) {
    const first = mul(d.base, powN(d.g, have));
    if (n === 1) return mul(first, disc);
    const geo = div(sub(powN(d.g, n), ONE), d.g - 1);
    return mul(mul(first, geo), disc);
  }
  function maxAfford(d, have, budget, disc) {
    const first = priceOf(d, have, 1, disc);
    if (lt(budget, first)) return 0;
    const lg = Math.log10(d.g);
    const x = add(mul(div(budget, first), d.g - 1), ONE);
    const lim = Math.min(MAX_BUY, Math.max(0, MAX_OWNED - have));
    let n = Math.floor(log10(x) / lg);
    if (!isFinite(n) || n < 1) n = 1;
    n = Math.min(n, lim);
    while (n > 1 && gt(priceOf(d, have, n, disc), budget)) n--;
    while (n < lim && lte(priceOf(d, have, n + 1, disc), budget)) n++;
    return n;
  }

  const mult = () => add(1, mul(PRESTIGE_BONUS + 0.01 * rbn('prest'), S.prestige));
  const upMult = () => {
    let a = ONE;
    Object.keys(S.ups || {}).forEach((id) => { const d = BY.ups[id]; if (d && S.ups[id]) a = mul(a, d.mult); });
    return a;
  };
  const clickFactor = () => mul(mul(mult(), upMult()), clickRb() * techProd('click') * globMult() * siteMult());
  const passFactor = () => mul(mul(mult(), upMult()), passRb() * techProd('pass') * globMult() * siteMult());
  function perClick(cf) {
    let a = ONE;
    Object.keys(S.clicks).forEach((id) => { const d = BY.clicks[id]; if (d) a = add(a, mul(d.add, S.clicks[id])); });
    return mul(a, cf || clickFactor());
  }
  // Les clics automatiques (Recherche) rapportent la valeur d'un clic, par seconde
  function perSecond(pf, cf) {
    let a = ZERO;
    Object.keys(S.gens).forEach((id) => { const d = BY.gens[id]; if (d) a = add(a, mul(d.cps, S.gens[id])); });
    a = mul(a, pf || passFactor());
    const au = techSum('auto');
    return au > 0 ? add(a, mul(perClick(cf), au)) : a;
  }
  const prestigeGain = () => floor(mul(sqrt(div(S.run, PRESTIGE_DIVISOR)), 1 + 0.1 * rbn('prgain')));
  const rebirthGain = () => floor(mul(cbrt(div(S.rrun, REBIRTH_DIVISOR)), 1 + 0.1 * rbn('rbgain')));

  // Cochon : revenu hors ligne et capacité (la limite de temps AFK fixe le montant maximum)
  const pigRate = () => mul(perSecond(), OFFLINE_BASE_RATE * afkMult());
  const pigCap = () => mul(pigRate(), afkLimit() / 1000);

  function earn(x) {
    x = from(x);
    S.money = add(S.money, x);
    S.run = add(S.run, x);
    S.rrun = add(S.rrun, x);
    S.total = add(S.total, x);
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
  function save() { S.lastSeen = Date.now(); store.set(SAVE_KEY, pack(S)); }
  // Points d'accès pour sync.js (liaison avec le site)
  window.__rmn = {
    ver: VERSION,
    exportCode: () => { save(); return encode({ g: 'romanomoney', ver: VERSION, dev: meta.id, t: Date.now(), s: pack(S) }); },
    importCode: (code) => { const d = decode(code); if (!d || d.g !== 'romanomoney' || !d.s) throw new Error('format'); S = sanitize(d.s); render(); save(); },
    applyPacked: (o) => { S = sanitize(o); render(); save(); },
    setSite: (v) => { siteActive = !!v; render(); }
  };


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
    return Math.min(v, max === undefined ? 1e15 : max);
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
    s.money = from(o.money); s.run = from(o.run); s.rrun = from(o.rrun); s.total = from(o.total);
    s.clicks = countMap(o.clicks, CLICKS, MAX_OWNED);
    s.gens = countMap(o.gens, GENS, MAX_OWNED);
    UPS.forEach((d) => { if (o.ups && o.ups[d.id]) s.ups[d.id] = 1; });
    TECHS.forEach((d) => { if (o.tech && o.tech[d.id]) s.tech[d.id] = 1; });
    s.pig = from(o.pig);
    s.prestige = floor(from(o.prestige));
    s.resets = Math.floor(num(o.resets));
    s.rp = floor(from(o.rp));
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

  const GAMES_CD_KEYS = ['coins', 'memory', 'math', 'reflex', 'mole', 'simon', 'hilo', 'catch'];

  /* ---------- Interface : références ---------- */
  const el = {
    money: $('#money'), cps: $('#cps'), cpc: $('#cpc'),
    earn: $('#earn'), notice: $('#notice'), siteBadge: $('#site-badge'),
    stClicks: $('#st-clicks'), stTotal: $('#st-total'), stMult: $('#st-mult'),
    listClicks: $('#list-clicks'), listGens: $('#list-gens'), listUps: $('#list-ups'), upsTitle: $('#ups-title'),
    listTech: $('#list-tech'), techTitle: $('#tech-title'),
    diceFace: $('#dice-face'), diceBtns: $$('#cg-dice [data-dice]'),
    afkModal: $('#afk-modal'), afkAway: $('#afk-away'), afkGain: $('#afk-gain'), afkTotal: $('#afk-total'),
    afkGo: $('#afk-go'), afkClose: $('#afk-close'),
    adminModal: $('#admin-modal'), adminText: $('#admin-text'), adminCode: $('#admin-code'), adminMsg: $('#admin-msg'),
    adminApply: $('#admin-apply'), adminRefresh: $('#admin-refresh'), adminClose: $('#admin-close'),
    adminEncrypt: $('#admin-encrypt'), adminLoad: $('#admin-load'), adminOpen: $('#admin-open'),
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


  const rows = { clicks: {}, gens: {}, ups: {}, tech: {}, rb: {}, skins: {}, bgs: {} };
  const hooks = [];
  let buyMode = '1';
  let curTab = 'game';

  // Écritures DOM seulement quand la valeur change
  function setT(node, txt) { if (node._t !== txt) { node.textContent = txt; node._t = txt; } }
  function showRow(r, on) {
    if (r.on !== on) { r.item.style.display = on ? '' : 'none'; r.on = on; }
  }

  /* ---------- Boutique ---------- */
  function buildShop() {
    UPS.forEach((d) => { rows.ups[d.id] = makeRow(el.listUps, () => buyOnce('ups', d)); });
    TECHS.forEach((d) => { rows.tech[d.id] = makeRow(el.listTech, () => buyOnce('tech', d)); });
    CLICKS.forEach((d) => { rows.clicks[d.id] = makeRow(el.listClicks, () => buy('clicks', d)); });
    GENS.forEach((d) => { rows.gens[d.id] = makeRow(el.listGens, () => buy('gens', d)); });
  }

  function makeRow(parent, onBuy, extraClass, withThumb) {
    const item = document.createElement('div');
    item.className = 'item' + (extraClass ? ' ' + extraClass : '');
    let thumb = null;
    if (withThumb) { thumb = document.createElement('div'); thumb.className = 'thumb'; item.appendChild(thumb); }
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
    return { item, name, desc, own, btn, qty, price, thumb, on: true };
  }

  function buy(kind, d) {
    const have = owned(S[kind], d.id);
    const disc = discount();
    const n = buyMode === 'max' ? maxAfford(d, have, S.money, disc) : Number(buyMode);
    if (n < 1 || have + n > MAX_OWNED) return;
    const price = priceOf(d, have, n, disc);
    if (!gte(S.money, price)) return;
    S.money = sub(S.money, price);
    S[kind][d.id] = have + n;
    render();
    save();
  }

  // Achats uniques : multiplicateurs (kind 'ups') et recherche (kind 'tech')
  function buyOnce(kind, d) {
    if (S[kind][d.id]) return;
    const price = mul(d.base, discount());
    if (!gte(S.money, price)) return;
    S.money = sub(S.money, price);
    S[kind][d.id] = 1;
    render();
    save();
  }

  function techDesc(d) {
    switch (d.type) {
      case 'click':  return 'x' + dec(d.val, 2) + ' sur les clics';
      case 'pass':   return 'x' + dec(d.val, 2) + ' sur le revenu passif';
      case 'over':   return '+' + dec(d.val, 2) + ' surclic par clic';
      case 'mini':   return 'x' + dec(d.val, 2) + ' gains des mini-jeux';
      case 'pig':    return 'x' + dec(d.val, 2) + ' revenu du cochon';
      case 'casino': return 'x' + dec(d.val, 2) + ' gains au casino';
      case 'disc':   return 'Prix des améliorations x' + dec(d.val, 2);
      case 'auto':   return '+' + dec(d.val, 2) + ' clic/s automatique';
      default:       return '';
    }
  }

  function updateOnce(defs, rowMap, map, descFn, disc) {
    let teaser = false, bought = 0;
    defs.forEach((d) => {
      const r = rowMap[d.id];
      if (map[d.id]) { bought++; showRow(r, false); return; }
      const revealed = gte(S.run, d.revealB);
      if (!revealed && teaser) { showRow(r, false); return; }
      showRow(r, true);
      r.item.classList.toggle('locked', !revealed);
      setT(r.name, revealed ? d.name : '???');
      setT(r.desc, revealed ? descFn(d) : 'Continue de gagner de l\'argent');
      setT(r.own, '');
      setT(r.qty, revealed ? 'Achat unique' : '');
      const price = mul(d.base, disc);
      setT(r.price, money(price));
      r.btn.disabled = !revealed || !gte(S.money, price);
      if (!revealed) teaser = true;
    });
    return bought;
  }

  function updateUps(disc) {
    const bought = updateOnce(UPS, rows.ups, S.ups, (d) => 'x' + dec(d.mult, 2) + ' sur tous les gains', disc);
    setT(el.upsTitle, 'Multiplicateurs ' + bought + '/' + UPS.length + ' : x' + fmt(upMult()));
    const tb = updateOnce(TECHS, rows.tech, S.tech, techDesc, disc);
    setT(el.techTitle, 'Recherche ' + tb + '/' + TECHS.length);
  }

  function updateRows(kind, defs, rowMap, text, disc) {
    const map = S[kind];
    let teaser = false;
    defs.forEach((d) => {
      const r = rowMap[d.id];
      const have = owned(map, d.id);
      const revealed = have > 0 || gte(S.run, d.revealB);
      if (!revealed) {
        if (teaser) { showRow(r, false); return; }
        teaser = true;
        showRow(r, true);
        r.item.classList.add('locked');
        setT(r.name, '???');
        setT(r.desc, 'Continue de gagner de l\'argent');
        setT(r.own, '');
        setT(r.qty, '');
        setT(r.price, money(mul(d.base, disc)));
        r.btn.disabled = true;
        return;
      }
      showRow(r, true);
      r.item.classList.remove('locked');
      setT(r.name, d.name);
      setT(r.desc, text(d));
      setT(r.own, 'Possédés : ' + have);

      let n, label;
      if (buyMode === 'max') {
        n = maxAfford(d, have, S.money, disc);
        label = n > 0 ? 'x' + n : 'Max';
        if (n < 1) n = 1;
      } else {
        n = Number(buyMode);
        label = 'x' + n;
      }
      const price = priceOf(d, have, n, disc);
      setT(r.qty, label);
      setT(r.price, money(price));
      r.btn.disabled = !gte(S.money, price);
    });
  }

  $$('#buy-mode button').forEach((b) => b.addEventListener('click', () => {
    buyMode = b.dataset.mode;
    $$('#buy-mode button').forEach((x) => x.classList.toggle('active', x === b));
    render();
  }));

  /* ---------- Rebirth : améliorations permanentes ---------- */
  const rbCost = (d) => ceil(mul(d.base, powN(d.g, rbn(d.id))));

  function rbText(d) {
    const n = rbn(d.id);
    switch (d.id) {
      case 'click':  return 'Actuel : x' + dec(clickRb(), 2) + ' (+0,2x par achat)';
      case 'pass':   return 'Actuel : x' + dec(passRb(), 2) + ' (+0,2x par achat)';
      case 'afk':    return 'Hors ligne : ' + dec(OFFLINE_BASE_RATE * afkMult() * 100, 1) + ' % du passif (+0,2x par achat)';
      case 'casino': return 'Gains : x' + dec(casinoMult(), 2) + ' (+0,05x par achat)';
      case 'disc':   return 'Prix : x' + dec(discount(), 2) + ' (-0,02x par achat, max. 37)';
      case 'time':   return 'Limite : ' + fmtDur(afkLimit()) + ' (+20 min par achat, max. 36 h)';
      case 'over':   return 'Par clic : ' + dec(overPerClick(), 2) + ' surclic (+0,1 par achat)';
      case 'glob':   return 'Tous les gains : x' + dec(globMult(), 2) + ' (+0,1x par achat)';
      case 'prest':  return 'Prestige : +' + dec((PRESTIGE_BONUS + 0.01 * n) * 100, 0) + ' % par point (+1 % par achat, max. 40)';
      case 'prgain': return 'Points de prestige : x' + dec(1 + 0.1 * n, 2) + ' (+0,1x par achat)';
      case 'rbgain': return 'Points de rebirth : x' + dec(1 + 0.1 * n, 2) + ' (+0,1x par achat)';
      case 'claim':  return 'Surclics réclamés : x' + dec(claimMult(), 2) + ' (+0,1x par achat)';
      case 'mini':   return 'Gains : x' + dec(1 + 0.1 * n, 2) + ' (+0,1x par achat)';
      case 'cdr':    return 'Délai : -' + dec(Math.min(20, n) * 3, 0) + ' % (-3 % par achat, max. 20)';
      case 'pig':    return 'Par coup réussi : ' + dec((0.12 + 0.01 * n) * 100, 0) + ' % du cochon (+1 % par achat, max. 8)';
      case 'start':  return 'Départ : ' + (n > 0 ? money(startMoney()) : 'rien') + ' après chaque reset (x5 par achat)';
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
    if (lt(S.rp, cost)) return;
    S.rp = sub(S.rp, cost);
    S.rb[d.id] = n + 1;
    render();
    save();
  }

  function updateRebirthRows() {
    RB.forEach((d) => {
      const r = rows.rb[d.id];
      const n = rbn(d.id);
      setT(r.name, d.name);
      setT(r.desc, rbText(d));
      setT(r.own, 'Niveau : ' + n + (d.max !== Infinity ? ' / ' + d.max : ''));
      if (n >= d.max) {
        setT(r.qty, '');
        setT(r.price, 'Maximum');
        r.btn.disabled = true;
      } else {
        const cost = rbCost(d);
        setT(r.qty, 'Points');
        setT(r.price, fmt(cost));
        r.btn.disabled = lt(S.rp, cost);
      }
    });
  }

  /* ---------- Cosmétiques ---------- */
  function buildCosmetics() {
    const paint = (r, d) => {
      if (d.img) r.thumb.style.backgroundImage = 'url(' + d.img + ')';
      else r.thumb.style.background = d.sw;
    };
    BUTTON_SKINS.forEach((d) => { const r = makeRow(el.skinList, () => cosmeticAction('skin', d), '', true); paint(r, d); rows.skins[d.id] = r; });
    BACKGROUNDS.forEach((d) => { const r = makeRow(el.bgList, () => cosmeticAction('bg', d), '', true); paint(r, d); rows.bgs[d.id] = r; });
  }

  function cosmeticAction(kind, d) {
    const own = kind === 'skin' ? S.skins : S.bgs;
    if (!own[d.id]) {
      if (d.rp) { if (lt(S.rp, d.rp)) return; S.rp = sub(S.rp, d.rp); }
      else if (d.money) { if (lt(S.money, d.money)) return; S.money = sub(S.money, d.money); }
      own[d.id] = 1;
    }
    S[kind] = d.id;
    render();
    save();
  }

  function updateCosmetics(defs, rowMap, own, current) {
    defs.forEach((d) => {
      const r = rowMap[d.id];
      setT(r.name, d.name);
      r.item.classList.toggle('rp', !!d.rp);
      r.item.classList.toggle('equipped', current === d.id);
      setT(r.own, '');
      if (own[d.id]) {
        setT(r.desc, current === d.id ? 'Équipé' : 'Possédé');
        setT(r.qty, '');
        setT(r.price, current === d.id ? 'Équipé' : 'Équiper');
        r.btn.disabled = current === d.id;
      } else if (d.rp) {
        setT(r.desc, 'Prix en points de rebirth');
        setT(r.qty, 'Points');
        setT(r.price, fmt(d.rp));
        r.btn.disabled = lt(S.rp, d.rp);
      } else {
        setT(r.desc, 'Prix en argent');
        setT(r.qty, 'Acheter');
        setT(r.price, money(d.money));
        r.btn.disabled = lt(S.money, d.money);
      }
    });
  }

  /* ---------- Rendu ---------- */
  function render() {
    const disc = discount(), cf = clickFactor(), pf = passFactor();
    const pc = perClick(cf), ps = perSecond(pf, cf);
    const t = money(S.money);
    setT(el.money, t);
    el.money.style.fontSize = t.length > 24 ? '17px' : t.length > 19 ? '20px' : t.length > 14 ? '23px' : '';
    setT(el.cps, money(ps) + '/s');
    setT(el.cpc, money(pc) + '/clic');
    setT(el.stClicks, fmt(S.clicksMade));
    setT(el.stTotal, money(S.total));
    setT(el.stMult, 'x' + fmt(mult()));
    el.siteBadge.hidden = !siteActive;

    if (curTab === 'shop') {
      updateUps(disc);
      updateRows('clicks', CLICKS, rows.clicks, (d) => '+' + fmt(mul(d.add, cf)) + ' $ par clic', disc);
      updateRows('gens', GENS, rows.gens, (d) => '+' + fmt(mul(d.cps, pf)) + ' $ par seconde', disc);
    }

    const gain = prestigeGain();
    setT(el.prPoints, fmt(S.prestige));
    setT(el.prGain, '+' + fmt(gain));
    setT(el.prResets, fmt(S.resets));
    el.prestige.disabled = lt(gain, ONE);
    setT(el.prHint, lt(gain, ONE)
      ? 'Il faut gagner ' + money(PRESTIGE_DIVISOR) + ' dans cette partie pour obtenir un premier point.'
      : 'Partie en cours : ' + money(S.run) + ' gagnés.');

    const rgain = rebirthGain();
    setT(el.rbPoints, fmt(S.rp));
    setT(el.rbGain, '+' + fmt(rgain));
    setT(el.rbCount, fmt(S.rebirths));
    el.rebirth.disabled = lt(rgain, ONE);
    setT(el.rbHint, lt(rgain, ONE)
      ? 'Il faut gagner ' + money(REBIRTH_DIVISOR) + ' depuis le dernier rebirth pour obtenir 1 point. Actuel : ' + money(S.rrun) + '.'
      : 'Depuis le dernier rebirth : ' + money(S.rrun) + ' gagnés.');
    if (curTab === 'rebirth') updateRebirthRows();

    if (curTab === 'style') {
      updateCosmetics(BUTTON_SKINS, rows.skins, S.skins, S.skin);
      updateCosmetics(BACKGROUNDS, rows.bgs, S.bgs, S.bg);
    }
    document.body.dataset.skin = S.skin;
    document.body.dataset.bg = S.bg;

    setT(el.overPer, '+' + dec(overPerClick(), 2) + '/clic');
    setT(el.overCount, fmtOver(S.over));
    setT(el.overVal, '= ' + money(mul(mul(S.over, pc), claimMult())));
    el.claim.disabled = !(S.over > 0);

    const canPlay = !busy && gte(S.money, ONE);
    el.spin.disabled = !canPlay;
    el.flipBtns.forEach((b) => { b.disabled = !canPlay; });
    el.rouBtns.forEach((b) => { b.disabled = !canPlay; });
    el.diceBtns.forEach((b) => { b.disabled = !canPlay; });
    setT(el.betShow, 'Mise : ' + money(effBet()));

    const pigTab = $('.tab[data-tab="piggy"]');
    if (pigTab) pigTab.classList.toggle('has', gte(S.pig, ONE));
    hooks.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
  }

  /* ---------- Clic et surclics ---------- */
  el.earn.addEventListener('click', (e) => {
    const gain = perClick();
    earn(gain);
    S.over += overPerClick();
    S.clicksMade++;
    floatText('+' + fmt(gain), e);
    render();
  });

  el.claim.addEventListener('click', () => {
    if (!(S.over > 0)) return;
    const gain = mul(mul(S.over, perClick()), claimMult());
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
  let bet = from(10);
  const effBet = () => bmin(bet, floor(S.money));

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
    if (lt(b, ONE)) { setResult('lose', 'Solde insuffisant.'); return null; }
    S.money = sub(S.money, b);
    return b;
  }

  // Les gains reçoivent le bonus de rebirth du casino puis le bonus de site, en dernier.
  function settle(b, m, label) {
    const win = m > 0 ? floor(mul(mul(b, m * casinoMult() * siteMult()), 1 + 1e-9)) : ZERO;
    S.money = add(S.money, win);
    if (gt(win, b)) setResult('win', label + ' : +' + money(sub(win, b)));
    else if (!isZero(win)) setResult('lose', label + ' : ' + money(win) + ' récupérés sur ' + money(b));
    else setResult('lose', label + ' : -' + money(b));
    busy = false;
    render();
    save();
  }

  $$('#quick button').forEach((b) => b.addEventListener('click', () => {
    bet = b.dataset.bet === 'min' ? ONE : bmax(ONE, floor(mul(S.money, Number(b.dataset.bet))));
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

  // Dés : deux dés, pari sur moins de 7 (x2,2), exactement 7 (x5,5) ou plus de 7 (x2,2)
  el.diceBtns.forEach((btn) => btn.addEventListener('click', () => {
    if (busy) return;
    const b = takeBet();
    if (!b) return;
    busy = true;
    setResult('', 'Les dés roulent...');
    render();
    const d1 = 1 + Math.floor(Math.random() * 6), d2 = 1 + Math.floor(Math.random() * 6);
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
      el.diceFace.textContent = ticks >= 9 ? String(d1 + d2) : String(2 + Math.floor(Math.random() * 11));
      if (ticks >= 9) {
        clearInterval(timer);
        const total = d1 + d2, choice = btn.dataset.dice;
        const m = (choice === 'under' && total < 7) || (choice === 'over' && total > 7) ? 2.2 : (choice === 'seven' && total === 7 ? 5.5 : 0);
        settle(b, m, 'Dés ' + d1 + ' + ' + d2 + ' = ' + total);
      }
    }, 70);
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
    rp: S.rp, rebirths: S.rebirths, rb: S.rb, pig: S.pig,
    skins: S.skins, bgs: S.bgs, skin: S.skin, bg: S.bg
  });

  twoStep(el.prestige, 'Confirmer le prestige', () => {
    const gain = prestigeGain();
    if (lt(gain, ONE)) return;
    const keep = Object.assign(keepAlways(), {
      prestige: add(S.prestige, gain), resets: S.resets + 1, rrun: S.rrun, over: S.over, tech: S.tech, money: startMoney()
    });
    S = Object.assign(fresh(), keep);
    flash('Prestige effectué : +' + fmt(gain) + ' point(s).');
    render();
    save();
  });

  twoStep(el.rebirth, 'Confirmer le rebirth', () => {
    const gain = rebirthGain();
    if (lt(gain, ONE)) return;
    const keep = keepAlways();
    keep.rp = add(S.rp, gain);
    keep.rebirths = S.rebirths + 1;
    keep.money = startMoney();
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
    return encode({ g: 'romanomoney', ver: VERSION, dev: meta.id, t: Date.now(), s: pack(S) });
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
    showAfk(accrueOffline());
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

  function showTab(name) {
    curTab = name;
    $$('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + name));
    document.body.classList.toggle('wide', name === 'shop');
    render();
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

  /* ---------- API pour les mini-jeux (les montants sont des grands nombres) ---------- */
  window.Game = {
    B,
    unit: () => mul(bmax(mul(perClick(), 25), mul(perSecond(), 45)), miniMult()),
    earn: (x) => { earn(from(x)); render(); save(); },
    fmt, money, flash,
    cdLeft: (id) => Math.max(0, ((S.cd || {})[id] || 0) - Date.now()),
    cdStart: (id, sec) => { S.cd = S.cd || {}; S.cd[id] = Date.now() + sec * 1000 * cdrMult(); save(); },
    hook: (fn) => { hooks.push(fn); },
    pigInfo: () => ({ amount: S.pig, cap: pigCap(), rate: pigRate(), hit: 0.12 + 0.01 * Math.min(8, rbn('pig')), limitMs: afkLimit() }),
    pigTake: (x) => {
      x = bmin(from(x), S.pig);
      S.pig = sub(S.pig, x);
      earn(x);
      render();
      save();
      return x;
    }
  };

  /* ---------- Cochon : accumulation hors ligne et fenêtre de retour ---------- */
  // Le revenu hors ligne s'accumule dans le cochon jusqu'à sa capacité (limite d'argent).
  // Le joueur peut revenir avant la limite et récupérer ce qui est déjà accumulé.
  function accrueOffline() {
    const now = Date.now();
    const raw = Math.max(0, now - (S.lastSeen || now));
    const rate = pigRate(), cap = pigCap();
    const before = S.pig;
    const after = bmax(before, bmin(cap, add(before, mul(rate, raw / 1000))));
    S.pig = after;
    return { raw, gained: sub(after, before), full: !isZero(cap) && gte(after, cap), cap };
  }

  function showAfk(info) {
    if (lt(info.gained, ONE) || info.raw < 30000) return;
    el.afkAway.textContent = 'Absence : ' + fmtDur(info.raw);
    el.afkGain.textContent = '+' + money(info.gained);
    el.afkTotal.textContent = 'Dans le cochon : ' + money(S.pig) + ' / ' + money(info.cap) + (info.full ? ' (plein)' : '');
    el.afkModal.hidden = false;
    flash('Cochon : +' + money(info.gained) + ' pendant ton absence.');
  }
  el.afkClose.addEventListener('click', () => { el.afkModal.hidden = true; });
  el.afkGo.addEventListener('click', () => { el.afkModal.hidden = true; showTab('piggy'); });

  /* ---------- Panneau admin : combo de flèches puis édition du code décrypté ---------- */
  const ADMIN_COMBO = ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowUp'];
  let keyBuf = [];

  function adminSay(cls, txt) { el.adminMsg.className = 'datamsg ' + cls; el.adminMsg.textContent = txt; }
  const adminSnapshot = () => JSON.stringify({ g: 'romanomoney', ver: VERSION, t: Date.now(), s: pack(S) }, null, 2);

  function openAdmin() {
    el.adminText.value = adminSnapshot();
    el.adminCode.value = '';
    adminSay('', 'Modifie le JSON puis clique sur Appliquer : le jeu change en direct.');
    el.adminModal.hidden = false;
  }

  function unlockAdmin() {
    if (!meta.admin) { meta.admin = true; store.set(META_KEY, meta); }
    el.adminOpen.hidden = false;
    openAdmin();
  }

  function applyAdmin() {
    let obj;
    try { obj = JSON.parse(el.adminText.value); } catch (e) { return adminSay('bad', 'JSON invalide : ' + e.message); }
    const src = obj && typeof obj === 'object' && obj.s && typeof obj.s === 'object' ? obj.s : obj;
    if (!src || typeof src !== 'object' || Array.isArray(src)) return adminSay('bad', 'Format non reconnu.');
    const ns = Object.assign(fresh(), src);
    for (let i = 0; i < BIG_FIELDS.length; i++) {
      const k = BIG_FIELDS[i];
      if (src[k] !== undefined && !valid(src[k])) return adminSay('bad', 'Nombre invalide pour "' + k + '" (exemples : 1500, "2,5e400").');
      ns[k] = from(src[k] === undefined ? 0 : src[k]);
    }
    ['clicks', 'gens', 'ups', 'tech', 'rb', 'cd', 'skins', 'bgs'].forEach((k) => {
      if (!ns[k] || typeof ns[k] !== 'object' || Array.isArray(ns[k])) ns[k] = {};
    });
    for (const k of ['clicks', 'gens', 'rb']) {
      Object.keys(ns[k]).forEach((id) => {
        const n = Math.floor(Number(ns[k][id]));
        if (isFinite(n) && n > 0) ns[k][id] = Math.min(n, 1e9); else delete ns[k][id];
      });
    }
    ['resets', 'rebirths', 'over', 'clicksMade'].forEach((k) => {
      const n = Number(ns[k]);
      ns[k] = isFinite(n) && n >= 0 ? n : 0;
    });
    const ls = Number(ns.lastSeen);
    ns.lastSeen = isFinite(ls) && ls > 0 ? ls : Date.now();
    ns.skins.classic = 1; ns.bgs.dark = 1;
    if (!ns.skins[ns.skin]) ns.skin = 'classic';
    if (!ns.bgs[ns.bg]) ns.bg = 'dark';
    ns.v = DATA_VERSION;
    S = ns;
    render();
    save();
    el.adminText.value = adminSnapshot();
    adminSay('good', 'Appliqué en direct.');
  }

  el.adminApply.addEventListener('click', applyAdmin);
  el.adminRefresh.addEventListener('click', () => { el.adminText.value = adminSnapshot(); adminSay('good', 'Valeurs actuelles chargées.'); });
  el.adminClose.addEventListener('click', () => { el.adminModal.hidden = true; });
  el.adminOpen.addEventListener('click', openAdmin);
  el.adminEncrypt.addEventListener('click', () => {
    try { el.adminCode.value = encode(JSON.parse(el.adminText.value)); adminSay('good', 'Code chiffré généré.'); }
    catch (e) { adminSay('bad', 'JSON invalide : ' + e.message); }
  });
  el.adminLoad.addEventListener('click', () => {
    try { el.adminText.value = JSON.stringify(decode(el.adminCode.value), null, 2); adminSay('good', 'Code décrypté. Clique sur Appliquer pour l\'utiliser.'); }
    catch (e) { adminSay('bad', e.message === 'altered' ? 'Code modifié ou corrompu.' : 'Code non reconnu.'); }
  });

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.key === 'Escape') { el.adminModal.hidden = true; return; }
    keyBuf.push(e.key);
    if (keyBuf.length > ADMIN_COMBO.length) keyBuf.shift();
    if (keyBuf.join() === ADMIN_COMBO.join()) { keyBuf = []; unlockAdmin(); }
  });

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


  function start() {
    buildShop();
    buildRebirth();
    buildCosmetics();
    renderInfos();
    el.adminOpen.hidden = !meta.admin;
    const info = accrueOffline();
    render();
    showAfk(info);
    setInterval(() => {
      const cps = perSecond();
      if (!isZero(cps)) { earn(mul(cps, 0.1)); render(); }
    }, 100);
    setInterval(save, 2000);
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', save);
  }

  Promise.all([store.get(SAVE_KEY), store.get(META_KEY), detectSite()]).then((r) => {
    const saved = r[0];
    meta = (r[1] && r[1].id) ? r[1] : { id: randomId() };
    meta.admin = !!meta.admin;
    if (!r[1] || !r[1].id) store.set(META_KEY, meta);
    siteActive = r[2];
    if (saved && typeof saved === 'object') S = unpack(Object.assign(fresh(), migrate(saved)));
    start();
  });
})();
