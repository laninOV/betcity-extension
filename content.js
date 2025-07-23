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
    const qualityBonus = win
      ? (playerSets === 3 && oppSets === 0 ? 0.2 : playerSets === 3 && oppSets === 1 ? 0.1 : 0)
      : 0;
    const Mi = cfg.a1 * win + cfg.a2 * sr + cfg.a3 * pr + cfg.a4 * hn + qualityBonus;

    // Логирование парсинга одной игры
    console.group(`Парсинг матча: ${dt.toLocaleDateString('ru-RU')}`);
    console.log('playersText:', playersText);
    console.log('playerSets–oppSets:', `${playerSets}:${oppSets}`);
    console.log('pts по сетам:', pairs.map(p => p.join(':')).join(', '));
    console.log('handicap:', handicap, 'дней назад:', diffDays);
    console.log('w (вес):', w.toFixed(3));
    console.log('sr (сат. разниц):', sr.toFixed(3));
    console.log('pr (разн. очков):', pr.toFixed(3));
    console.log('hn (норм. гандикап):', hn.toFixed(3));
    console.log('qualityBonus:', qualityBonus);
    console.log('Mi (индекс качества):', Mi.toFixed(3));
    console.groupEnd();

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
    console.log(`\n🔍 Раздел: ${header} — всего матчей: ${games.length}`);
    console.log('Сырые объекты игр:', games);
    return { player: header, games };
  }

  // … остальные вычислительные функции без изменений …

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

  function logStatistics(playerData) {
    console.group(`📊 Полная статистика — ${playerData.player}`);
    console.log(`Матчей: ${playerData.games.length}`);
    console.log(`Побед: ${playerData.games.filter(g => g.win).length}`);
    console.log(`Поражений: ${playerData.games.filter(g => !g.win).length}`);

    const setWins = calcSetWins(playerData.games);
    console.group("🎯 Победы в сетах (посредине расчётов):");
    Object.entries(setWins).forEach(([setNum, [p, o]]) => {
      console.log(`${setNum}: Игрок ${p}, Соперник ${o}`);
    });
    console.groupEnd();

    const dry = calcDryGames(playerData.games);
    console.log(`Сухие победы: ${dry.wins}, сухие поражения: ${dry.losses}`);

    const baseS = calcBaseS(playerData.games);
    const fb = calcForaBalance(playerData.games);
    console.log(`calcBaseS: ${baseS.toFixed(3)}`);
    console.log(`calcForaBalance: ${fb.toFixed(3)}`);

    const variance = calcForaVariance(playerData.games);
    const stability = calcStability(variance);
    console.log(`calcForaVariance: ${variance.toFixed(3)}`);
    console.log(`calcStability: ${stability}%`);
    console.groupEnd();
  }

  function performAnalysis() {
    console.clear();
    console.log("=== НАЧАЛО АНАЛИЗА ===");
    const tables = document.querySelectorAll("table.ev-mstat-tbl");
    if (tables.length < 2) throw Error("Недостаточно таблиц");
    const A = parseSection(tables[0]);
    const B = parseSection(tables[1]);
    logStatistics(A);
    logStatistics(B);

    // … остальной код performAnalysis с логированием H2H и финальных расчётов …
  }

  chrome.runtime.onMessage.addListener((req, sender, send) => {
    if (req.action === "analyze") {
      try { send({ success: true, data: performAnalysis() }); }
      catch (e) { send({ success: false, error: e.message }); }
    }
    return true;
  });
})();
