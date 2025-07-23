(() => {
  const cfg = { a1: 1, a2: 0.5, a3: 0.3, a4: 0.2, tau: 0.03, fMax: 5, k: 5, h2hK: 0.15 };
  const now = new Date();

  function parseGame(row, header) {
    const dateText = row.querySelector("td.date")?.textContent.trim();
    if (!dateText) return null;
    const [d, m, y] = dateText.split(".").map(Number);
    const dt = new Date(2000 + y, m - 1, d);
    const diffDays = Math.floor((now - dt) / 86400000);
    const info = row.nextElementSibling;
    const playersText = info.querySelector("td.ev-mstat-ev")?.textContent.trim();
    const scoreText = info.querySelector("td.score")?.textContent.trim();
    if (!playersText || !scoreText) return null;
    const match = scoreText.match(/^(\d+):(\d+)\s*\(([^)]+)\)/);
    if (!match) return null;
    const [, s1, s2, pts] = match;
    const sets1 = +s1, sets2 = +s2;
    let pairs = pts.split(",").map(p => p.trim().split(":").map(Number));
    const isHome = playersText.indexOf(header) < playersText.indexOf(" - ");
    
    if (!isHome) {
      pairs = pairs.map(([a, b]) => [b, a]);
    }
    
    const playerSets = isHome ? sets1 : sets2;
    const oppSets = isHome ? sets2 : sets1;
    const total1 = pairs.reduce((a, [x]) => a + x, 0);
    const total2 = pairs.reduce((a, [, y]) => a + y, 0);
    const playerPoints = total1;
    const oppPoints = total2;
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
    return { win, playerSets, oppSets, pts: pairs, handicap, w, Mi, diffDays, isDryWin, isDryLoss, date: dt };
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
    const mean = games.reduce((s, g) => s + g.handicap, 0) / games.length;
    const v = games.reduce((s, g) => s + (g.handicap - mean) ** 2, 0) / games.length;
    return Math.sqrt(v);
  }

  function strengthAdj(games) {
    return calcBaseS(games) + 0.25 * calcForaBalance(games);
  }

  function calcStability(v) {
    return Math.round(Math.max(0, 100 - v * 8));
  }

  function calcDryGames(games) {
    return { wins: games.filter(g => g.isDryWin).length, losses: games.filter(g => g.isDryLoss).length };
  }

  function calcSetWins(games) {
    const wins = { set1: [0, 0], set2: [0, 0], set3: [0, 0], set4: [0, 0], set5: [0, 0] };
    const total = { set1: 0, set2: 0, set3: 0, set4: 0, set5: 0 };

    games.forEach(g => {
      g.pts.forEach((pair, idx) => {
        if (idx >= 5) return;
        const key = `set${idx + 1}`;
        const [a, b] = pair;
        if (a > b) wins[key][0] += 1;
        else wins[key][1] += 1;
        total[key] += 1;
      });
    });

    const out = {};
    Object.keys(wins).forEach(key => {
      out[key] = [
        `${wins[key][0]}/${total[key]}`,
        `${wins[key][1]}/${total[key]}`
      ];
    });
    return out;
  }

  function createMatchVisualization(games) {
    return games.slice(0, 10).map(g => g.win ? '◯' : '⚫').join(' ');
  }

  function parseH2H(A, B) {
    const tbl = [...document.querySelectorAll("table")].find(t =>
      t.querySelector("tr:first-child td")?.textContent.includes("Очные встречи")
    );
    if (!tbl) return { wA: 0, wB: 0, total: 0, wAweighted: 0, sumW: 0, dryWinsA: 0, dryWinsB: 0, h2hGames: [] };
    const rows = Array.from(tbl.querySelectorAll("tr")).slice(2);
    let wA = 0, wB = 0, wAweighted = 0, sumW = 0, dryA = 0, dryB = 0;
    const h2hGames = [];
    rows.forEach(r => {
      const score = r.querySelector("td.score")?.textContent.trim();
      const playersTxt = r.querySelector("td.descr")?.textContent.trim();
      const dateTxt = r.querySelector("td.date")?.textContent.trim();
      if (!score || !playersTxt || !dateTxt) return;
      const m = score.match(/^(\d+):(\d+)/);
      if (!m) return;
      const [s1, s2] = m.slice(1).map(Number);
      const [d, mth, yr] = dateTxt.split(".").map(Number);
      const dt = new Date(2000 + yr, mth - 1, d);
      const diff = Math.floor((now - dt) / 86400000);
      const w = Math.exp(-cfg.tau * diff);
      const home = playersTxt.indexOf(A) < playersTxt.indexOf(" - ");
      const aWon = home ? s1 > s2 : s2 > s1;
      const isDryA = aWon && ((home && s2 === 0) || (!home && s1 === 0));
      const isDryB = !aWon && ((home && s1 === 0) || (!home && s2 === 0));
      h2hGames.push({ win: aWon ? 1 : 0, isDryWin: isDryA, isDryLoss: isDryB, date: dt });
      if (aWon) { wA++; wAweighted += w; if (isDryA) dryA++; }
      else { wB++; if (isDryB) dryB++; }
      sumW += w;
    });
    h2hGames.sort((a, b) => b.date - a.date);
    return { wA, wB, total: wA + wB, wAweighted, sumW, dryWinsA: dryA, dryWinsB: dryB, h2hGames: h2hGames.slice(0, 10) };
  }

  function getConfidence(pA, pB, vA, vB, hTot) {
    const maxP = Math.max(pA, pB), minV = Math.min(vA, vB);
    if (maxP > 0.75 && minV < 8 && hTot >= 3) return "🟢";
    if (maxP > 0.65 && minV < 12) return "🟡";
    return "🔴";
  }

  function getAdvice(pA, pB, vA, vB, nA, nB, h2h) {
    if (Math.max(vA, vB) > 15) return "Высокая волатильность — смотрите тоталы или точный счёт.";
    if (Math.abs(pA - pB) < 0.15) return "Шансы равны — лучше тотал.";
    if (Math.abs(nA - nB) > 20 && h2h.total >= 5) return "Явный фаворит подтверждён H2H.";
    if (h2h.total < 3) return "Мало личных встреч — осторожнее.";
    return "Умеренная уверенность — стандартные ставки.";
  }

  function logStatistics(playerData) {
    console.group(`📊 Статистика игрока: ${playerData.player}`);
    
    const games = Array.isArray(playerData.games) ? playerData.games : [];
    console.log(`🎮 Всего матчей: ${games.length}`);
    console.log(`✅ Побед: ${games.filter(g => g.win).length}`);
    console.log(`❌ Поражений: ${games.filter(g => !g.win).length}`);
    
    console.group("📋 Детали матчей:");
    games.forEach((game, index) => {
      console.log(`Матч ${index + 1}:`, {
        дата: game.date.toLocaleDateString('ru-RU'),
        результат: game.win ? 'Победа' : 'Поражение',
        счетПоСетам: `${game.playerSets}:${game.oppSets}`,
        очкиПоСетам: game.pts.map(([a, b]) => `${a}:${b}`).join(', '),
        гандикап: game.handicap,
        дниНазад: game.diffDays
      });
    });
    console.groupEnd();
    
    const setWins = calcSetWins(games);
    console.group("🎯 Победы в сетах:");
    Object.entries(setWins).forEach(([setNum, [player, opp]]) => {
      console.log(`${setNum}: Игрок ${player}, Соперник ${opp}`);
    });
    console.groupEnd();
    
    const dryGames = calcDryGames(games);
    console.log(`🏆 Сухие победы: ${dryGames.wins}`);
    console.log(`💀 Сухие поражения: ${dryGames.losses}`);
    
    const baseStrength = calcBaseS(games);
    const variance = calcForaVariance(games);
    const stability = calcStability(variance);
    
    console.log(`💪 Базовая сила: ${baseStrength.toFixed(3)}`);
    console.log(`📈 Стабильность: ${stability}%`);
    console.log(`📊 Дисперсия форы: ${variance.toFixed(2)}`);
    
    console.groupEnd();
  }

  function performAnalysis() {
    const tables = document.querySelectorAll('table.ev-mstat-tbl');
    if (tables.length < 2) {
      console.error("❌ Недостаточно таблиц для анализа");
      return { error: "Insufficient data tables" };
    }

    const A = parseSection(tables[0]);
    const B = parseSection(tables[1]);
    
    const gamesA = Array.isArray(A.games) ? A.games : [];
    const gamesB = Array.isArray(B.games) ? B.games : [];
    
    console.clear();
    console.log("🔍 НАЧАЛО АНАЛИЗА СТАТИСТИКИ");
    console.log("=".repeat(50));
    
    logStatistics(A);
    logStatistics(B);

    if (!gamesA.length || !gamesB.length) {
      console.error("❌ Нет данных о матчах для одного из игроков");
      return { error: "No game data" };
    }

    let h2hData = [];
    try {
      h2hData = parseH2H(A.player, B.player);
    } catch (e) {
      console.warn("⚠️ Ошибка при поиске истории встреч:", e.message);
    }

    const sA = strengthAdj(gamesA), sB = strengthAdj(gamesB);
    const vA = calcForaVariance(gamesA), vB = calcForaVariance(gamesB);
    const stA = calcStability(vA), stB = calcStability(vB);
    
    console.group("🎯 ФИНАЛЬНЫЕ РАСЧЕТЫ");
    console.log(`Сила A: ${sA.toFixed(3)}, Сила B: ${sB.toFixed(3)}`);
    console.log(`Стабильность A: ${stA}%, Стабильность B: ${stB}%`);
    console.groupEnd();

    let h2hAdj = 0;
    if (h2hData.total >= 3) {
      const h2hWins = h2hData.wA;
      const h2hRate = h2hWins / h2hData.total;
      h2hAdj = cfg.h2hK * (h2hRate - 0.5);
      console.log(`📊 H2H корректировка: ${h2hAdj.toFixed(3)} (на основе ${h2hData.total} встреч)`);
    }

    const diff = sA - sB + h2hAdj;
    const prob = 1 / (1 + Math.exp(-cfg.k * diff));
    
    console.log(`🎲 Итоговая вероятность победы A: ${(prob * 100).toFixed(1)}%`);
    console.log("=".repeat(50));

    return {
      playerA: { 
        name: A.player, 
        strength: sA, 
        stability: stA, 
        games: gamesA.length,
        setWins: calcSetWins(gamesA),
        dryGames: calcDryGames(gamesA),
        visualization: createMatchVisualization(gamesA)
      },
      playerB: { 
        name: B.player, 
        strength: sB, 
        stability: stB, 
        games: gamesB.length,
        setWins: calcSetWins(gamesB),
        dryGames: calcDryGames(gamesB),
        visualization: createMatchVisualization(gamesB)
      },
      prediction: { probability: prob, h2hMatches: h2hData.total }
    };
  }

  chrome.runtime.onMessage.addListener((req, sender, send) => {
    if (req.action === "analyze") {
      try { send({ success: true, data: performAnalysis() }); }
      catch (e) { send({ success: false, error: e.message }); }
      return true;
    }
  });
})();
