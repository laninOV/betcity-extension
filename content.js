(() => {
  const cfg = {
    a1: 1,
    a2: 0.5,
    a3: 0.3,
    a4: 0.2,
    tau: 0.03,
    fMax: 5,
    k: 5,
    h2hK: 0.15,
    stabilityWeight: 0.5
  };

  const now = new Date();

  function parseGame(row, header) {
    const dateText = row.querySelector("td.date")?.textContent.trim();
    if (!dateText) return null;
    const [d, m, y] = dateText.split(".").map(Number);
    const dt = new Date(2000 + y, m - 1, d);
    const diffDays = Math.floor((now - dt) / 86400000);
    const info = row.nextElementSibling;
    if (!info) return null;
    const playersText = info.querySelector("td.ev-mstat-ev")?.textContent.trim();
    const scoreText = info.querySelector("td.score")?.textContent.trim();
    if (!playersText || !scoreText) return null;
    const match = scoreText.match(/^(\d+):(\d+)\s*\(([^)]+)\)/);
    if (!match) return null;
    const [, s1, s2, pts] = match;
    let pairs = pts.split(",").map(p => p.trim().split(":").map(Number));
    if (!pairs.length || pairs.some(p => p.length !== 2 || p.some(isNaN))) return null;
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
    const w = Math.exp(-cfg.tau * diffDays);
    const sr = (playerSets + oppSets) ? (playerSets - oppSets) / (playerSets + oppSets) : 0;
    const pr = (playerPoints + oppPoints) ? Math.tanh((playerPoints - oppPoints) / (playerPoints + oppPoints)) : 0;
    const avgH = (playerSets + oppSets) ? handicap / (playerSets + oppSets) : 0;
    const hn = Math.max(-1, Math.min(1, avgH / cfg.fMax));
    const qualityBonus = win ? (playerSets === 3 && oppSets === 0 ? 0.2 : playerSets === 3 && oppSets === 1 ? 0.1 : 0) : 0;
    const Mi = cfg.a1 * win + cfg.a2 * sr + cfg.a3 * pr + cfg.a4 * hn + qualityBonus;
    return {
      win, playerSets, oppSets, pts: pairs, handicap, w, Mi, diffDays,
      isDryWin, isDryLoss, date: dt, playerPoints, oppPoints
    };
  }

  function parseSection(table) {
    const title = table.querySelector("tr:first-child td")?.textContent || "";
    const header = title.replace(/^Последние игры\s*/i, "").replace(/:$/, "").trim();
    const rows = Array.from(table.querySelectorAll("tr")).slice(2);
    const games = [];
    for (let i = 0; i + 1 < rows.length && games.length < 10; i += 2) {
      const g = parseGame(rows[i], header);
      if (g) games.push(g);
    }
    return { player: header, games };
  }

  function calcBaseS(games, limit = null) {
    const arr = limit ? games.slice(0, limit) : games;
    let num = 0, den = 0;
    arr.forEach(g => { num += g.w * g.Mi; den += g.w; });
    return den ? num / den : 0;
  }

  function calcForaBalance(games) {
    const wins = games.filter(g => g.win), losses = games.filter(g => !g.win);
    const fW = wins.length ? wins.reduce((s, g) => s + g.handicap, 0) / wins.length : 0;
    const fL = losses.length ? losses.reduce((s, g) => s + Math.abs(g.handicap), 0) / losses.length : 0;
    return Math.tanh((fW - fL) / cfg.fMax);
  }

  function calcForaVariance(games) {
    if (!games.length) return 0;
    const meanVal = games.reduce((s, g) => s + g.handicap, 0) / games.length;
    const variance = games.reduce((s, g) => s + (g.handicap - meanVal) ** 2, 0) / games.length;
    return Math.sqrt(variance);
  }

  function strengthAdj(games) {
    return calcBaseS(games) + 0.25 * calcForaBalance(games);
  }

  function calcStability(v) {
    return Math.round(Math.max(0, 100 - v * 8));
  }

  function calcDryGames(games) {
    return {
      wins: games.filter(g => g.isDryWin).length,
      losses: games.filter(g => g.isDryLoss).length,
    };
  }

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

  function createMatchVisualization(games) {
    return games.slice(0, 10).map(g => (g.win ? "🟢" : "🔴")).join(" ");
  }

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
      const [d, mth, y] = dateTxt.split(".").map(Number);
      const dt = new Date(2000 + y, mth - 1, d);
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
      h2hGames.push({ win: aWon ? 1 : 0, date: dt, pts: null });
    });
    return { wA, wB, total: wA + wB, h2hGames, dryWinsA: dryA, dryWinsB: dryB };
  }

  function getConfidence(pA, pB, vA, vB, hTot) {
    const maxP = Math.max(pA, pB);
    if (maxP > 0.75 && Math.min(vA, vB) < 8 && hTot >= 3) return "🟢";
    if (maxP > 0.65 && Math.min(vA, vB) < 12) return "🟡";
    return "🔴";
  }

  function predictAllScores(p) {
    const q = 1 - p;
    const scores = {
      "3:0": p ** 3,
      "3:1": 3 * p ** 3 * q,
      "3:2": 6 * p ** 3 * q ** 2,
      "0:3": q ** 3,
      "1:3": 3 * q ** 3 * p,
      "2:3": 6 * q ** 3 * p ** 2,
    };
    return Object.entries(scores)
      .map(([score, probability]) => ({ score, probability: (probability * 100).toFixed(1) + "%" }))
      .sort((a, b) => parseFloat(b.probability) - parseFloat(a.probability));
  }

  function getSetWeights(games) {
    let setResults = [];
    games.forEach(g => {
      (g.pts || []).forEach(([a, b]) => {
        setResults.push({
          winA: a > b ? 1 : 0,
          winB: a < b ? 1 : 0,
          weight: Math.log(1 + Math.abs(a - b))
        });
      });
    });
    return setResults;
  }

  function negLogLikelihood(log_r, setResults) {
    const [log_rA, log_rB] = log_r;
    const rA = Math.exp(log_rA), rB = Math.exp(log_rB);
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
      { score: '3:0', probability: (Math.pow(pA, 3) * 100).toFixed(1) + '%' },
      { score: '3:1', probability: (3 * Math.pow(pA, 3) * pB * 100).toFixed(1) + '%' },
      { score: '3:2', probability: (6 * Math.pow(pA, 3) * Math.pow(pB, 2) * 100).toFixed(1) + '%' },
      { score: '0:3', probability: (Math.pow(pB, 3) * 100).toFixed(1) + '%' },
      { score: '1:3', probability: (3 * Math.pow(pB, 3) * pA * 100).toFixed(1) + '%' },
      { score: '2:3', probability: (6 * Math.pow(pB, 3) * Math.pow(pA, 2) * 100).toFixed(1) + '%' }
    ];
  }

  function calcRh2h(player, opponent) {
    const tbl = [...document.querySelectorAll("table")].find(t =>
      t.querySelector("tr:first-child td")?.textContent.includes("Очные встречи")
    );
    if (!tbl) return 0.5;
    const tau = 0.1, now = new Date();
    let pSum = 0, oSum = 0;
    Array.from(tbl.querySelectorAll("tr")).slice(2).forEach(row => {
      const playersTxt = row.querySelector("td.descr")?.textContent.trim();
      const scoreTxt = row.querySelector("td.score")?.textContent.trim();
      const dateTxt = row.querySelector("td.date")?.textContent.trim();
      if (!playersTxt || !scoreTxt || !dateTxt) return;
      const pointsMatch = scoreTxt.match(/\(([^)]+)\)/);
      if (!pointsMatch) return;
      const [d, m, y] = dateTxt.split(".").map(Number);
      const dt = new Date(2000 + y, m - 1, d);
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

  function calcRform(gamesA, gamesB) {
    function calcForm(games) {
      const last = games.slice(0, 5);
      let w = 0, all = 0;
      last.forEach(g => {
        w += g.playerPoints;
        all += g.playerPoints + g.oppPoints;
      });
      return all ? (w / all) : 0.5;
    }
    const fA = calcForm(gamesA), fB = calcForm(gamesB);
    if (fA + fB === 0) return 0.5;
    return fA / (fA + fB);
  }

  function computeOver35Rate(games) {
    if (!Array.isArray(games) || !games.length) return 0.5;
    const count = games.filter(g => g && g.pts && g.pts.length >= 4).length;
    return count / games.length;
  }

  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, x) => a + x, 0) / arr.length;
  }

  function stability(games) {
    if (!games.length) return 0;
    const m = mean(games.map(g => (g && typeof g.Mi === 'number' ? g.Mi : 0)));
    return Math.sqrt(mean(games.map(g => Math.pow((g && typeof g.Mi === 'number' ? g.Mi : 0) - m, 2))));
  }

  function dryScoreRate(games) {
    if (!games.length) return 0.5;
    return games.filter(g => g && g.pts && g.pts.length === 3 && (g.playerSets === 3 || g.oppSets === 3)).length / games.length;
  }

  function countSetsDistribution(games) {
    let dist = { 3: 0, 4: 0, 5: 0 };
    games.forEach(g => {
      if (!g || !g.pts || !Array.isArray(g.pts)) return;
      const setCount = g.pts.length;
      if (setCount === 3) dist[3]++;
      else if (setCount === 4) dist[4]++;
      else if (setCount === 5) dist[5]++;
    });
    const totalSets = dist[3] + dist[4] + dist[5];
    if (totalSets === 0) return { p3: 0.34, p4: 0.33, p5: 0.33 };
    return {
      p3: dist[3] / totalSets,
      p4: dist[4] / totalSets,
      p5: dist[5] / totalSets,
    };
  }

  function weightedSetsDistribution(h2h, A, B, wH2H = 0.5, wA = 0.25, wB = 0.25) {
    return {
      P3: +(h2h.p3 * wH2H + A.p3 * wA + B.p3 * wB).toFixed(3),
      P4: +(h2h.p4 * wH2H + A.p4 * wA + B.p4 * wB).toFixed(3),
      P5: +(h2h.p5 * wH2H + A.p5 * wA + B.p5 * wB).toFixed(3),
    };
  }

  function performAnalysis() {
    const tables = document.querySelectorAll("table.ev-mstat-tbl");
    if (tables.length < 2) return { success: false, error: "На странице не найдены таблицы статистики (нужно 2)." };

    const A = parseSection(tables[0]);
    const B = parseSection(tables[1]);
    if (!A.games.length || !B.games.length) return { success: false, error: "Нет данных об играх." };
    const h2hData = parseH2H(A.player, B.player);

    const sA = strengthAdj(A.games);
    const sB = strengthAdj(B.games);

    const vA = calcForaVariance(A.games);
    const vB = calcForaVariance(B.games);

    const stabilityWeight = cfg.stabilityWeight || 0.5;
    const kAdj = cfg.k * stabilityWeight;
    const unstablePenalty = (1 - stabilityWeight) * (vA + vB) / 20;
    const adjustedDiff = sA - sB - unstablePenalty;

    let prob = 1 / (1 + Math.exp(-kAdj * adjustedDiff));
    prob = Math.min(0.93, Math.max(0.07, prob));
    const smoothing = 0.14;
    const probFinal = prob * (1 - smoothing) + 0.5 * smoothing;

    const W_h2h = 0.65, W_form = 0.35;
    const R_h2h = calcRh2h(A.player, B.player);
    const R_form = calcRform(A.games, B.games);
    const pNew = W_h2h * R_h2h + W_form * R_form;

    const predictedScores = predictAllScores(pNew);

    // --- Новый метод Брэдли-Терри ---
    const setsA = getSetWeights(A.games);
    const setsB = getSetWeights(B.games.map(g => {
      return { ...g, pts: (g.pts || []).map(([a, b]) => [b, a]) };
    }));
    const setsH2H = getSetWeights((h2hData.h2hGames || []).filter(g => Array.isArray(g.pts)).map(g => ({ pts: g.pts })));
    const allSets = [...setsA, ...setsB, ...setsH2H];

    let btScoreProbs = [];
    let rA = 1, rB = 1, bt_pSetA = 0.5, bt_pSetB = 0.5;
    if (allSets.length >= 3) {
      [rA, rB] = estimateBradleyTerryRatings(allSets);
      bt_pSetA = rA / (rA + rB);
      bt_pSetB = rB / (rA + rB);
      btScoreProbs = calcBTScoreProbs(bt_pSetA, bt_pSetB);
    }

    const overA = computeOver35Rate(A.games);
    const overB = computeOver35Rate(B.games);
    const overH2H = computeOver35Rate(h2hData.h2hGames);

    let bonus = 0;
    const last5_A5set = A.games.slice(0, 5).filter(g => g && g.pts && g.pts.length === 5).length;
    const last5_B5set = B.games.slice(0, 5).filter(g => g && g.pts && g.pts.length === 5).length;
    const last5_H2H5set = h2hData.h2hGames.slice(0, 5).filter(g => g && g.pts && g.pts.length === 5).length;
    if ([last5_A5set, last5_B5set, last5_H2H5set].some(v => v >= 3)) bonus = 0.07;

    const avgStrengthDiff = Math.abs(mean(A.games.map(g => g?.Mi || 0)) - mean(B.games.map(g => g?.Mi || 0)));
    const dryA = dryScoreRate(A.games);
    const dryB = dryScoreRate(B.games);
    const stabA = stability(A.games);
    const stabB = stability(B.games);

    let setsOver35prob =
      overH2H * 0.5 +
      overA * 0.2 +
      overB * 0.2 +
      (1 - avgStrengthDiff) * 0.08 +
      (1 - dryA) * 0.05 +
      (1 - dryB) * 0.05 +
      ((stabA + stabB) / 2) * 0.07 +
      bonus;

    setsOver35prob = Math.min(0.98, Math.max(0.05, +setsOver35prob.toFixed(3)));

    const setsOver35 = { prob: setsOver35prob, parts: { overA, overB, overH2H } };

    const distrA = countSetsDistribution(A.games);
    const distrB = countSetsDistribution(B.games);
    const distrH2H = countSetsDistribution(h2hData.h2hGames);

    const setsDist = weightedSetsDistribution(distrH2H, distrA, distrB);

    const historyLength = 5, predictionLength = 3;
    const buildLabels = (hLen, pLen) =>
      [...Array(hLen).keys()].map(i => `-${hLen - i}`).concat([...Array(pLen).keys()].map(i => `П${i + 1}`));
    const getFormMiArr = (games, len) => {
      const arr = games.slice(0, len).map(g => +g.Mi.toFixed(3));
      while (arr.length < len) arr.unshift(null);
      return arr.reverse();
    };
    const getPredictionArr = (games, len) => {
      const lastThree = games.slice(0, 3);
      const avgMi = lastThree.length ? lastThree.reduce((s, g) => s + g.Mi, 0) / lastThree.length : 0;
      return Array(len).fill(+avgMi.toFixed(3));
    };

    const h2hGraphGames = h2hData.h2hGames.slice(0, 10).reverse();
    const h2hChartData = {
      labels: h2hGraphGames.map((_, i) => `H2H -${h2hGraphGames.length - i}`),
      data: h2hGraphGames.map(g => (probFinal > 0.5 ? g.win : 1 - g.win)),
      favoriteName: probFinal > 0.5 ? A.player : B.player,
    };

    return {
      success: true,
      data: {
        playerA: {
          name: A.player,
          strength: (50 + 50 * sA).toFixed(1),
          probability: (probFinal * 100).toFixed(1),
          h2h: `${h2hData.wA}-${h2hData.wB}`,
          stability: calcStability(vA),
          s2: calcBaseS(A.games, 2).toFixed(3),
          s5: calcBaseS(A.games, 5).toFixed(3),
          dryWins: calcDryGames(A.games).wins,
          dryLosses: calcDryGames(A.games).losses,
          h2hDryLoss: h2hData.dryWinsB,
          setWins: calcSetWins(A.games),
          visualization: createMatchVisualization(A.games)
        },
        playerB: {
          name: B.player,
          strength: (50 + 50 * sB).toFixed(1),
          probability: ((1 - probFinal) * 100).toFixed(1),
          h2h: `${h2hData.wB}-${h2hData.wA}`,
          stability: calcStability(vB),
          s2: calcBaseS(B.games, 2).toFixed(3),
          s5: calcBaseS(B.games, 5).toFixed(3),
          dryWins: calcDryGames(B.games).wins,
          dryLosses: calcDryGames(B.games).losses,
          h2hDryLoss: h2hData.dryWinsA,
          setWins: calcSetWins(B.games),
          visualization: createMatchVisualization(B.games)
        },
        confidence: getConfidence(probFinal, 1 - probFinal, vA, vB, h2hData.total),
        favorite: probFinal > 0.5 ? A.player : B.player,
        predictedScores,
        btScoreProbs,
        bt_ratings: { rA, rB },
        bt_pSetA,
        bt_pSetB,
        setsDist,
        setsOver35,
        h2h: {
          total: h2hData.total,
          visualization: probFinal > 0.5
            ? createMatchVisualization(h2hData.h2hGames)
            : createMatchVisualization(h2hData.h2hGames.map(g => ({ win: 1 - g.win })))
        },
        formChartData: {
          labels: buildLabels(historyLength, predictionLength),
          playerA: {
            form: getFormMiArr(A.games, historyLength).concat(Array(predictionLength).fill(null)),
            prediction: Array(historyLength).fill(null).concat(getPredictionArr(A.games, predictionLength))
          },
          playerB: {
            form: getFormMiArr(B.games, historyLength).concat(Array(predictionLength).fill(null)),
            prediction: Array(historyLength).fill(null).concat(getPredictionArr(B.games, predictionLength))
          }
        },
        h2hChartData
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
