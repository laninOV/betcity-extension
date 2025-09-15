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
    
    // Преобразуем данные в формат setWins с дополнительной детализацией
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
      ),
      // Дополнительная детализация для каждого сета
      detailed: {
        playerA: h2hSetData.playerA,
        playerB: h2hSetData.playerB,
        summary: {
          totalSets: Object.values(h2hSetData.playerA).reduce((sum, data) => sum + data.total, 0),
          playerAWins: Object.values(h2hSetData.playerA).reduce((sum, data) => sum + data.win, 0),
          playerBWins: Object.values(h2hSetData.playerB).reduce((sum, data) => sum + data.win, 0)
        }
      }
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

  // --- Базовое вычисление силы (оригинальная формула) ---
  function calcBaseS(games, limit = null) {
    const arr = limit ? games.slice(0, limit) : games;
    if (!arr.length) return 0;
    
    let num = 0, den = 0;
    arr.forEach(g => {
      num += g.w * g.Mi;
      den += g.w;
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

  // --- Модернизированная скорректированная сила ---
  function strengthAdj(games) {
    if (!games.length) return 0;
    
    const baseStrength = calcBaseS(games);
    const foraBalance = calcForaBalance(games);
    
    // Фактор последних результатов (форма)
    const recentGames = games.slice(0, Math.min(3, games.length));
    const recentForm = recentGames.length > 0 ? 
      recentGames.reduce((sum, g) => sum + (g.win ? 1 : -0.5), 0) / recentGames.length : 0;
    
    // Фактор стабильности результатов
    const results = games.slice(0, 5).map(g => g.win ? 1 : 0);
    const winRate = results.length > 0 ? results.reduce((a, b) => a + b, 0) / results.length : 0.5;
    const variance = results.length > 1 ? 
      results.reduce((sum, r) => sum + Math.pow(r - winRate, 2), 0) / results.length : 0;
    const consistencyFactor = Math.max(0, 1 - variance * 2); // 0-1, где 1 = очень стабильный
    
    // Фактор качества игры (средний handicap в победах)
    const wins = games.filter(g => g.win);
    const qualityFactor = wins.length > 0 ? 
      Math.tanh(wins.reduce((sum, g) => sum + g.handicap, 0) / (wins.length * cfg.fMax)) : 0;
    
    // Фактор опыта против сильных соперников
    const avgOppStrength = games.length > 0 ? 
      games.reduce((sum, g) => sum + Math.abs(g.handicap), 0) / games.length : 0;
    const experienceFactor = Math.tanh(avgOppStrength / cfg.fMax) * 0.1;
    
    // Комбинированная сила с адаптивными весами
    const adjustedStrength = baseStrength + 
      0.2 * foraBalance +           // Баланс фор
      0.15 * recentForm +           // Текущая форма
      0.1 * consistencyFactor +     // Стабильность
      0.1 * qualityFactor +         // Качество игры
      experienceFactor;             // Опыт против сильных
    
    return adjustedStrength;
  }

  // --- Улучшенная стабильность ---
  function calcStability(games) {
    if (!games.length) return 0;
    
    // 1. Стабильность результатов с учетом качества побед
    const results = games.map(g => {
      if (g.win) {
        // Качественные победы дают больше очков стабильности
        if (g.playerSets === 3 && g.oppSets === 0) return 1.0;
        if (g.playerSets === 3 && g.oppSets === 1) return 0.8;
        if (g.playerSets === 3 && g.oppSets === 2) return 0.6;
      } else {
        // Близкие поражения менее негативны для стабильности
        if (g.oppSets === 3 && g.playerSets === 2) return -0.3;
        if (g.oppSets === 3 && g.playerSets === 1) return -0.6;
        if (g.oppSets === 3 && g.playerSets === 0) return -1.0;
      }
      return 0;
    });
    
    const avgResult = results.reduce((a, b) => a + b, 0) / results.length;
    const resultVariance = results.reduce((sum, r) => sum + Math.pow(r - avgResult, 2), 0) / results.length;
    const resultStability = Math.max(0, 100 - Math.sqrt(resultVariance) * 50);
    
    // 2. Стабильность по качеству игры (handicap)
    const handicaps = games.map(g => g.handicap);
    const meanHandicap = handicaps.reduce((a, b) => a + b, 0) / handicaps.length;
    const handicapVariance = handicaps.reduce((sum, h) => sum + Math.pow(h - meanHandicap, 2), 0) / handicaps.length;
    const handicapStability = Math.max(0, 100 - Math.sqrt(handicapVariance) * 6);
    
    // 3. Стабильность формы (последние vs общие результаты)
    const recentGames = games.slice(0, Math.min(4, games.length));
    const recentAvg = recentGames.length > 0 ? 
      recentGames.reduce((sum, g) => sum + (g.win ? 1 : 0), 0) / recentGames.length : 0.5;
    const overallWinRate = games.filter(g => g.win).length / games.length;
    const formStability = Math.max(0, 100 - Math.abs(recentAvg - overallWinRate) * 200);
    
    // 4. Стабильность по сетам (насколько стабильно выигрывает/проигрывает сеты)
    let setStability = 50; // базовое значение
    if (games.length >= 3) {
      const setResults = [];
      games.slice(0, 5).forEach(g => {
        if (g.pts && g.pts.length > 0) {
          g.pts.forEach(([a, b]) => {
            setResults.push(a > b ? 1 : 0);
          });
        }
      });
      
      if (setResults.length >= 5) {
        const setWinRate = setResults.reduce((a, b) => a + b, 0) / setResults.length;
        const setVariance = setResults.reduce((sum, r) => sum + Math.pow(r - setWinRate, 2), 0) / setResults.length;
        setStability = Math.max(0, 100 - Math.sqrt(setVariance) * 100);
      }
    }
    
    // Комбинированная стабильность с адаптивными весами
    const weights = {
      result: 0.35,
      handicap: 0.25, 
      form: 0.25,
      sets: 0.15
    };
    
    const combined = 
      resultStability * weights.result +
      handicapStability * weights.handicap +
      formStability * weights.form +
      setStability * weights.sets;
    
    return Math.round(Math.max(0, Math.min(100, combined)));
  }

  // --- Подсчёт сухих побед/поражений ---
  function calcDryGames(games) {
    return {
      wins: games.filter(g => g.isDryWin).length,
      losses: games.filter(g => g.isDryLoss).length,
    };
  }

  // --- Подсчет матчей за день с результатами ---
  function calcMatchesToday(games) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayGames = games.filter(game => {
      const gameDate = new Date(game.date);
      gameDate.setHours(0, 0, 0, 0);
      return gameDate.getTime() === today.getTime();
    });
    
    const wins = todayGames.filter(game => game.win).length;
    const losses = todayGames.length - wins;
    
    return {
      total: todayGames.length,
      wins: wins,
      losses: losses
    };
  }

  // --- Система очков за победы/поражения ---
  function calculateScorePoints(games) {
    let totalPoints = 0;
    let matchesAnalyzed = 0;
    
    // Берем только последние 5 матчей
    const recentGames = games.slice(0, 5);
    
    recentGames.forEach(game => {
      if (!game.pts || !Array.isArray(game.pts)) return;
      
      const playerSets = game.playerSets || 0;
      const oppSets = game.oppSets || 0;
      const isWin = game.win === 1;
      
      let points = 0;
      if (isWin) {
        // Победы: 3-0 = 3pts, 3-1 = 2pts, 3-2 = 1pt
        if (playerSets === 3 && oppSets === 0) points = 3;
        else if (playerSets === 3 && oppSets === 1) points = 2;
        else if (playerSets === 3 && oppSets === 2) points = 1;
      } else {
        // Поражения: 0-3 = -3pts, 1-3 = -2pts, 2-3 = -1pt
        if (oppSets === 3 && playerSets === 0) points = -3;
        else if (oppSets === 3 && playerSets === 1) points = -2;
        else if (oppSets === 3 && playerSets === 2) points = -1;
      }
      
      totalPoints += points;
      matchesAnalyzed++;
    });
    
    return {
      totalPoints,
      matchesAnalyzed,
      averagePoints: matchesAnalyzed > 0 ? (totalPoints / matchesAnalyzed).toFixed(2) : 0
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

  // --- Конвертация данных для новой BT модели ---
  function convertGamesToBTFormat(games, playerName, opponentName = "Opponent") {
    return games.map(game => ({
      date: game.date || new Date(),
      home: playerName,
      away: opponentName,
      sets: game.pts || []
    }));
  }

  function convertH2HToBTFormat(h2hGames, playerA, playerB) {
    return h2hGames.map(game => ({
      date: game.date || new Date(),
      home: playerA,
      away: playerB,
      sets: game.pts || []
    }));
  }

  // --- Утилиты для новой BT-модели ---
  const clamp01 = x => Math.min(1 - 1e-12, Math.max(1e-12, x));
  const logit = p => Math.log(p / (1 - p));
  const invLogit = z => 1 / (1 + Math.exp(-z));

  function timeWeight(deltaDays, halfLife = 21) { 
    return halfLife > 0 ? Math.exp(-deltaDays / halfLife) : 1; 
  }

  function marginBump(diff, beta = 0.15) { 
    const m = Math.max(0, Math.min(0.5, (diff - 2) / 9)); 
    return 1 + beta * m; 
  }

  // --- Построить локальный граф сетов ---
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

  // --- MM-итерации BT ---
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

  // --- Bo5: распределение и вероятность матча ---
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

  // --- Основной расчёт для пары A–B ---
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

  // --- Вероятности BT (обновленная функция) ---
  function calcBTScoreProbs(btResult) {
    return btResult.scores.map(item => ({
      score: item.score,
      probability: item.probability,
      label: item.pct
    }));
  }

  // --- Индикатор уверенности ---
  function getConfidence(pA, pB, vA, vB, hTot) {
    const maxP = Math.max(pA, pB);
    if (maxP > 0.75 && Math.min(vA, vB) < 8 && hTot >= 3) return "🟢";
    if (maxP > 0.65 && Math.min(vA, vB) < 12) return "🟡";
    return "🔴";
  }


  // --- Улучшенное отображение силы игрока ---
  function calculateDisplayStrength(rawStrength) {
    // Преобразуем сырую силу (-∞, +∞) в понятный рейтинг (0-100)
    // Используем сигмоидальную функцию для более реалистичного масштабирования
    
    // Нормализация: большинство игроков должны быть в диапазоне 30-70
    const normalized = 50 + 25 * Math.tanh(rawStrength * 2);
    
    // Дополнительные корректировки для крайних значений
    let adjusted = normalized;
    
    if (rawStrength > 0.5) {
      // Очень сильные игроки: 75-95
      adjusted = 75 + 20 * Math.min(1, (rawStrength - 0.5) / 0.5);
    } else if (rawStrength < -0.5) {
      // Очень слабые игроки: 5-25
      adjusted = 25 - 20 * Math.min(1, Math.abs(rawStrength + 0.5) / 0.5);
    }
    
    return Math.max(5, Math.min(95, adjusted));
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

    // Новые метрики
    const matchesTodayA = calcMatchesToday(A.games);
    const matchesTodayB = calcMatchesToday(B.games);
    const scorePointsA = calculateScorePoints(A.games);
    const scorePointsB = calculateScorePoints(B.games);

    // Улучшенный расчет вероятности с учетом множественных факторов
    const stabWeight = cfg.stabilityWeight || 0.6;
    
    // Более сложные факторы стабильности
    const stabA = calcStability(A.games) / 100; // 0-1
    const stabB = calcStability(B.games) / 100; // 0-1
    const stabFactorA = 0.7 + 0.3 * stabA; // 0.7-1.0
    const stabFactorB = 0.7 + 0.3 * stabB; // 0.7-1.0
    
    // Фактор формы (последние 3 матча)
    const recentA = A.games.slice(0, 3);
    const recentB = B.games.slice(0, 3);
    const formA = recentA.length > 0 ? recentA.filter(g => g.win).length / recentA.length : 0.5;
    const formB = recentB.length > 0 ? recentB.filter(g => g.win).length / recentB.length : 0.5;
    const formFactor = Math.tanh((formA - formB) * 2) * 0.1; // -0.1 до +0.1
    
    // Фактор качества побед (средний handicap в победах)
    const winsA = A.games.filter(g => g.win);
    const winsB = B.games.filter(g => g.win);
    const qualityA = winsA.length > 0 ? winsA.reduce((sum, g) => sum + g.handicap, 0) / winsA.length : 0;
    const qualityB = winsB.length > 0 ? winsB.reduce((sum, g) => sum + g.handicap, 0) / winsB.length : 0;
    const qualityFactor = Math.tanh((qualityA - qualityB) / cfg.fMax) * 0.08;
    
    // Адаптивный коэффициент k с учетом стабильности
    const avgStability = (stabA + stabB) / 2;
    const kAdj = cfg.k * (0.8 + 0.4 * avgStability); // Более стабильные игроки = более предсказуемый результат
    
    // Основная разность сил с учетом стабильности
    const adjustedDiff = (sA * stabFactorA - sB * stabFactorB) + formFactor + qualityFactor;
    
    // Базовая вероятность
    let prob = 1 / (1 + Math.exp(-kAdj * adjustedDiff));
    
    // Адаптивное сглаживание в зависимости от количества данных
    const dataQualityA = Math.min(1, A.games.length / 8); // 0-1
    const dataQualityB = Math.min(1, B.games.length / 8); // 0-1
    const avgDataQuality = (dataQualityA + dataQualityB) / 2;
    
    // Меньше данных = больше сглаживания
    const smoothing = 0.15 * (1 - avgDataQuality);
    prob = Math.min(0.90, Math.max(0.10, prob));
    const probFinal = prob * (1 - smoothing) + 0.5 * smoothing;

    // Улучшенный комбинированный расчет с адаптивными весами
    const R_h2h = calcRh2h(A.player, B.player);
    
    // Более точный расчет формы с учетом качества игры
    const R_form = (() => {
      const recentA = A.games.slice(0, 5);
      const recentB = B.games.slice(0, 5);
      
      if (recentA.length === 0 || recentB.length === 0) return 0.5;
      
      // Взвешенные очки с учетом времени и качества
      let pointsA = 0, pointsB = 0, totalA = 0, totalB = 0;
      
      recentA.forEach((g, i) => {
        const weight = Math.exp(-0.1 * i); // Более свежие матчи важнее
        const qualityWeight = 1 + (g.win ? 0.2 : -0.1); // Бонус за победы
        pointsA += g.playerPoints * weight * qualityWeight;
        totalA += (g.playerPoints + g.oppPoints) * weight * qualityWeight;
      });
      
      recentB.forEach((g, i) => {
        const weight = Math.exp(-0.1 * i);
        const qualityWeight = 1 + (g.win ? 0.2 : -0.1);
        pointsB += g.playerPoints * weight * qualityWeight;
        totalB += (g.playerPoints + g.oppPoints) * weight * qualityWeight;
      });
      
      const ratioA = totalA > 0 ? pointsA / totalA : 0.5;
      const ratioB = totalB > 0 ? pointsB / totalB : 0.5;
      
      return (ratioA + ratioB) > 0 ? ratioA / (ratioA + ratioB) : 0.5;
    })();
    
    // Адаптивные веса в зависимости от количества H2H данных
    const h2hWeight = h2hData.total >= 3 ? 0.7 : h2hData.total >= 1 ? 0.4 : 0.1;
    const formWeight = 1 - h2hWeight;
    
    const pNew = h2hWeight * R_h2h + formWeight * R_form;

    const predictedScores = predictAllScores(pNew);

    // Новая Bradley-Terry модель с улучшенным алгоритмом
    let btScoreProbs = [];
    let btResult = null;
    let bettingStrategy = null;
    let bt_pSetA = 0.5, bt_pSetB = 0.5;
    
    try {
      // Конвертируем данные в формат новой BT модели
      const last5A = convertGamesToBTFormat(A.games.slice(0, 5), A.player, "Opponent");
      const last5B = convertGamesToBTFormat(B.games.slice(0, 5), B.player, "Opponent");
      const h2hBT = h2hData.h2hGames ? convertH2HToBTFormat(h2hData.h2hGames, A.player, B.player) : [];
      
      console.log(`Bradley-Terry: Используем ${last5A.length} матчей игрока A, ${last5B.length} матчей игрока B, ${h2hBT.length} H2H матчей`);
      
      // Применяем новый алгоритм Bradley-Terry
      btResult = btWinner(last5A, last5B, h2hBT, A.player, B.player, {
        halfLife: 21,
        betaMargin: 0.15,
        lambdaMatch: 0.7,
        alphaPrior: 2.0,
        temperature: 1.2
      });
      
      // Применяем стратегию ставок
      bettingStrategy = btBettingStrategy(last5A, last5B, h2hBT, A.player, B.player, {
        halfLife: 21,
        betaMargin: 0.15,
        lambdaMatch: 0.7,
        alphaPrior: 2.0,
        temperature: 1.2
      });
      
      if (btResult && btResult.scores) {
        bt_pSetA = btResult.p_set || 0.5;
        bt_pSetB = 1 - bt_pSetA;
        btScoreProbs = calcBTScoreProbs(btResult);
        
        console.log(`Bradley-Terry: Фаворит ${btResult.favorite}, p_set=${bt_pSetA.toFixed(3)}, p_match=${btResult.p_match.toFixed(3)}`);
        console.log(`Bradley-Terry: Рейтинги rA=${btResult.ratings[A.player].toFixed(3)}, rB=${btResult.ratings[B.player].toFixed(3)}`);
      }
      
      if (bettingStrategy) {
        console.log(`Betting Strategy: ${bettingStrategy.recommendation}`);
        if (bettingStrategy.betting.bet) {
          console.log(`Betting Details: Tier ${bettingStrategy.betting.tier}, p_match=${(bettingStrategy.p_match * 100).toFixed(1)}%`);
        } else {
          console.log(`Skip Reason: ${bettingStrategy.betting.reason}`);
        }
      }
    } catch (error) {
      console.warn('Ошибка в новой Bradley-Terry модели:', error);
      // Fallback к базовым вероятностям
      btScoreProbs = [{
        score: "3:0", probability: 0.125, label: "12.5%"
      }, {
        score: "3:1", probability: 0.125, label: "12.5%"
      }, {
        score: "3:2", probability: 0.125, label: "12.5%"
      }, {
        score: "0:3", probability: 0.125, label: "12.5%"
      }, {
        score: "1:3", probability: 0.125, label: "12.5%"
      }, {
        score: "2:3", probability: 0.125, label: "12.5%"
      }];
    }

    const playerAMatchRawScores = A.games.map(g => g.rawScore).filter(Boolean);
    const playerBMatchRawScores = B.games.map(g => {
      if (!g.rawScore) return "";
      return g.rawScore.split(",").map(p => {
        const [a, b] = p.trim().split(":");
        return b + ":" + a;
      }).join(", ");
    }).filter(Boolean);


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
          strength: calculateDisplayStrength(sA).toFixed(1),
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
          // Новые метрики
          matchesToday: matchesTodayA,
          scorePoints: scorePointsA,
        },
        playerB: {
          name: B.player,
          strength: calculateDisplayStrength(sB).toFixed(1),
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
          // Новые метрики
          matchesToday: matchesTodayB,
          scorePoints: scorePointsB,
        },
        confidence: getConfidence(probFinal, 1 - probFinal, vA, vB, h2hData.total),
        favorite: probFinal > 0.5 ? A.player : B.player,
        predictedScores,
        btScoreProbs,
        bt_ratings: btResult ? btResult.ratings : { [A.player]: 1, [B.player]: 1 },
        bt_pSetA,
        bt_pSetB,
        bt_favorite: btResult ? btResult.favorite : null,
        bt_p_match: btResult ? btResult.p_match : 0.5,
        setsDist: {},
        h2h: {
          total: h2hData.total,
          visualization: probFinal > 0.5
            ? createMatchVisualization(h2hData.h2hGames || [])
            : createMatchVisualization((h2hData.h2hGames || []).map(g => ({ win: 1 - g.win }))),
          setWins: h2hData.h2hSetWins,
          h2hGames: h2hData.h2hGames || []
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
        // Betting Strategy данные
        bettingStrategy: bettingStrategy,
      },
    };
  }

  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "analyze") {
      try {
        const result = performAnalysis();
        sendResponse(result);
      } catch (error) {
        console.error('Content script error:', error);
        sendResponse({
          success: false,
          error: error.message || 'Ошибка анализа данных'
        });
      }
      return true; // удерживаем порт открытым
    }
  });

  // Проверяем, что скрипт загружен
  console.log('Tennis Analysis Pro content script loaded');

})();
