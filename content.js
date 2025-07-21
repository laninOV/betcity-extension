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
    const pairs = pts.split(",").map(p => p.trim().split(":").map(Number));
    const isHome = playersText.indexOf(header) < playersText.indexOf(" - ");
    const playerSets = isHome ? sets1 : sets2;
    const oppSets = isHome ? sets2 : sets1;
    const total1 = pairs.reduce((a, [x]) => a + x, 0);
    const total2 = pairs.reduce((a, [, y]) => a + y, 0);
    const playerPoints = isHome ? total1 : total2;
    const oppPoints = isHome ? total2 : total1;
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
    const out = { set1: [0, 0], set2: [0, 0], set3: [0, 0], set4: [0, 0], set5: [0, 0] };
    games.forEach(g => {
      g.pts.forEach((pair, idx) => {
        if (idx >= 5) return;
        const [a, b] = pair;
        if (a > b) out[`set${idx+1}`][0]++; else out[`set${idx+1}`][1]++;
      });
    });
    Object.keys(out).forEach(k => { out[k] = out[k].map(cnt => `${cnt}/${games.length}`); });
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
  
  function performAnalysis() {
    const tables = document.querySelectorAll("table.ev-mstat-tbl");
    if (tables.length < 2) throw Error("Не найдены две таблицы «Последние игры»");
    const A = parseSection(tables[0]), B = parseSection(tables[1]);
    if (!A.games.length || !B.games.length) throw Error("Нет данных игр");
    const Sadj1 = strengthAdj(A.games), Sadj2 = strengthAdj(B.games);
    const h2h = parseH2H(A.player, B.player);
    const hF = h2h.sumW ? cfg.h2hK * (2 * (h2h.wAweighted / h2h.sumW) - 1) : 0;
    const SfA = 0.7 * Sadj1 + hF, SfB = 0.7 * Sadj2 - hF;
    const normA = 50 + 50 * SfA, normB = 50 + 50 * SfB;
    let pA = 1 / (1 + Math.exp(-cfg.k * (SfA - SfB))), pB = 1 - pA;
    const vA = calcForaVariance(A.games), vB = calcForaVariance(B.games);
    if (vA > 10 || vB > 10) { pA = 0.35 + 0.3 * (pA - 0.5); pB = 1 - pA; }
    const dryA = calcDryGames(A.games), dryB = calcDryGames(B.games);
    const setWinsA = calcSetWins(A.games), setWinsB = calcSetWins(B.games);
    const setWins = {};
    ["set1", "set2", "set3", "set4", "set5"].forEach(k => {
      setWins[k] = [setWinsA[k][0], setWinsB[k][0]];
    });
    const matchVisualizationA = createMatchVisualization(A.games);
    const matchVisualizationB = createMatchVisualization(B.games);
    const h2hVisualization = h2h.h2hGames.length ? h2h.h2hGames.map(g => g.win ? '◯' : '⚫').join(' ') : '';
    const advice = getAdvice(pA, pB, vA, vB, normA, normB, h2h);
    return {
      confidence: getConfidence(pA, pB, vA, vB, h2h.total),
      favorite: pA > pB ? A.player : B.player,
      players: [
        { name: A.player, strength: normA.toFixed(1), probability: (pA * 100).toFixed(1), h2h: `${h2h.wA}-${h2h.wB}`, stability: `${calcStability(vA)}/100` },
        { name: B.player, strength: normB.toFixed(1), probability: (pB * 100).toFixed(1), h2h: `${h2h.wB}-${h2h.wA}`, stability: `${calcStability(vB)}/100` }
      ],
      strengthData: { s2: [calcBaseS(A.games, 2).toFixed(3), calcBaseS(B.games, 2).toFixed(3)], s5: [calcBaseS(A.games).toFixed(3), calcBaseS(B.games).toFixed(3)] },
      setWins,
      dryGames: { player1: dryA, player2: dryB },
      matchVisualizations: { player1: matchVisualizationA, player2: matchVisualizationB, h2h: h2hVisualization },
      additionalInfo: {
        "H2H всего встреч": h2h.total.toString(),
        "Процент побед A в H2H": h2h.total ? ((h2h.wA / h2h.total) * 100).toFixed(0) + "%" : "–",
        "Процент побед B в H2H": h2h.total ? ((h2h.wB / h2h.total) * 100).toFixed(0) + "%" : "–",
        "H2H сухие победы A": h2h.dryWinsA.toString(),
        "H2H сухие победы B": h2h.dryWinsB.toString()
      },
      advice
    };
  }
  
  chrome.runtime.onMessage.addListener((req, sender, send) => {
    if (req.action === "analyze") {
      try { send({ success: true, data: performAnalysis() }); }
      catch (e) { send({ success: false, error: e.message }); }
    }
    return true;
  });
})();
