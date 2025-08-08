(() => {
  const cfg = {
    a1: 1,
    a2: 0.5,
    a3: 0.3,
    a4: 0.2,
    tau: 0.03,
    fMax: 5,
    k: 7,
    h2hK: 0.15,
    stabilityWeight: 0.6
  };

  const now = new Date();

  // --- Анализ личных встреч (H2H) ---
  function parseH2H(playerA, playerB) {
    const tbl = [...document.querySelectorAll("table")].find(t =>
      t.querySelector("tr:first-child td")?.textContent.includes("Очные встречи")
    );
    if (!tbl)
      return { wA: 0, wB: 0, total: 0, dryWinsA: 0, dryWinsB: 0, h2hGames: [] };

    let wA = 0, wB = 0, dryA = 0, dryB = 0;
    const h2hGames = [];

    Array.from(tbl.querySelectorAll("tr")).slice(2).forEach(r => {
      const playersTxt = r.querySelector("td.descr")?.textContent.trim();
      const score = r.querySelector("td.score")?.textContent.trim();
      const dateTxt = r.querySelector("td.date")?.textContent.trim();
      if (!playersTxt || !score || !dateTxt) return;

      const m = score.match(/^(\d+):(\d+)/);
      if (!m) return;

      const [day, month, year2] = dateTxt.split(".").map(Number);
      const dt = new Date(2000 + year2, month - 1, day);

      const home = playersTxt.startsWith(playerA);
      const [s1, s2] = [+m[1], +m[2]];
      const aWon = (home && s1 > s2) || (!home && s2 > s1);

      if (aWon) {
        wA++;
        if ((home && s2 === 0) || (!home && s1 === 0)) dryA++;
      } else {
        wB++;
        if ((home && s1 === 0) || (!home && s2 === 0)) dryB++;
      }

      h2hGames.push({ win: aWon ? 1 : 0, date: dt });
    });

    return { wA, wB, total: wA + wB, h2hGames, dryWinsA: dryA, dryWinsB: dryB };
  }

  // --- Коэффициент очкового преимущества по личным встречам ---
  function calcRh2h(player, opponent) {
    const tbl = [...document.querySelectorAll("table")].find(t =>
      t.querySelector("tr:first-child td")?.textContent.includes("Очные встречи")
    );
    if (!tbl) return 0.5;
    const tau = 0.1;
    let pSum = 0, oSum = 0;
    Array.from(tbl.querySelectorAll("tr")).slice(2).forEach(row => {
      const playersTxt = row.querySelector("td.descr")?.textContent.trim();
      const scoreTxt = row.querySelector("td.score")?.textContent.trim();
      const dateTxt = row.querySelector("td.date")?.textContent.trim();
      if (!playersTxt || !scoreTxt || !dateTxt) return;
      const pointsMatch = scoreTxt.match(/\(([^)]+)\)/);
      if (!pointsMatch) return;
      const [day, month, year] = dateTxt.split(".").map(Number);
      const dt = new Date(2000 + year, month - 1, day);
      const daysAgo = Math.max(0, (now - dt) / 86400000);
      const weight = Math.exp(-tau * daysAgo);
      const pointPairs = pointsMatch[1].split(",").map(s => s.trim().split(":").map(Number));
      const isPlayerHome = playersTxt.startsWith(player);
      const playerPts = pointPairs.reduce((s, [p1, p2]) => s + (isPlayerHome ? p1 : p2), 0);
      const oppPts = pointPairs.reduce((s, [p1, p2]) => s + (isPlayerHome ? p2 : p1), 0);
      pSum += playerPts * weight;
      oSum += oppPts * weight;
    });
    if (pSum + oSum === 0) return 0.5;
    return pSum / (pSum + oSum);
  }

  // --- Коэффициенты упорства ---
  function calculatePersistenceCoefficient(matchScores) {
    if (!matchScores || !matchScores.length) return 0;
    let matchRatios = [], matchWins = [];
    for (const match of matchScores) {
      const sets = match.match(/(\d+):(\d+)/g)?.map(s => s.split(':').map(Number)) || [];
      if (!sets.length) continue;
      let ratios = [], wonSet = false;
      for (const [p1, p2] of sets) {
        const total = p1 + p2;
        if (total === 0) continue;
        ratios.push(p1 / total);
        if (p1 > p2) wonSet = true;
      }
      if (!ratios.length) continue;
      matchRatios.push(ratios.reduce((a, b) => a + b, 0) / ratios.length);
      matchWins.push(wonSet);
    }
    if (!matchRatios.length) return 0;
    const avgRatio = matchRatios.reduce((a, b) => a + b, 0) / matchRatios.length;
    const winRate = matchWins.filter(v => v).length / matchWins.length;
    return +(avgRatio * winRate).toFixed(4);
  }

  function calculatePersistenceMod(matchScoresList, bigLossThreshold = 0.4) {
    if (!Array.isArray(matchScoresList) || !matchScoresList.length) return 0;
    function parseSetScores(scoreStr) {
      const matches = scoreStr.match(/(\d+):(\d+)/g);
      if (!matches) return [];
      return matches.map(pair => pair.split(':').map(Number));
    }
    const allMatchCoefficients = [];
    for (const scoreStr of matchScoresList) {
      const sets = parseSetScores(scoreStr);
      const n = sets.length;
      if (!n) continue;
      let pointsRatios = [], setsWon = 0, bigLosses = 0;
      for (const [playerPoints, oppPoints] of sets) {
        const totalPoints = playerPoints + oppPoints;
        let ratio = totalPoints ? playerPoints / totalPoints : 0;
        pointsRatios.push(ratio);
        if (playerPoints > oppPoints) setsWon++;
        if (ratio < bigLossThreshold) bigLosses++;
      }
      const avgPointsRatio = pointsRatios.reduce((a, b) => a + b, 0) / n;
      const w = setsWon / n;
      const s = bigLosses / n;
      const l = n >= 4 ? 1.0 : 0.7;
      const matchCoef = avgPointsRatio * w * (1 - s) * l;
      allMatchCoefficients.push(matchCoef);
    }
    if (!allMatchCoefficients.length) return 0;
    return +(allMatchCoefficients.reduce((a, b) => a + b, 0) / allMatchCoefficients.length).toFixed(4);
  }

  function combinedIndex(persistenceMod, dominance = 0, alpha = 0.5) {
    return +(persistenceMod * (1 - alpha * dominance)).toFixed(4);
  }

  // --- Подсчёты выигрышей сетов ---
  function calcSetWins(games) {
    const res = Array.from({ length: 5 }, () => ({ win: 0, lose: 0, total: 0 }));
    games.forEach(game => {
      if (!game || !Array.isArray(game.pts)) return;
      game.pts.forEach(([a, b], idx) => {
        if (a > b) res[idx].win++;
        else if (a < b) res[idx].lose++;
        res[idx].total++;
      });
    });
    return Object.fromEntries(res.map((r, i) => [`set${i + 1}`, [`${r.win}/${r.total}`, `${r.lose}/${r.total}`]]));
  }

  function parseGame(row, header) {
    const dateText = row.querySelector("td.date")?.textContent.trim();
    if (!dateText) return null;
    const [d, m, y] = dateText.split(".").map(Number);
    const dt = new Date(2000 + y, m - 1, d);
    const info = row.nextElementSibling;
    if (!info) return null;
    const playersText = info.querySelector("td.ev-mstat-ev")?.textContent.trim();
    const scoreText = info.querySelector("td.score")?.textContent.trim();
    if (!playersText || !scoreText) return null;
    const match = scoreText.match(/^(\d+):(\d+)\s*\(([^)]+)\)/);
    if (!match) return null;
    const [, s1, s2, pts] = match;

    let pairs = pts.split(",").map(p => p.trim().split(":").map(Number));
    const isHome = playersText.indexOf(header) < playersText.indexOf(" - ");
    if (!isHome) pairs = pairs.map(([a, b]) => [b, a]);

    const playerSets = isHome ? +s1 : +s2;
    const oppSets = isHome ? +s2 : +s1;
    const playerPoints = pairs.reduce((a, [x]) => a + x, 0);
    const oppPoints = pairs.reduce((a, [, y]) => a + y, 0);
    const handicap = playerPoints - oppPoints;
    const win = playerSets > oppSets ? 1 : 0;
    const isDryWin = win === 1 && oppSets === 0;
    const isDryLoss = win === 0 && playerSets === 0;
    const w = Math.exp(-cfg.tau * ((now - dt) / 86400000));
    const sr = (playerSets + oppSets) ? (playerSets - oppSets) / (playerSets + oppSets) : 0;
    const pr = (playerPoints + oppPoints) ? Math.tanh((playerPoints - oppPoints) / (playerPoints + oppPoints)) : 0;
    const avgH = (playerSets + oppSets) ? handicap / (playerSets + oppSets) : 0;
    const hn = Math.max(-1, Math.min(1, avgH / cfg.fMax));
    const qualityBonus = win ? (playerSets === 3 && oppSets === 0 ? 0.2 :
                                playerSets === 3 && oppSets === 1 ? 0.1 : 0) : 0;
    const Mi = cfg.a1 * win + cfg.a2 * sr + cfg.a3 * pr + cfg.a4 * hn + qualityBonus;

    return {
      win, playerSets, oppSets, pts: pairs, handicap, w, Mi,
      isDryWin, isDryLoss, date: dt,
      playerPoints, oppPoints, rawScore: scoreText
    };
  }

  function parseSection(table) {
    const title = table.querySelector("tr:first-child td")?.textContent || "";
    const header = title.replace(/^Последние игры\s*/i, "").replace(/:$/, "").trim();
    const rows = Array.from(table.querySelectorAll("tr")).slice(2);
    const games = [];
    for (let i = 0; i + 1 < rows.length; i += 2) {
      const g = parseGame(rows[i], header);
      if (g) games.push(g);
    }
    return { player: header, games };
  }

  function calcBaseS(games, limit = null) {
    const arr = limit ? games.slice(0, limit) : games;
    let num = 0, den = 0;
    arr.forEach(g => {
      const stabilityFactor = 1 / (1 + ((now - g.date) / 86400000) / 30);
      num += g.w * g.Mi * stabilityFactor;
      den += g.w * stabilityFactor;
    });
    return den ? num / den : 0;
  }

  function calcForaBalance(games) {
    const wins = games.filter(g => g.win);
    const losses = games.filter(g => !g.win);
    const fW = wins.length ? wins.reduce((s, g) => s + g.handicap, 0) / wins.length : 0;
    const fL = losses.length ? losses.reduce((s, g) => s + Math.abs(g.handicap), 0) / losses.length : 0;
    return Math.tanh((fW - fL) / cfg.fMax);
  }

  function strengthAdj(games) {
    const s = calcBaseS(games);
    const foraB = calcForaBalance(games);
    return s + 0.25 * foraB;
  }

  function calcDryGames(games) {
    return {
      wins: games.filter(g => g.isDryWin).length,
      losses: games.filter(g => g.isDryLoss).length
    };
  }

  function createMatchVisualization(games) {
    return games.slice(0, 10).map(g => (g.win ? "🟢" : "🔴")).join(" ");
  }

  function getSetWeights(games) {
    const setResults = [];
    games.forEach(g => {
      (g.pts || []).forEach(([a, b]) => {
        setResults.push({
          winA: a > b ? 1 : 0,
          winB: a < b ? 1 : 0,
          weight: Math.log(1 + Math.abs(a - b)),
        });
      });
    });
    return setResults;
  }

  function negLogLikelihood(log_r, setResults) {
    const [log_rA, log_rB] = log_r;
    const rA = Math.exp(log_rA);
    const rB = Math.exp(log_rB);
    let ll = 0;
    setResults.forEach(res => {
      const p = rA / (rA + rB);
      const pClip = Math.max(1e-10, Math.min(p, 1 - 1e-10));
      ll += res.weight * (res.winA * Math.log(pClip) + res.winB * Math.log(1 - pClip));
    });
    return -ll;
  }

  function estimateBradleyTerryRatings(setResults) {
    let best = null, bestVal = Infinity;
    for (let log_rA = -2; log_rA <= 2; log_rA += 0.1) {
      for (let log_rB = -2; log_rB <= 2; log_rB += 0.1) {
        const val = negLogLikelihood([log_rA, log_rB], setResults);
        if (val < bestVal) {
          bestVal = val;
          best = [log_rA, log_rB];
        }
      }
    }
    return [Math.exp(best[0]), Math.exp(best[1])];
  }

  function calcBTScoreProbs(pA, pB) {
    return [
      { score: "3:0", probability: (Math.pow(pA, 3) * 100).toFixed(1) + "%" },
      { score: "3:1", probability: (3 * Math.pow(pA, 3) * pB * 100).toFixed(1) + "%" },
      { score: "3:2", probability: (6 * Math.pow(pA, 3) * Math.pow(pB, 2) * 100).toFixed(1) + "%" },
      { score: "0:3", probability: (Math.pow(pB, 3) * 100).toFixed(1) + "%" },
      { score: "1:3", probability: (3 * Math.pow(pB, 3) * pA * 100).toFixed(1) + "%" },
      { score: "2:3", probability: (6 * Math.pow(pB, 3) * Math.pow(pA, 2) * 100).toFixed(1) + "%" }
    ];
  }

  function predictAllScores(p) {
    const q = 1 - p;
    const scores = {
      "3:0": p ** 3,
      "3:1": 3 * p ** 3 * q,
      "3:2": 6 * p ** 3 * q ** 2,
      "0:3": q ** 3,
      "1:3": 3 * q ** 3 * p,
      "2:3": 6 * q ** 3 * p ** 2
    };
    return Object.entries(scores)
      .map(([score, prob]) => ({ score, probability: (prob * 100).toFixed(1) + "%" }))
      .sort((a, b) => parseFloat(b.probability) - parseFloat(a.probability));
  }

  function getConfidence(pA, pB, vA, vB, hTot) {
    const maxP = Math.max(pA, pB);
    if (maxP > 0.75 && hTot >= 3) return "🟢";
    if (maxP > 0.65) return "🟡";
    return "🔴";
  }

  function extractMatchResults(games, isPlayerB = false) {
    return games
      .map(g => {
        const match = g.rawScore && g.rawScore.match(/^(\d+):(\d+)/);
        if (!match) return null;
        let a = Number(match[1]);
        let b = Number(match[2]);
        if (isPlayerB) [a, b] = [b, a];
        return `${a}:${b}`;
      })
      .filter(Boolean);
  }

  function performAnalysis() {
    const tables = document.querySelectorAll("table.ev-mstat-tbl");
    if (tables.length < 2)
      return { success: false, error: "Не найдены нужные таблицы статистики." };

    const A = parseSection(tables[0]);
    const B = parseSection(tables[1]);
    if (!A.games.length || !B.games.length)
      return { success: false, error: "Нет данных об играх." };

    const h2hData = parseH2H(A.player, B.player);
    const sA = strengthAdj(A.games);
    const sB = strengthAdj(B.games);

    const kAdj = cfg.k;
    const adjustedDiff = sA - sB;
    let prob = 1 / (1 + Math.exp(-kAdj * adjustedDiff));
    prob = Math.min(0.92, Math.max(0.08, prob));
    const smoothing = 0.12;
    const probFinal = prob * (1 - smoothing) + 0.5 * smoothing;

    const W_h2h = 0.6, W_form = 0.4;
    const R_h2h = calcRh2h(A.player, B.player);
    const R_form = (() => {
      const fA = A.games.slice(0, 5).reduce((s, g) => s + g.playerPoints, 0) /
        A.games.slice(0, 5).reduce((s, g) => s + g.playerPoints + g.oppPoints, 0);
      const fB = B.games.slice(0, 5).reduce((s, g) => s + g.playerPoints, 0) /
        B.games.slice(0, 5).reduce((s, g) => s + g.playerPoints + g.oppPoints, 0);
      return (fA + fB) ? fA / (fA + fB) : 0.5;
    })();

    const pNew = W_h2h * R_h2h + W_form * R_form;
    const predictedScores = predictAllScores(pNew);

    const setsA = getSetWeights(A.games);
    const setsB = getSetWeights(B.games.map(g => ({
      ...g, pts: (g.pts || []).map(([a, b]) => [b, a])
    })));
    const allSets = [...setsA, ...setsB];
    let btScoreProbs = [];
    let rA = 1, rB = 1, bt_pSetA = 0.5, bt_pSetB = 0.5;
    if (allSets.length >= 3) {
      [rA, rB] = estimateBradleyTerryRatings(allSets);
      bt_pSetA = rA / (rA + rB);
      bt_pSetB = rB / (rA + rB);
      btScoreProbs = calcBTScoreProbs(bt_pSetA, bt_pSetB);
    }

    const playerAMatchRawScores = A.games.map(g => g.rawScore).filter(Boolean);
    const playerBMatchRawScores = B.games.map(g => {
      if (!g.rawScore) return "";
      return g.rawScore.split(",").map(p => {
        const [a, b] = p.trim().split(":");
        return b + ":" + a;
      }).join(", ");
    }).filter(Boolean);

    const KU_tb35_playerA = calculatePersistenceCoefficient(playerAMatchRawScores);
    const KU_tb35_playerB = calculatePersistenceCoefficient(playerBMatchRawScores);
    const KUmodPlayerA = calculatePersistenceMod(playerAMatchRawScores);
    const KUmodPlayerB = calculatePersistenceMod(playerBMatchRawScores);

    const combinedA = combinedIndex(KUmodPlayerA);
    const combinedB = combinedIndex(KUmodPlayerB);

    return {
      success: true,
      data: {
        playerA: {
          name: A.player,
          strength: (50 + 50 * sA).toFixed(1),
          probability: (probFinal * 100).toFixed(1),
          h2h: `${h2hData.wA}-${h2hData.wB}`,
          s2: calcBaseS(A.games, 2).toFixed(3),
          s5: calcBaseS(A.games, 5).toFixed(3),
          dryWins: calcDryGames(A.games).wins,
          dryLosses: calcDryGames(A.games).losses,
          setWins: calcSetWins(A.games),
          visualization: createMatchVisualization(A.games),
          ku_tb35: KU_tb35_playerA,
          ku_tb35_mod: KUmodPlayerA,
          combinedIndex: combinedA
        },
        playerB: {
          name: B.player,
          strength: (50 + 50 * sB).toFixed(1),
          probability: ((1 - probFinal) * 100).toFixed(1),
          h2h: `${h2hData.wB}-${h2hData.wA}`,
          s2: calcBaseS(B.games, 2).toFixed(3),
          s5: calcBaseS(B.games, 5).toFixed(3),
          dryWins: calcDryGames(B.games).wins,
          dryLosses: calcDryGames(B.games).losses,
          setWins: calcSetWins(B.games),
          visualization: createMatchVisualization(B.games),
          ku_tb35: KU_tb35_playerB,
          ku_tb35_mod: KUmodPlayerB,
          combinedIndex: combinedB
        },
        confidence: getConfidence(probFinal, 1 - probFinal, 0, 0, h2hData.total),
        favorite: probFinal > 0.5 ? A.player : B.player,
        predictedScores,
        btScoreProbs,
        bt_ratings: { rA, rB },
        bt_pSetA,
        bt_pSetB,
        h2h: {
          total: h2hData.total,
          visualization: probFinal > 0.5
            ? createMatchVisualization(h2hData.h2hGames)
            : createMatchVisualization(h2hData.h2hGames.map(g => ({ win: 1 - g.win })))
        }
      }
    };
  }

  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "analyze") {
      sendResponse(performAnalysis());
      return true;
    }
  });
})();
