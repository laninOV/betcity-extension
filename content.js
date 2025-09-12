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
    stabilityWeight: 0.6,
  };

  const now = new Date();

  // --- Анализ личных встреч (H2H) ---
  function parseH2H(playerA, playerB) {
    const tbl = [...document.querySelectorAll("table")].find(t =>
      t.querySelector("tr:first-child td")?.textContent.includes("Очные встречи")
    );
    if (!tbl) return { wA: 0, wB: 0, total: 0, dryWinsA: 0, dryWinsB: 0, h2hGames: [], h2hSetWins: null };

    let wA = 0, wB = 0, dryA = 0, dryB = 0;
    const h2hGames = [];
    const h2hSetData = { playerA: {}, playerB: {} };
    
    Array.from(tbl.querySelectorAll("tr")).slice(2).forEach(r => {
      const playersTxt = r.querySelector("td.descr")?.textContent.trim();
      const score = r.querySelector("td.score")?.textContent.trim();
      const dateTxt = r.querySelector("td.date")?.textContent.trim();
      if (!playersTxt || !score || !dateTxt) return;
      const m = score.match(/^(\d+):(\d+)\s*\(([^)]+)\)/);
      if (!m) return;
      const [d, mth, y] = dateTxt.split(".").map(Number);
      const dt = new Date(2000 + y, mth - 1, d);
      const home = playersTxt.startsWith(playerA);
      const [s1, s2] = [+m[1], +m[2]];
      const aWon = (home && s1 > s2) || (!home && s2 > s1);
      
      // Извлекаем данные о сетах из скобок
      const setsText = m[3];
      const sets = setsText.split(",").map(s => s.trim().split(":").map(Number));
      
      if (aWon) {
        wA++;
        if ((home && s2 === 0) || (!home && s1 === 0)) dryA++;
      } else {
        wB++;
        if ((home && s1 === 0) || (!home && s2 === 0)) dryB++;
      }
      
      // Сохраняем данные о сетах для H2H
      sets.forEach(([a, b], idx) => {
        const setKey = `set${idx + 1}`;
        if (!h2hSetData.playerA[setKey]) h2hSetData.playerA[setKey] = { win: 0, total: 0 };
        if (!h2hSetData.playerB[setKey]) h2hSetData.playerB[setKey] = { win: 0, total: 0 };
        
        if (home) {
          if (a > b) h2hSetData.playerA[setKey].win++;
          else h2hSetData.playerB[setKey].win++;
        } else {
          if (b > a) h2hSetData.playerA[setKey].win++;
          else h2hSetData.playerB[setKey].win++;
        }
        h2hSetData.playerA[setKey].total++;
        h2hSetData.playerB[setKey].total++;
      });
      
      h2hGames.push({ win: aWon ? 1 : 0, date: dt, pts: sets });
    });
    
    // Преобразуем данные в формат setWins
    const h2hSetWins = {
      playerA: Object.fromEntries(
        Object.entries(h2hSetData.playerA).map(([set, data]) => [
          set, 
          [`${data.win}/${data.total}`, `${data.total - data.win}/${data.total}`]
        ])
      ),
      playerB: Object.fromEntries(
        Object.entries(h2hSetData.playerB).map(([set, data]) => [
          set, 
          [`${data.win}/${data.total}`, `${data.total - data.win}/${data.total}`]
        ])
      )
    };
    
    return { wA, wB, total: wA + wB, h2hGames, dryWinsA: dryA, dryWinsB: dryB, h2hSetWins };
  }

  // --- Коэффициент очкового преимущества по личным встречам (весовой) ---
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

  // --- Старая формула коэффициента упорства (для совместимости) ---
  function calculatePersistenceCoefficient(matchScores) {
    if (!matchScores || !matchScores.length) return 0;
    let matchRatios = [];
    let matchWins = [];
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
      matchRatios.push(ratios.reduce((a,b) => a+b, 0) / ratios.length);
      matchWins.push(wonSet);
    }
    if (!matchRatios.length) return 0;
    const avgRatio = matchRatios.reduce((a,b) => a+b, 0) / matchRatios.length;
    const winRate = matchWins.filter(v => v).length / matchWins.length;
    return +(avgRatio * winRate).toFixed(4);
  }

  // --- Новая модернизированная формула коэффициента упорства ---
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

  // --- Подсчёт выигрышей сетов ---
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

  // --- Подсчёт выигранных сетов (общее) ---
  function countWonSets(setWins) {
    if (!setWins) return 0;
    return Object.values(setWins).reduce((sum, [wins]) => {
      const won = Number(wins.split('/')[0]) || 0;
      return sum + won;
    }, 0);
  }

  // --- Подсчёт сыгранных сетов (общее) ---
  function countTotalSets(setWins) {
    if (!setWins) return 0;
    return Object.values(setWins).reduce((sum, [wins]) => {
      const total = Number((wins || "0/0").split('/')[1]) || 0;
      return sum + total;
    }, 0);
  }

  // --- Парсер отдельного матча ---
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
    const qualityBonus = win
      ? (playerSets === 3 && oppSets === 0 ? 0.2 : playerSets === 3 && oppSets === 1 ? 0.1 : 0)
      : 0;
    const Mi = cfg.a1 * win + cfg.a2 * sr + cfg.a3 * pr + cfg.a4 * hn + qualityBonus;

    return {
      win,
      playerSets,
      oppSets,
      pts: pairs,
      handicap,
      w,
      Mi,
      diffDays,
      isDryWin,
      isDryLoss,
      date: dt,
      playerPoints,
      oppPoints,
      rawScore: scoreText,
    };
  }

  // --- Парсер секции таблицы (все матчи без лимита) ---
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

  // --- Вычисление базовой силы ---
  function calcBaseS(games, limit = null) {
    const arr = limit ? games.slice(0, limit) : games;
    let num = 0, den = 0;
    arr.forEach(g => {
      const stabilityFactor = 1 / (1 + g.diffDays / 30);
      num += g.w * g.Mi * stabilityFactor;
      den += g.w * stabilityFactor;
    });
    return den ? num / den : 0;
  }

  // --- Баланс и дисперсия фор ---
  function calcForaBalance(games) {
    const wins = games.filter(g => g.win);
    const losses = games.filter(g => !g.win);
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

  // --- Скорректированная сила ---
  function strengthAdj(games) {
    const s = calcBaseS(games);
    const foraB = calcForaBalance(games);
    return s + 0.25 * foraB;
  }

  // --- Стабильность (улучшенный расчет) ---
  function calcStability(games) {
    if (!games.length) return 0;
    
    // 1. Стабильность по результатам (процент побед)
    const winRate = games.filter(g => g.win).length / games.length;
    const resultStability = Math.abs(winRate - 0.5) * 200; // 0-100, где 100 = очень стабильный
    
    // 2. Стабильность по фор (дисперсия)
    const meanHandicap = games.reduce((s, g) => s + g.handicap, 0) / games.length;
    const variance = games.reduce((s, g) => s + (g.handicap - meanHandicap) ** 2, 0) / games.length;
    const handicapStability = Math.max(0, 100 - Math.sqrt(variance) * 8); // 0-100
    
    // 3. Стабильность по времени (последние игры важнее)
    const recentGames = games.slice(0, Math.min(3, games.length));
    const recentWinRate = recentGames.filter(g => g.win).length / recentGames.length;
    const timeStability = Math.abs(recentWinRate - winRate) * 100; // 0-100, где 100 = стабильный
    
    // 4. Комбинированная стабильность
    const combined = (resultStability * 0.4 + handicapStability * 0.4 + timeStability * 0.2);
    return Math.round(Math.max(0, Math.min(100, combined)));
  }

  // --- Подсчёт сухих побед/поражений ---
  function calcDryGames(games) {
    return {
      wins: games.filter(g => g.isDryWin).length,
      losses: games.filter(g => g.isDryLoss).length,
    };
  }

  // --- Визуализация ---
  function createMatchVisualization(games) {
    return games.slice(0, 10).map(g => (g.win ? "🟢" : "🔴")).join(" ");
  }


  // --- Система Red Flags ---
  function redFlagsSimple(matchesA, matchesB, nameA, nameB, cfg = {}) {
    const C = Object.assign({
      BIG_MARGIN: 6,
      H2H_MIN_SETS: 7,
      H2H_BAL_LOW: 0.40,
      H2H_BAL_HIGH: 0.60,
      H2H_EDGE: 0.35,
      DECIDERS_PER_PLAYER: 2,
      DECIDERS_TOTAL: 3,
      useStyleVsForm: true
    }, cfg);

    const isDecider = (m) => {
      const a = m.sets.filter(([x,y]) => x>y).length;
      const b = m.sets.length - a;
      return (a===3 && b===2) || (b===3 && a===2);
    };
    
    const playerSetDiffs = (matches, player) => {
      let diffs = [];
      for (const m of matches) {
        const meHome = m.home === player, meAway = m.away === player;
        if (!meHome && !meAway) continue;
        for (const [h,a] of m.sets) {
          const my = meHome ? h : a;
          const opp = meHome ? a : h;
          diffs.push(my - opp);
        }
      }
      return diffs;
    };
    
    const bigSwingFlag = (matches, player, big=C.BIG_MARGIN) => {
      let hasBigWin=false, hasBigLoss=false, bonusInOneMatch=0;
      for (const m of matches) {
        const meHome = m.home === player || m.away === player;
        if (!meHome) continue;
        let winBig=false, loseBig=false;
        for (const [h,a] of m.sets) {
          const my = (m.home===player) ? h : a;
          const op = (m.home===player) ? a : h;
          const d = my - op;
          if (d >=  big) winBig = true;
          if (d <= -big) loseBig = true;
        }
        if (winBig) hasBigWin = true;
        if (loseBig) hasBigLoss = true;
        if (winBig && loseBig) bonusInOneMatch += 1;
      }
      return {flag: (hasBigWin && hasBigLoss), bonus: bonusInOneMatch};
    };

    const countDeciders = (matches) => matches.reduce((s,m)=> s + (isDecider(m)?1:0), 0);

    // H2H внутри последних 5+5
    const h2h = [];
    for (const m of [...matchesA, ...matchesB]) {
      const pa = (m.home===nameA && m.away===nameB);
      const pb = (m.home===nameB && m.away===nameA);
      if (pa || pb) h2h.push(m);
    }
    let S_A=0, S_B=0;
    for (const m of h2h) {
      for (const [h,a] of m.sets) {
        if (m.home===nameA) { S_A += (h>a)?1:0; S_B += (a>h)?1:0; }
        else               { S_A += (a>h)?1:0; S_B += (h>a)?1:0; }
      }
    }
    const pH2H = (S_A + 1) / (S_A + S_B + 2);
    const h2hSets = S_A + S_B;

    // форма по сетам за 5 матчей
    const diffsA = playerSetDiffs(matchesA, nameA);
    const diffsB = playerSetDiffs(matchesB, nameB);
    const setsWonA = diffsA.filter(d=>d>0).length, setsLostA = diffsA.filter(d=>d<0).length;
    const setsWonB = diffsB.filter(d=>d>0).length, setsLostB = diffsB.filter(d=>d<0).length;
    const formA = (setsWonA + 1) / (setsWonA + setsLostA + 2);
    const formB = (setsWonB + 1) / (setsWonB + setsLostB + 2);

    // Флаги
    let F4 = false;
    if (h2hSets >= C.H2H_MIN_SETS) {
      const balanced = (pH2H >= C.H2H_BAL_LOW && pH2H <= C.H2H_BAL_HIGH);
      const edgy = (pH2H <= C.H2H_EDGE || pH2H >= 1 - C.H2H_EDGE);
      const styleVsForm =
        C.useStyleVsForm &&
        ((pH2H < 0.5 && formA >= formB) || (pH2H > 0.5 && formB >= formA));
      F4 = balanced || (edgy && styleVsForm);
    }

    const decA = countDeciders(matchesA);
    const decB = countDeciders(matchesB);
    const F5 = (decA >= C.DECIDERS_PER_PLAYER) || (decB >= C.DECIDERS_PER_PLAYER) || ((decA + decB) >= C.DECIDERS_TOTAL);

    const swingA = bigSwingFlag(matchesA, nameA, C.BIG_MARGIN);
    const swingB = bigSwingFlag(matchesB, nameB, C.BIG_MARGIN);
    const F6 = swingA.flag || swingB.flag;
    const swingBonus = swingA.bonus + swingB.bonus;

    const riskScore = (F4 ? 2 : 0) + (F5 ? 1 : 0) + (F6 ? 1 : 0) + Math.min(1, swingBonus);
    const skip = (F4 || ((F5 ? 1:0) + (F6 ? 1:0) >= 2) || riskScore >= 3);

    return {
      flags: { F4_h2h_style: F4, F5_deciders: F5, F6_swings: F6 },
      riskScore,
      skip,
      details: {
        h2h_sets_total: h2hSets, pH2H,
        deciders_A: decA, deciders_B: decB,
        form_setshare_A: formA, form_setshare_B: formB,
        swing_bonus_in_one_match: swingBonus
      }
    };
  }

  // --- Предсказание вероятностей (обновлённая функция) ---
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
    return Object.entries(scores).map(([score, prob]) => ({
      score,
      probability: (prob * 100).toFixed(1) + "%",
    })).sort((a, b) => parseFloat(b.probability) - parseFloat(a.probability));
  }

  // --- Подсчёт сетов для BT модели ---
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

  // --- Логарифмическая функция правдоподобия для BT ---
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

  // --- Оценка рейтингов Bradley-Terry ---
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

  // --- Утилиты для BT-модели ---
  const clamp01 = x => Math.min(1 - 1e-12, Math.max(1e-12, x));
  const logit = p => Math.log(p / (1 - p));
  const invLogit = z => 1 / (1 + Math.exp(-z));

  /** Калибровка вероятности (стяжка к 0.5 для избежания завышения) */
  function calibrate(pRaw, temperature = 1.15) {
    const p = clamp01(pRaw);
    if (temperature <= 1) return p;
    return invLogit(logit(p) / temperature);
  }

  /** Распределение счётов Bo5 (до 3 побед) из вероятности сета pSetA */
  function btScoreProbsBO5(pSetA, playerA = "A", playerB = "B", temperature = 1.15) {
    const p = calibrate(pSetA, temperature);
    const q = 1 - p;

    // коэффициенты для отрицательной биномиали (T=3): C(2+k, k)
    const P30 = Math.pow(p, 3);           // 3:0
    const P31 = 3 * Math.pow(p, 3) * q;   // 3:1
    const P32 = 6 * Math.pow(p, 3) * q*q; // 3:2
    const P03 = Math.pow(q, 3);           // 0:3
    const P13 = 3 * Math.pow(q, 3) * p;   // 1:3
    const P23 = 6 * Math.pow(q, 3) * p*p; // 2:3

    const rows = [
      { score: "3:0", prob: P30, label: `${playerA} 3:0 ${playerB}` },
      { score: "3:1", prob: P31, label: `${playerA} 3:1 ${playerB}` },
      { score: "3:2", prob: P32, label: `${playerA} 3:2 ${playerB}` },
      { score: "0:3", prob: P03, label: `${playerB} 3:0 ${playerA}` },
      { score: "1:3", prob: P13, label: `${playerB} 3:1 ${playerA}` },
      { score: "2:3", prob: P23, label: `${playerB} 3:2 ${playerA}` },
    ];

    // нормировка (на всякий случай из-за округлений)
    const total = rows.reduce((s, r) => s + r.prob, 0);
    return rows
      .map(r => ({
        score: r.score,
        probability: r.prob / total,
        label: `${r.label} — ${((r.prob / total) * 100).toFixed(1)}%`
      }))
      .sort((a, b) => b.probability - a.probability);
  }

  // --- Вероятности BT (обновлённая функция) ---
  function calcBTScoreProbs(pA, pB) {
    const scores = btScoreProbsBO5(pA, "A", "B", 1.15);
    return scores.map(item => ({
      score: item.score,
      probability: (item.probability * 100).toFixed(1) + "%"
    }));
  }

  // --- Индикатор уверенности ---
  function getConfidence(pA, pB, vA, vB, hTot) {
    const maxP = Math.max(pA, pB);
    if (maxP > 0.75 && Math.min(vA, vB) < 8 && hTot >= 3) return "🟢";
    if (maxP > 0.65 && Math.min(vA, vB) < 12) return "🟡";
    return "🔴";
  }


  // --- Преобразование данных для red flags ---
  function convertToRedFlagsFormat(games, playerName) {
    return games.map(game => ({
      home: playerName,
      away: "Opponent", // будет заменено в основной функции
      sets: game.pts || []
    }));
  }

  // --- Основной анализ ---
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

    const stabWeight = cfg.stabilityWeight || 0.5;
    const stabFactorA = 1 / (1 + vA / 6);
    const stabFactorB = 1 / (1 + vB / 6);

    const kAdj = cfg.k * stabWeight;
    const adjustedDiff = sA * stabFactorA - sB * stabFactorB;

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
    const setsB = getSetWeights(B.games.map(g => ({ ...g, pts: (g.pts || []).map(([a, b]) => [b, a]) })));
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

    // --- Red Flags анализ ---
    let redFlags = null;
    try {
      const matchesA = convertToRedFlagsFormat(A.games, A.player);
      const matchesB = convertToRedFlagsFormat(B.games, B.player);
      redFlags = redFlagsSimple(matchesA, matchesB, A.player, B.player);
    } catch (error) {
      console.warn("Ошибка в red flags анализе:", error);
    }

    return {
      success: true,
      data: {
        playerA: {
          name: A.player,
          strength: (50 + 50 * sA).toFixed(1),
          probability: (probFinal * 100).toFixed(1),
          h2h: `${h2hData.wA}-${h2hData.wB}`,
          stability: calcStability(A.games),
          s2: calcBaseS(A.games, 2).toFixed(3),
          s5: calcBaseS(A.games, 5).toFixed(3),
          dryWins: calcDryGames(A.games).wins,
          dryLosses: calcDryGames(A.games).losses,
          h2hDryLoss: h2hData.dryWinsB,
          setWins: calcSetWins(A.games),
          visualization: createMatchVisualization(A.games),
          ku_tb35: KU_tb35_playerA,
          ku_tb35_mod: KUmodPlayerA,
        },
        playerB: {
          name: B.player,
          strength: (50 + 50 * sB).toFixed(1),
          probability: ((1 - probFinal) * 100).toFixed(1),
          h2h: `${h2hData.wB}-${h2hData.wA}`,
          stability: calcStability(B.games),
          s2: calcBaseS(B.games, 2).toFixed(3),
          s5: calcBaseS(B.games, 5).toFixed(3),
          dryWins: calcDryGames(B.games).wins,
          dryLosses: calcDryGames(B.games).losses,
          h2hDryLoss: h2hData.dryWinsA,
          setWins: calcSetWins(B.games),
          visualization: createMatchVisualization(B.games),
          ku_tb35: KU_tb35_playerB,
          ku_tb35_mod: KUmodPlayerB,
        },
        confidence: getConfidence(probFinal, 1 - probFinal, vA, vB, h2hData.total),
        favorite: probFinal > 0.5 ? A.player : B.player,
        predictedScores,
        btScoreProbs,
        bt_ratings: { rA, rB },
        bt_pSetA,
        bt_pSetB,
        setsDist: {},
        setsOver35: {},
        h2h: {
          total: h2hData.total,
          visualization: probFinal > 0.5
            ? createMatchVisualization(h2hData.h2hGames)
            : createMatchVisualization(h2hData.h2hGames.map(g => ({ win: 1 - g.win }))),
          setWins: h2hData.h2hSetWins
        },
        formChartData: {},
        h2hChartData: {},
        // Red Flags данные
        redFlags: redFlags ? {
          skip: redFlags.skip,
          riskScore: redFlags.riskScore,
          flags: redFlags.flags,
          details: redFlags.details
        } : null,
      },
    };
  }

  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "analyze") {
      sendResponse(performAnalysis());
      return true; // удерживаем порт открытым
    }
  });

})();
