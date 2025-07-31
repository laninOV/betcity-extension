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

  /* ===========================================================
     НОВЫЕ МЕТОДЫ ПРОГНОЗИРОВАНИЯ - ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
     =========================================================== */

  function normalCDF(x) {
    return 0.5 * (1 + erf(x / Math.sqrt(2)));
  }

  function erf(x) {
    const a1 =  0.254829592, a2 = -0.284496736;
    const a3 =  1.421413741, a4 = -1.453152027;
    const a5 =  1.061405429, p  =  0.3275911;
    
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
    return sign * y;
  }

  function factorial(n) {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= Math.min(n, 20); i++) { // Ограничиваем для избежания переполнения
      result *= i;
    }
    return result;
  }

  /* ---------- BRADLEY-TERRY MODEL ---------- */
  function bradleyTerryProbability(strengthA, strengthB) {
    const diff = strengthA - strengthB;
    return 1 / (1 + Math.exp(-diff));
  }

  function calculateBTStrength(wins, losses) {
    const total = wins + losses;
    if (total === 0) return 0;
    const winRate = Math.max(0.01, Math.min(0.99, wins / total)); // Ограничиваем диапазон
    return Math.log(winRate / (1 - winRate));
  }

  /* ---------- ELO RATING SYSTEM ---------- */
  function eloExpectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  /* ---------- GLICKO RATING SYSTEM ---------- */
  function glickoGFunction(rd) {
    const q = Math.log(10) / 400;
    return 1 / Math.sqrt(1 + 3 * q * q * rd * rd / (Math.PI * Math.PI));
  }

  function glickoExpectedScore(ratingA, ratingB, rdB) {
    const g = glickoGFunction(rdB);
    return 1 / (1 + Math.pow(10, g * (ratingB - ratingA) / 400));
  }

  /* ---------- TRUESKILL RATING SYSTEM ---------- */
  function trueSkillWinProbability(muA, sigmaA, muB, sigmaB, beta = 4.167) {
    const delta = muA - muB;
    const c = Math.sqrt(sigmaA * sigmaA + sigmaB * sigmaB + 2 * beta * beta);
    return normalCDF(delta / c);
  }

  /* ---------- BAYESIAN HIERARCHICAL MODEL ---------- */
  function bayesianServeProbability(serveSkillA, returnSkillB) {
    const logit = serveSkillA - returnSkillB;
    return 1 / (1 + Math.exp(-logit));
  }

  function calculateServeSkill(servePointsWon, servePointsTotal) {
    if (servePointsTotal === 0) return 0;
    const rate = Math.max(0.01, Math.min(0.99, servePointsWon / servePointsTotal));
    return Math.log(rate / (1 - rate));
  }

  /* ---------- LOGISTIC REGRESSION ---------- */
  function logisticRegression(features, coefficients) {
    let sum = coefficients[0];
    for (let i = 0; i < features.length; i++) {
      sum += coefficients[i + 1] * features[i];
    }
    return 1 / (1 + Math.exp(-sum));
  }

  function prepareLogisticFeatures(playerA, playerB) {
    const ratingDiff = (playerA.rating || 1500) - (playerB.rating || 1500);
    const formDiff = (playerA.recentWinRate || 0.5) - (playerB.recentWinRate || 0.5);
    const h2hDiff = (playerA.h2hWinRate || 0.5) - (playerB.h2hWinRate || 0.5);
    
    return [
      ratingDiff / 400,
      formDiff,
      h2hDiff
    ];
  }

  /* ---------- POISSON DISTRIBUTION ---------- */
  function poissonPMF(k, lambda) {
    if (k > 20 || lambda > 100) return 0; // Избегаем переполнения
    return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
  }

  function poissonCDF(k, lambda) {
    let sum = 0;
    for (let i = 0; i <= Math.min(k, 20); i++) {
      sum += poissonPMF(i, lambda);
    }
    return sum;
  }

  function predictTotalOver(lambdaA, lambdaB, threshold = 74.5) {
    const lambdaTotal = lambdaA + lambdaB;
    return 1 - poissonCDF(Math.floor(threshold), lambdaTotal);
  }

  function mostLikelyScore(lambdaA, lambdaB) {
    let maxProb = 0;
    let bestScore = { scoreA: Math.round(lambdaA), scoreB: Math.round(lambdaB), probability: 0 };
    
    const rangeA = Math.max(5, Math.min(10, lambdaA));
    const rangeB = Math.max(5, Math.min(10, lambdaB));
    
    for (let i = Math.max(0, lambdaA - rangeA); i <= lambdaA + rangeA; i++) {
      for (let j = Math.max(0, lambdaB - rangeB); j <= lambdaB + rangeB; j++) {
        const prob = poissonPMF(i, lambdaA) * poissonPMF(j, lambdaB);
        if (prob > maxProb) {
          maxProb = prob;
          bestScore = { scoreA: i, scoreB: j, probability: prob };
        }
      }
    }
    return bestScore;
  }

  /* ---------- ENSEMBLE METHODS ---------- */
  function weightedEnsemble(predictions, weights) {
    let sum = 0;
    let totalWeight = 0;
    
    for (const [model, pred] of Object.entries(predictions)) {
      const weight = weights[model] || 0;
      if (!isNaN(pred) && isFinite(pred)) {
        sum += pred * weight;
        totalWeight += weight;
      }
    }
    
    return totalWeight > 0 ? sum / totalWeight : 0.5;
  }

  function calculateConfidence(predictions) {
    const values = Object.values(predictions).filter(v => !isNaN(v) && isFinite(v));
    if (values.length === 0) return 0.5;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / values.length;
    return 1 / (1 + 5 * variance);
  }

  /* ---------- ИНТЕГРИРОВАННОЕ ПРЕДСКАЗАНИЕ ---------- */
  function predictMatchAdvanced(playerA, playerB) {
    const predictions = {};
    
    try {
      // Bradley-Terry
      const strengthA = calculateBTStrength(playerA.wins || 0, playerA.losses || 0);
      const strengthB = calculateBTStrength(playerB.wins || 0, playerB.losses || 0);
      predictions.bradleyTerry = bradleyTerryProbability(strengthA, strengthB);
      
      // Elo
      predictions.elo = eloExpectedScore(playerA.rating || 1500, playerB.rating || 1500);
      
      // Glicko
      predictions.glicko = glickoExpectedScore(
        playerA.rating || 1500, 
        playerB.rating || 1500, 
        playerB.rd || 200
      );
      
      // TrueSkill
      predictions.trueSkill = trueSkillWinProbability(
        playerA.mu || 25, playerA.sigma || 8.33,
        playerB.mu || 25, playerB.sigma || 8.33
      );
      
      // Bayesian
      const serveSkillA = calculateServeSkill(playerA.serveWon || 0, playerA.serveTotal || 1);
      const returnSkillB = calculateServeSkill(playerB.returnWon || 0, playerB.returnTotal || 1);
      predictions.bayesian = bayesianServeProbability(serveSkillA, -returnSkillB);
      
      // Logistic Regression
      const features = prepareLogisticFeatures(playerA, playerB);
      const coefficients = [-0.1, 0.8, 1.2, 0.6];
      predictions.logistic = logisticRegression(features, coefficients);
      
      // Markov (упрощенно)
      const pServeA = (playerA.serveWon || 0) / (playerA.serveTotal || 1);
      const pServeB = (playerB.serveWon || 0) / (playerB.serveTotal || 1);
      const serveAdvantage = (pServeA - 0.5) - (pServeB - 0.5);
      predictions.markov = Math.max(0.1, Math.min(0.9, 0.5 + serveAdvantage));
      
      // Poisson
      const lambdaA = playerA.avgPoints || 37;
      const lambdaB = playerB.avgPoints || 37;
      predictions.poisson = lambdaA / (lambdaA + lambdaB);
      
    } catch (error) {
      console.error('Error in advanced prediction:', error);
    }
    
    // Веса по умолчанию
    const defaultWeights = {
      bradleyTerry: 0.15,
      elo: 0.15,
      glicko: 0.15,
      trueSkill: 0.15,
      bayesian: 0.15,
      logistic: 0.10,
      markov: 0.10,
      poisson: 0.05
    };
    
    const ensemble = weightedEnsemble(predictions, defaultWeights);
    const confidence = calculateConfidence(predictions);
    
    return {
      predictions,
      ensemble,
      confidence,
      favorite: ensemble > 0.5 ? 'playerA' : 'playerB',
      probability: Math.max(ensemble, 1 - ensemble)
    };
  }

  /* ---------- ПРЕДСКАЗАНИЕ СЧЕТА ---------- */
  function predictScoreAdvanced(playerA, playerB) {
    const lambdaA = playerA.avgPoints || 37;
    const lambdaB = playerB.avgPoints || 37;
    
    return {
      expectedTotal: lambdaA + lambdaB,
      probOver74_5: predictTotalOver(lambdaA, lambdaB, 74.5),
      mostLikelyScore: mostLikelyScore(lambdaA, lambdaB)
    };
  }

  /* ===========================================================
     СУЩЕСТВУЮЩИЙ КОД - БЕЗ ИЗМЕНЕНИЙ
     =========================================================== */

  function parseGame(row, header) {
    try {
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
    } catch (error) {
      console.error('Error parsing game:', error);
      return null;
    }
  }

  // Остальные существующие функции без изменений...
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
    try {
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
    } catch (error) {
      console.error('Error parsing H2H:', error);
      return { wA: 0, wB: 0, total: 0, dryWinsA: 0, dryWinsB: 0, h2hGames: [] };
    }
  }

  // Функция для создания данных для новых методов
  function createAdvancedPlayerData(playerData, games, h2hData, isPlayerA = true) {
    try {
      const recentGames = games.slice(0, 5);
      const wins = recentGames.filter(g => g.win).length;
      const losses = recentGames.length - wins;
      
      const totalPoints = games.reduce((sum, g) => sum + (g.playerPoints || 0) + (g.oppPoints || 0), 0);
      const avgPoints = totalPoints / Math.max(games.length, 1);
      
      const servePointsWon = Math.floor(avgPoints * 0.52);
      const servePointsTotal = Math.floor(avgPoints * 0.7);
      const returnPointsWon = Math.floor(avgPoints * 0.48);
      const returnPointsTotal = Math.floor(avgPoints * 0.3);
      
      return {
        wins,
        losses,
        rating: 1500 + (parseFloat(playerData.strength) - 50) * 8,
        mu: 25 + (parseFloat(playerData.strength) - 50) * 0.2,
        sigma: Math.max(1, 8.33 - games.length * 0.3),
        rd: Math.max(30, 200 - games.length * 5),
        serveWon: servePointsWon,
        serveTotal: servePointsTotal,
        returnWon: returnPointsWon,
        returnTotal: returnPointsTotal,
        avgPoints: avgPoints || 37,
        recentWinRate: wins / Math.max(recentGames.length, 1),
        h2hWinRate: isPlayerA ? (h2hData.wA / Math.max(h2hData.total, 1)) : (h2hData.wB / Math.max(h2hData.total, 1))
      };
    } catch (error) {
      console.error('Error creating advanced player data:', error);
      return {
        wins: 0, losses: 0, rating: 1500, mu: 25, sigma: 8.33, rd: 200,
        serveWon: 0, serveTotal: 1, returnWon: 0, returnTotal: 1,
        avgPoints: 37, recentWinRate: 0.5, h2hWinRate: 0.5
      };
    }
  }

  // Остальные существующие функции (сокращенно для экономии места)
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

  function performAnalysis() {
    try {
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

      const predictedScores = predictAllScores(probFinal);

      // Создаем данные игроков
      const playerDataA = {
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
      };

      const playerDataB = {
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
      };

      // === НОВЫЕ МЕТОДЫ ===
      const advancedPlayerA = createAdvancedPlayerData(playerDataA, A.games, h2hData, true);
      const advancedPlayerB = createAdvancedPlayerData(playerDataB, B.games, h2hData, false);

      const advancedPrediction = predictMatchAdvanced(advancedPlayerA, advancedPlayerB);
      const advancedScore = predictScoreAdvanced(advancedPlayerA, advancedPlayerB);

      return {
        success: true,
        data: {
          playerA: playerDataA,
          playerB: playerDataB,
          confidence: getConfidence(probFinal, 1 - probFinal, vA, vB, h2hData.total),
          favorite: probFinal > 0.5 ? A.player : B.player,
          predictedScores,
          
          // Новые данные
          advancedPrediction,
          advancedScore,
          
          h2h: {
            total: h2hData.total,
            visualization: probFinal > 0.5
              ? createMatchVisualization(h2hData.h2hGames)
              : createMatchVisualization(h2hData.h2hGames.map(g => ({ win: 1 - g.win })))
          },
        }
      };

    } catch (error) {
      console.error('Analysis error:', error);
      return { success: false, error: "Ошибка при анализе: " + error.message };
    }
  }

  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "analyze") {
      try {
        const result = performAnalysis();
        sendResponse(result);
      } catch (error) {
        console.error('Message handler error:', error);
        sendResponse({ success: false, error: "Ошибка обработки: " + error.message });
      }
      return true;
    }
  });
})();
