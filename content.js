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
    const res = [
      { win: 0, lose: 0, total: 0 },
      { win: 0, lose: 0, total: 0 },
      { win: 0, lose: 0, total: 0 },
      { win: 0, lose: 0, total: 0 },
      { win: 0, lose: 0, total: 0 }
    ];
    games.forEach(game => {
      game.pts.forEach(([a, b], idx) => {
        if (a > b)      res[idx].win++;
        else if (a < b) res[idx].lose++;
        res[idx].total++;
      });
    });
    const out = {};
    for (let i = 0; i < 5; ++i) {
      out[`set${i+1}`] = [
        `${res[i].win}/${res[i].total}`,
        `${res[i].lose}/${res[i].total}`
      ];
    }
    return out;
  }

  function createMatchVisualization(games) {
    return games.slice(0, 10).map(g => g.win ? '🟢' : '🔴').join(' ');
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
    // Пустая функция для сохранения количества строк
  }

  function performAnalysis() {
    const tables = document.querySelectorAll('table.ev-mstat-tbl');
    if (tables.length < 2) {
      return { success: false, error: "Insufficient data tables" };
    }

    const A = parseSection(tables[0]);
    const B = parseSection(tables[1]);
    
    const gamesA = Array.isArray(A.games) ? A.games : [];
    const gamesB = Array.isArray(B.games) ? B.games : [];
    
    if (!gamesA.length || !gamesB.length) {
      return { success: false, error: "No game data" };
    }

    let h2hData = parseH2H(A.player, B.player);

    const sA = strengthAdj(gamesA), sB = strengthAdj(gamesB);
    const vA = calcForaVariance(gamesA), vB = calcForaVariance(gamesB);
    const stA = calcStability(vA), stB = calcStability(vB);
    
    let h2hAdj = 0;
    if (h2hData.total >= 3) {
      const h2hWins = h2hData.wA;
      const h2hRate = h2hWins / h2hData.total;
      h2hAdj = cfg.h2hK * (h2hRate - 0.5);
    }

    const diff = sA - sB + h2hAdj;
    const prob = 1 / (1 + Math.exp(-cfg.k * diff));
    
    // Структура данных для popup
    return { success: true, data: {
      playerA: {
        name: A.player,
        strength: (50 + 50 * sA).toFixed(1),
        probability: (prob * 100).toFixed(1),
        h2h: `${h2hData.wA}-${h2hData.wB}`,
        stability: stA,
        s2: calcBaseS(gamesA, 2).toFixed(3),
        s5: calcBaseS(gamesA).toFixed(3),
        dryWins: calcDryGames(gamesA).wins,
        dryLosses: calcDryGames(gamesA).losses,
        h2hDryLoss: h2hData.dryWinsA,
        setWins: calcSetWins(gamesA),
        visualization: createMatchVisualization(gamesA)
      },
      playerB: {
        name: B.player,
        strength: (50 + 50 * sB).toFixed(1),
        probability: ((1 - prob) * 100).toFixed(1),
        h2h: `${h2hData.wB}-${h2hData.wA}`,
        stability: stB,
        s2: calcBaseS(gamesB, 2).toFixed(3),
        s5: calcBaseS(gamesB).toFixed(3),
        dryWins: calcDryGames(gamesB).wins,
        dryLosses: calcDryGames(gamesB).losses,
        h2hDryLoss: h2hData.dryWinsB,
        setWins: calcSetWins(gamesB),
        visualization: createMatchVisualization(gamesB)
      },
      confidence: getConfidence(prob, 1 - prob, vA, vB, h2hData.total),
      favorite: prob > 0.5 ? A.player : B.player,
      h2h: {
        total: h2hData.total,
        winsFav: prob > 0.5 ? h2hData.wA : h2hData.wB,
        winsUnd: prob > 0.5 ? h2hData.wB : h2hData.wA,
        dryFav: prob > 0.5 ? h2hData.dryWinsA : h2hData.dryWinsB,
        dryUnd: prob > 0.5 ? h2hData.dryWinsB : h2hData.dryWinsA,
        visualization: prob > 0.5 ? createMatchVisualization(h2hData.h2hGames) : createMatchVisualization(h2hData.h2hGames.map(g => ({win: 1 - g.win}))),
      },
      advice: getAdvice(prob, 1 - prob, vA, vB, (50 + 50 * sA), (50 + 50 * sB), h2hData)
    } };
  }

  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "analyze") {
      sendResponse(performAnalysis());
      return true;
    }
  });
})();
