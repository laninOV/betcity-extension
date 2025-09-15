// ===== Bradley-Terry Model for Bo5 Tennis Matches =====
// Реализация алгоритма Брэдли-Терри для теннисных матчей до 3 побед

// ===== Утилиты =====
const clamp01 = x => Math.min(1 - 1e-12, Math.max(1e-12, x));
const logit = p => Math.log(p / (1 - p));
const invLogit = z => 1 / (1 + Math.exp(-z));

// Weighted standard deviation for betting strategy
const wstd = (xs) => {
  const m = xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);
  const v = xs.reduce((s,x)=>s+(x-m)**2,0)/Math.max(1,xs.length);
  return Math.sqrt(v);
};

function timeWeight(deltaDays, halfLife = 21) { 
  return halfLife > 0 ? Math.exp(-deltaDays / halfLife) : 1; 
}

function marginBump(diff, beta = 0.15) { 
  const m = Math.max(0, Math.min(0.5, (diff - 2) / 9)); 
  return 1 + beta * m; 
}

// ===== Построить локальный граф сетов =====
function buildGraph(matches, {halfLife = 21, betaMargin = 0.15, lambdaMatch = 0.7, alphaPrior = 2.0} = {}) {
  const players = new Set(); 
  matches.forEach(m => {
    players.add(m.home); 
    players.add(m.away);
  });
  
  const ghost = "__BT_GHOST__";
  const now = matches.reduce((d, m) => !d || m.date > d ? m.date : d, null);
  const W = new Map(), N = new Map();
  const K = (i, j) => i + "__" + j;
  const add = (M, i, j, v) => M.set(K(i, j), (M.get(K(i, j)) || 0) + v);

  for (const m of matches) {
    const Δ = now && m.date ? Math.max(0, (now - m.date) / (1000 * 3600 * 24)) : 0;
    const wt = timeWeight(Δ, halfLife);
    let homeSetsWon = 0;
    
    for (const [h, a] of m.sets) {
      if (h === a) continue;
      const w = wt * marginBump(Math.abs(h - a), betaMargin);
      if (h > a) add(W, m.home, m.away, w); 
      else add(W, m.away, m.home, w);
      add(N, m.home, m.away, w); 
      add(N, m.away, m.home, w);
      if (h > a) homeSetsWon++;
    }
    
    const awaySetsWon = m.sets.length - homeSetsWon;
    if (homeSetsWon !== awaySetsWon) {
      const winner = homeSetsWon > awaySetsWon ? m.home : m.away;
      const loser = winner === m.home ? m.away : m.home;
      add(W, winner, loser, lambdaMatch * wt);
      add(N, winner, loser, lambdaMatch * wt);
      add(N, loser, winner, lambdaMatch * wt);
    }
  }
  
  // Регуляризация призрачным игроком
  for (const p of players) {
    add(W, p, ghost, alphaPrior);
    add(W, ghost, p, alphaPrior);
    add(N, p, ghost, 2 * alphaPrior);
    add(N, ghost, p, 2 * alphaPrior);
  }
  players.add(ghost);
  
  return {players: [...players], W, N, ghost};
}

// ===== MM-итерации BT =====
function btRatings(graph, {maxIter = 1000, tol = 1e-8} = {}) {
  const {players, W, N} = graph;
  const r = Object.fromEntries(players.map(p => [p, 1]));
  const get = (M, i, j) => M.get(i + "__" + j) || 0;

  for (let it = 0; it < maxIter; it++) {
    const wsum = Object.fromEntries(players.map(p => [p, 0]));
    const nden = Object.fromEntries(players.map(p => [p, 0]));
    
    for (const i of players) {
      for (const j of players) {
        if (i === j) continue;
        const nij = get(N, i, j); 
        if (nij <= 0) continue;
        wsum[i] += nij;
        nden[i] += nij / (r[i] + r[j]);
      }
    }
    
    for (const i of players) {
      for (const j of players) {
        if (i === j) continue;
        const wij = get(W, i, j); 
        if (wij > 0) wsum[i] += wij;
      }
    }
    
    let maxRel = 0;
    for (const p of players) {
      if (nden[p] > 0) {
        const newr = Math.max(1e-12, wsum[p] / nden[p]);
        maxRel = Math.max(maxRel, Math.abs(newr - r[p]) / Math.max(r[p], 1e-12));
        r[p] = newr;
      }
    }
    if (maxRel < tol) break;
  }
  return r;
}

// ===== Bo5: распределение и вероятность матча =====
function bo5ScoreDist(p) {
  p = clamp01(p); 
  const q = 1 - p;
  return {
    "3:0": p**3,
    "3:1": 3 * (p**3) * q,
    "3:2": 6 * (p**3) * (q**2),
    "0:3": q**3,
    "1:3": 3 * (q**3) * p,
    "2:3": 6 * (q**3) * (p**2)
  };
}

const bo5MatchWin = (p) => { 
  const d = bo5ScoreDist(p); 
  return d["3:0"] + d["3:1"] + d["3:2"]; 
};

const calibrate = (p, t = 1.2) => t <= 1 ? p : invLogit(logit(clamp01(p)) / t);

// ===== Основной расчёт для пары A–B =====
function btWinner(last5A, last5B, h2h, nameA, nameB, hyper = {}) {
  const H = Object.assign({
    halfLife: 21, 
    betaMargin: 0.15, 
    lambdaMatch: 0.7, 
    alphaPrior: 2.0, 
    temperature: 1.2
  }, hyper);
  
  // Один общий граф по 5+5+H2H
  const graph = buildGraph([...last5A, ...last5B, ...(h2h || [])], H);
  const r = btRatings(graph);
  const rA = r[nameA] || 1, rB = r[nameB] || 1;

  const p_set_raw = rA / (rA + rB);
  const p_set = calibrate(p_set_raw, H.temperature);
  const p_match = bo5MatchWin(p_set);
  const dist = bo5ScoreDist(p_set);

  const scores = Object.entries(dist)
    .map(([score, prob]) => ({
      score, 
      probability: prob, 
      pct: (prob * 100).toFixed(1) + "%"
    }))
    .sort((a, b) => b.probability - a.probability);

  return {
    favorite: p_match >= 0.5 ? nameA : nameB,
    ratings: { [nameA]: rA, [nameB]: rB },
    p_set_raw, 
    p_set, 
    p_match,
    scores
  };
}

// ===== Конвертация данных из существующего формата =====
function convertGamesToBTFormat(games, playerName, opponentName = "Opponent") {
  return games.map(game => {
    // Преобразуем существующий формат игр в формат BT
    const sets = game.pts || [];
    return {
      date: game.date || new Date(),
      home: playerName,
      away: opponentName,
      sets: sets
    };
  });
}

// ===== Конвертация H2H данных =====
function convertH2HToBTFormat(h2hGames, playerA, playerB) {
  return h2hGames.map(game => ({
    date: game.date || new Date(),
    home: playerA,
    away: playerB,
    sets: game.pts || []
  }));
}

// ===== BETTING STRATEGY FUNCTIONS =====

// Calculate H2H set share with Laplace smoothing
function h2hSetShare(h2h, nameA, nameB){
  let SA=0, SB=0;
  for (const m of (h2h||[])) {
    const aHome = m.home===nameA && m.away===nameB;
    const bHome = m.home===nameB && m.away===nameA;
    if (!aHome && !bHome) continue;
    for (const [h,a] of m.sets) {
      if (aHome) { SA += (h>a)?1:0; SB += (a>h)?1:0; }
      else       { SA += (a>h)?1:0; SB += (h>a)?1:0; }
    }
  }
  const total = SA+SB;
  const p = (SA+1) / (total + 2); // Laplace smoothing
  return {p, total};
}

// Analyze player metrics from last 5 matches
function playerSetStats(last5, name){
  const diffs = [];  // point differences across all sets
  let deciders = 0;  // matches that went 3:2/2:3
  let bigWin=false, bigLoss=false;
  
  for (const m of last5){
    const meHome = m.home===name;
    let setsWon = 0, setsLost = 0;
    let winBig=false, loseBig=false;
    
    for (const [h,a] of m.sets){
      const my = meHome ? h : a;
      const op = meHome ? a : h;
      diffs.push(my - op);
      if (my>op) setsWon++; else setsLost++;
      const d = my - op;
      if (d>=6) winBig=true;
      if (d<=-6) loseBig=true;
    }
    
    if ((setsWon===3 && setsLost===2) || (setsLost===3 && setsWon===2)) deciders++;
    if (winBig) bigWin=true;
    if (loseBig) bigLoss=true;
  }
  
  return {
    totalSets: diffs.length,
    sigma: diffs.length ? wstd(diffs) : 0,
    deciders,
    swings: (bigWin && bigLoss)
  };
}

// Main betting decision function with very permissive filters
function shouldBetBT({p_set_raw, p_set, p_match}, last5A, last5B, h2h, nameA, nameB, opts={}){
  const O = Object.assign({
    // very relaxed thresholds
    MIN_TOTAL_SETS: 4,    // reduced from 8
    MAX_SIGMA: 8.0,       // increased from 5.0
    // very low strength thresholds
    PMATCH_STRONG: 0.62,  // reduced from 0.68
    PMATCH_BASE: 0.56,    // reduced from 0.58
    PMATCH_MIN: 0.51      // reduced from 0.52
  }, opts);

  // Player form analysis from last 5 matches
  const statsA = playerSetStats(last5A, nameA);
  const statsB = playerSetStats(last5B, nameB);

  // === BASIC DATA CHECK (very minimal) ===
  const totalSets = statsA.totalSets + statsB.totalSets;
  const hasMinimumData = totalSets >= O.MIN_TOTAL_SETS;
  
  // If we don't have basic data, create a simple recommendation based on probability alone
  if (!hasMinimumData) {
    // Still make recommendations if probability is reasonable
    if (p_match >= 0.55) {
      return {
        bet: true,
        tier: "C",
        details: {p_match, totalSets, note: "limited-data"}
      };
    }
    return {
      bet: false, 
      reason: "insufficient-data", 
      details: {
        totalSets, 
        required: O.MIN_TOTAL_SETS,
        p_match
      }
    };
  }

  // === SIGNAL STRENGTH (very permissive) ===
  if (p_match >= O.PMATCH_STRONG) {
    return {
      bet: true, 
      tier: "A", 
      details: {p_match, totalSets, sigmaA: statsA.sigma, sigmaB: statsB.sigma}
    };
  }
  
  if (p_match >= O.PMATCH_BASE) {
    return {
      bet: true, 
      tier: "B", 
      details: {p_match, totalSets, sigmaA: statsA.sigma, sigmaB: statsB.sigma}
    };
  }
  
  // Very permissive tier C - accept almost any edge
  if (p_match >= O.PMATCH_MIN) {
    return {
      bet: true, 
      tier: "C", 
      details: {p_match, totalSets, sigmaA: statsA.sigma, sigmaB: statsB.sigma}
    };
  }
  
  return {
    bet: false, 
    reason: "weak-signal", 
    details: {p_match, threshold: O.PMATCH_MIN}
  };
}

// Main betting strategy function that integrates with existing BT
function btBettingStrategy(last5A, last5B, h2h, nameA, nameB, hyper = {}) {
  // Use existing BT calculation
  const btResult = btWinner(last5A, last5B, h2h, nameA, nameB, hyper);
  
  // Apply betting filters
  const bettingDecision = shouldBetBT(
    {
      p_set_raw: btResult.p_set_raw,
      p_set: btResult.p_set,
      p_match: btResult.p_match
    },
    last5A, last5B, h2h, nameA, nameB
  );
  
  return {
    ...btResult,
    betting: bettingDecision,
    recommendation: bettingDecision.bet ? 
      `${bettingDecision.tier === 'A' ? '🟢 СИЛЬНАЯ' : bettingDecision.tier === 'B' ? '🟡 УМЕРЕННАЯ' : '🔵 СЛАБАЯ'} СТАВКА на ${btResult.favorite} (${(btResult.p_match * 100).toFixed(1)}%)` :
      `❌ ПРОПУСК: ${bettingDecision.reason.toUpperCase()}`
  };
}

// ===== Экспорт функций =====
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    btWinner,
    convertGamesToBTFormat,
    convertH2HToBTFormat,
    bo5ScoreDist,
    bo5MatchWin,
    calibrate,
    h2hSetShare,
    playerSetStats,
    shouldBetBT,
    btBettingStrategy
  };
} else if (typeof window !== 'undefined') {
  window.BradleyTerry = {
    btWinner,
    convertGamesToBTFormat,
    convertH2HToBTFormat,
    bo5ScoreDist,
    bo5MatchWin,
    calibrate,
    h2hSetShare,
    playerSetStats,
    shouldBetBT,
    btBettingStrategy
  };
}
