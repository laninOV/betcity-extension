// content.js — улучшенная версия с детализацией силы и умными советами

(() => {
  console.log("content.js запущен");

  const cfg = {
    a1: 1,
    a2: 0.5,
    a3: 0.3,
    a4: 0.2,
    tau: 0.03,
    fMax: 5,
    k: 5,
    h2hK: 0.15
  };
  const now = new Date();

  function parseGame(row, header) {
    const dateCell = row.querySelector("td.date");
    const dateText = dateCell?.textContent.trim();
    if (!dateText) return null;
    const [d, m, y] = dateText.split(".").map(Number);
    const dt = new Date(2000 + y, m - 1, d);
    const diffDays = Math.floor((now - dt) / (1000 * 60 * 60 * 24));

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

    const total1 = pairs.reduce((sum, [a]) => sum + a, 0);
    const total2 = pairs.reduce((sum, [, b]) => sum + b, 0);

    const playerPoints = isHome ? total1 : total2;
    const oppPoints = isHome ? total2 : total1;
    const handicap = playerPoints - oppPoints;
    const win = playerSets > oppSets ? 1 : 0;

    const w = Math.exp(-cfg.tau * diffDays);

    // Улучшенная формула силы с учётом качества победы
    const sr = (playerSets + oppSets) ? (playerSets - oppSets) / (playerSets + oppSets) : 0;
    const pr = (playerPoints + oppPoints)
      ? Math.tanh((playerPoints - oppPoints) / (playerPoints + oppPoints))
      : 0;
    const avgH = (playerSets + oppSets) ? handicap / (playerSets + oppSets) : 0;
    const hn = Math.max(-1, Math.min(1, avgH / cfg.fMax));
    
    // Бонус за качество победы (3:0, 3:1 лучше чем 3:2)
    const qualityBonus = win ? (playerSets === 3 && oppSets === 0 ? 0.2 : 
                               playerSets === 3 && oppSets === 1 ? 0.1 : 0) : 0;
    
    const Mi = cfg.a1 * win + cfg.a2 * sr + cfg.a3 * pr + cfg.a4 * hn + qualityBonus;

    return { win, playerSets, oppSets, playerPoints, oppPoints, handicap, w, Mi, diffDays, dt };
  }

  function parseSection(table) {
    const titleCell = table.querySelector("tr:first-child td.title, tr:first-child td");
    const titleText = titleCell?.textContent.trim() || "";
    const header = titleText.replace(/^Последние игры\s+/, "").replace(/:$/, "").trim();

    const rows = Array.from(table.querySelectorAll("tr")).slice(2);
    const games = [];
    for (let i = 0; i + 1 < rows.length && games.length < 5; i += 2) {
      const g = parseGame(rows[i], header);
      if (g) games.push(g);
    }
    return { player: header, games };
  }

  function calcBaseS(games, limit = null) {
    const gamesSubset = limit ? games.slice(0, limit) : games;
    let num = 0, den = 0;
    gamesSubset.forEach(g => { num += g.w * g.Mi; den += g.w; });
    return den ? num / den : 0;
  }

  function calcForaBalance(games) {
    const wins = games.filter(g => g.win);
    const losses = games.filter(g => !g.win);
    const fW = wins.length ? wins.reduce((s, g) => s + g.handicap, 0) / wins.length : 0;
    const fL = losses.length ? losses.reduce((s, g) => s + Math.abs(g.handicap), 0) / losses.length : 0;
    return Math.tanh((fW - fL) / cfg.fMax);
  }

  function calcForaVariance(games) {
    if (games.length === 0) return 0;
    const mean = games.reduce((s, g) => s + g.handicap, 0) / games.length;
    const variance = games.reduce((s, g) => s + (g.handicap - mean) ** 2, 0) / games.length;
    return Math.sqrt(variance);
  }

  function strengthAdj(games) {
    const S = calcBaseS(games);
    const F = calcForaBalance(games);
    return S + 0.25 * F;
  }

  function getStrengthLabel(s) {
    if (s >= 1.5) return "отличная";
    if (s >= 1.0) return "хорошая";
    if (s >= 0.5) return "средняя";
    if (s >= 0.0) return "слабая";
    return "очень слабая";
  }

  function parseH2H(playerA, playerB) {
    const h2hTable = [...document.querySelectorAll("table")]
      .find(t => t.querySelector("tr:first-child td.title")?.textContent.includes("Очные встречи"));
    if (!h2hTable) return { wA: 0, wB: 0, total: 0, wAweighted: 0, wBweighted: 0, sumW: 0 };

    const rows = [...h2hTable.querySelectorAll("tr")].slice(2);
    let wAweighted = 0, wBweighted = 0, sumW = 0, wA = 0, wB = 0;
    rows.forEach(row => {
      const score = row.querySelector("td.score")?.textContent.trim();
      const playersText = row.querySelector("td.descr")?.textContent.trim();
      const dateText = row.querySelector("td.date")?.textContent.trim();
      if (!score || !playersText || !dateText) return;
      const [s1, s2] = score.match(/^(\d+):(\d+)/).slice(1, 3).map(Number);
      const [d, m, y] = dateText.split(".").map(Number);
      const dt = new Date(2000 + y, m - 1, d);
      const diffDays = Math.floor((now - dt) / (1000 * 60 * 60 * 24));
      const weight = Math.exp(-cfg.tau * diffDays);
      const isAhome = playersText.indexOf(playerA) < playersText.indexOf(" - ");

      if ((isAhome && s1 > s2) || (!isAhome && s2 > s1)) {
        wAweighted += weight;
        wA++;
      }
      else {
        wBweighted += weight;
        wB++;
      }
      sumW += weight;
    });
    return { wA, wB, total: wA + wB, wAweighted, wBweighted, sumW };
  }

  function report(section) {
    const Sraw = calcBaseS(section.games);
    const S2games = calcBaseS(section.games, 2);
    const Sadj = strengthAdj(section.games);
    const varF = calcForaVariance(section.games);
    const foraBalance = calcForaBalance(section.games);
    
    console.group(`${section.player}:`);
    console.log(`S за 2 игры: ${S2games.toFixed(3)} (${getStrengthLabel(S2games)})`);
    console.log(`S за 5 игр: ${Sraw.toFixed(3)} (${getStrengthLabel(Sraw)})`);
    console.log(`Баланс фор: ${foraBalance.toFixed(3)} (${getStrengthLabel(foraBalance)})`);
    console.log(`S итоговая: ${Sadj.toFixed(3)} (${getStrengthLabel(Sadj)})`);
    console.log(`Дисперсия форы: ${varF.toFixed(2)}`);
    
    section.games.forEach((g, i) => {
      const res = g.win ? "Выиграл" : "Проиграл";
      const sign = g.handicap >= 0 ? "+" : "";
      console.log(
        `Игра ${i + 1}: ${res} ${g.playerSets}-${g.oppSets}, очки ${g.playerPoints}-${g.oppPoints}, ${res.toLowerCase()} с форой ${sign}${g.handicap}`
      );
    });
    console.groupEnd();
    return Sadj;
  }

  function getConfidenceLevel(pA, pB, varA, varB, h2hTotal) {
    const maxProb = Math.max(pA, pB);
    const minVar = Math.min(varA, varB);
    
    // Высокая уверенность: вероятность >75%, низкая дисперсия, достаточно H2H
    if (maxProb > 0.75 && minVar < 8 && h2hTotal >= 3) return "🟢";
    // Средняя уверенность: вероятность >65% или хорошие показатели
    if (maxProb > 0.65 && minVar < 12) return "🟡";
    // Низкая уверенность: остальные случаи
    return "🔴";
  }

  function getAdvice(pA, pB, varA, varB, normA, normB, h2h) {
    const maxVar = Math.max(varA, varB);
    const probDiff = Math.abs(pA - pB);
    const strengthDiff = Math.abs(normA - normB);
    
    if (maxVar > 15) {
      return "Высокая волатильность результатов — рассмотрите ставку на тотал или точный счёт вместо исхода";
    }
    if (probDiff < 0.15) {
      return "Практически равные шансы — избегайте ставок на фаворита, лучше тотал очков";
    }
    if (strengthDiff > 20 && h2h.total >= 5) {
      return "Явный фаворит подтверждён статистикой — можно рассматривать ставку на исход";
    }
    if (h2h.total < 3) {
      return "Мало личных встреч — прогноз менее надёжен, осторожность при ставках";
    }
    return "Умеренная уверенность в прогнозе — стандартные ставки с осторожностью";
  }

  // --- Основной ---
  const tables = document.querySelectorAll("table.ev-mstat-tbl");
  if (tables.length < 2) {
    console.error("Не найдено две таблицы «Последние игры»");
    return;
  }

  const sectionA = parseSection(tables[0]);
  const sectionB = parseSection(tables[1]);
  const S1 = report(sectionA);
  const S2 = report(sectionB);

  // Парсинг H2H
  const h2h = parseH2H(sectionA.player, sectionB.player);
  const hH = h2h.sumW > 0 ? cfg.h2hK * (2 * (h2h.wAweighted / h2h.sumW) - 1) : 0;

  // Итоговая сила
  const SfinalA = 0.7 * S1 + hH;
  const SfinalB = 0.7 * S2 - hH;

  // Нормализация
  const normA = 50 + 50 * SfinalA;
  const normB = 50 + 50 * SfinalB;

  // Вероятности
  let pA0 = 1 / (1 + Math.exp(-cfg.k * (SfinalA - SfinalB)));
  let pB0 = 1 - pA0;

  // Коррекция на нестабильность
  const varA = calcForaVariance(sectionA.games);
  const varB = calcForaVariance(sectionB.games);
  let pA = pA0;
  let pB = pB0;
  if (varA > 10 || varB > 10) {
    pA = 0.35 + 0.3 * (pA0 - 0.5);
    pB = 1 - pA;
  }

  // Определение уровня уверенности
  const confidence = getConfidenceLevel(pA, pB, varA, varB, h2h.total);
  const advice = getAdvice(pA, pB, varA, varB, normA, normB, h2h);

  // Вывод итога
  console.group(`\n${confidence} Итоговый прогноз, агрегированный анализ:`);
  console.table([
    { "Игрок": sectionA.player, "S (0-100)": normA.toFixed(1), "Вероятность (%)": (pA * 100).toFixed(1), "Базовая S": S1.toFixed(3), "Дисперсия фор": varA.toFixed(2), "H2H": h2h.wA },
    { "Игрок": sectionB.player, "S (0-100)": normB.toFixed(1), "Вероятность (%)": (pB * 100).toFixed(1), "Базовая S": S2.toFixed(3), "Дисперсия фор": varB.toFixed(2), "H2H": h2h.wB }
  ]);
  
  console.log(`H2H: ${sectionA.player} ${h2h.wA}-${h2h.wB} ${sectionB.player} (из ${h2h.total})`);
  
  if (varA > 10 || varB > 10) {
    console.log("⚠️ Высокая дисперсия фор у одного из игроков");
  }
  
  console.log(`🎯 Фаворит: ${(pA > pB ? sectionA.player : sectionB.player)} [${Math.max(normA, normB).toFixed(1)}]`);
  console.log(`💡 Совет: ${advice}`);
  console.groupEnd();
})();
