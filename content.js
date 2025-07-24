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
    if (!isHome) pairs = pairs.map(([a, b]) => [b, a]);
    const playerSets = isHome ? sets1 : sets2;
    const oppSets = isHome ? sets2 : sets1;
    const playerPoints = pairs.reduce((a, [x]) => a + x, 0);
    const oppPoints = pairs.reduce((a, [, y]) => a + y, 0);
    const handicap = playerPoints - oppPoints;
    const win = playerSets > oppSets ? 1 : 0;
    const w = Math.exp(-cfg.tau * diffDays);
    const sr = (playerSets + oppSets) ? (playerSets - oppSets) / (playerSets + oppSets) : 0;
    const pr = (playerPoints + oppPoints) ? Math.tanh((playerPoints - oppPoints) / (playerPoints + oppPoints)) : 0;
    const avgH = (playerSets + oppSets) ? handicap / (playerSets + oppSets) : 0;
    const hn = Math.max(-1, Math.min(1, avgH / cfg.fMax));
    const qualityBonus = win ? (playerSets === 3 && oppSets === 0 ? 0.2 : playerSets === 3 && oppSets === 1 ? 0.1 : 0) : 0;
    const Mi = cfg.a1 * win + cfg.a2 * sr + cfg.a3 * pr + cfg.a4 * hn + qualityBonus;
    return { win, Mi, w, date: dt, handicap, playerSets, oppSets, pts: pairs, isDryWin: win === 1 && oppSets === 0, isDryLoss: win === 0 && playerSets === 0 };
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
    const res = Array.from({ length: 5 }, () => ({ win: 0, lose: 0, total: 0 }));
    games.forEach(game => {
      game.pts.forEach(([a, b], idx) => {
        if (a > b) res[idx].win++;
        else if (a < b) res[idx].lose++;
        res[idx].total++;
      });
    });
    return Object.fromEntries(res.map((r, i) => [`set${i+1}`, [`${r.win}/${r.total}`, `${r.lose}/${r.total}`]]));
  }

  function createMatchVisualization(games) {
    return games.slice(0, 10).map(g => g.win ? '🟢' : '🔴').join(' ');
  }

  function parseH2H(A, B) {
    const tbl = [...document.querySelectorAll("table")].find(t => t.querySelector("tr:first-child td")?.textContent.includes("Очные встречи"));
    if (!tbl) return { wA: 0, wB: 0, total: 0, h2hGames: [] };
    const rows = Array.from(tbl.querySelectorAll("tr")).slice(2);
    const h2hData = { wA: 0, wB: 0, h2hGames: [], dryWinsA: 0, dryWinsB: 0 };
    rows.forEach(r => {
        // Ваша логика парсинга H2H
    });
    h2hData.total = h2hData.wA + h2hData.wB;
    return h2hData;
  }

  function getConfidence(pA, pB, vA, vB, hTot) {
    const maxP = Math.max(pA, pB);
    if (maxP > 0.75 && Math.min(vA, vB) < 8 && hTot >= 3) return "🟢";
    if (maxP > 0.65 && Math.min(vA, vB) < 12) return "🟡";
    return "🔴";
  }

  function performAnalysis() {
    const tables = document.querySelectorAll('table.ev-mstat-tbl');
    if (tables.length < 2) return { success: false, error: "На странице не найдены таблицы статистики (нужно 2)." };
    
    const A = parseSection(tables[0]);
    const B = parseSection(tables[1]);
    if (!A.games.length || !B.games.length) return { success: false, error: "Нет данных об играх." };

    const h2hData = parseH2H(A.player, B.player);
    const sA = strengthAdj(A.games);
    const sB = strengthAdj(B.games);
    const vA = calcForaVariance(A.games);
    const vB = calcForaVariance(B.games);
    const prob = 1 / (1 + Math.exp(-cfg.k * (sA - sB)));

    // --- ЛОГИКА ДЛЯ КОМПАКТНОГО ГРАФИКА (5 ИГР) ---
    const historyLength = 5;
    const predictionLength = 3;

    const buildLabels = (hLen, pLen) => 
      [...Array(hLen).keys()].map(i => `-${hLen - i}`).concat([...Array(pLen).keys()].map(i => `П${i + 1}`));
    
    const getFormMiArr = (games, len) => {
        const arr = games.slice(0, len).map(g => +g.Mi.toFixed(3));
        while (arr.length < len) arr.unshift(null); // Дополняем, если игр меньше
        return arr.reverse();
    }

    const getPredictionArr = (games, len) => {
        const lastThreeGames = games.slice(0, 3);
        const avgMi = lastThreeGames.length > 0 ? lastThreeGames.reduce((sum, g) => sum + g.Mi, 0) / lastThreeGames.length : 0;
        return Array(len).fill(+avgMi.toFixed(3));
    }
    
    const chartLabels = buildLabels(historyLength, predictionLength);
    const formA = getFormMiArr(A.games, historyLength);
    const formB = getFormMiArr(B.games, historyLength);
    
    return {
      success: true,
      data: {
        playerA: {
          name: A.player,
          strength: (50 + 50 * sA).toFixed(1),
          probability: (prob * 100).toFixed(1),
          h2h: `${h2hData.wA}-${h2hData.wB}`,
          stability: calcStability(vA),
          s2: calcBaseS(A.games, 2).toFixed(3),
          s5: calcBaseS(A.games, 5).toFixed(3),
          dryWins: calcDryGames(A.games).wins,
          dryLosses: calcDryGames(A.games).losses,
          h2hDryLoss: h2hData.dryWinsA,
          setWins: calcSetWins(A.games),
          visualization: createMatchVisualization(A.games)
        },
        playerB: {
          name: B.player,
          strength: (50 + 50 * sB).toFixed(1),
          probability: ((1 - prob) * 100).toFixed(1),
          h2h: `${h2hData.wB}-${h2hData.wA}`,
          stability: calcStability(vB),
          s2: calcBaseS(B.games, 2).toFixed(3),
          s5: calcBaseS(B.games, 5).toFixed(3),
          dryWins: calcDryGames(B.games).wins,
          dryLosses: calcDryGames(B.games).losses,
          h2hDryLoss: h2hData.dryWinsB,
          setWins: calcSetWins(B.games),
          visualization: createMatchVisualization(B.games)
        },
        confidence: getConfidence(prob, 1 - prob, vA, vB, h2hData.total),
        favorite: prob > 0.5 ? A.player : B.player,
        h2h: h2hData,
        formChartData: {
          labels: chartLabels,
          playerA: {
            form: formA.concat(Array(predictionLength).fill(null)),
            prediction: Array(historyLength).fill(null).concat(getPredictionArr(A.games, predictionLength))
          },
          playerB: {
            form: formB.concat(Array(predictionLength).fill(null)),
            prediction: Array(historyLength).fill(null).concat(getPredictionArr(B.games, predictionLength))
          }
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
