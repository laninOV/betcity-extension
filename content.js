// content.js — обновленная версия с выводом и в консоль, и в popup
(() => {
  console.log("🎾 Tennis Analysis content.js загружен");

  /* ----------------------- КОНФИГУРАЦИЯ ----------------------- */
  const cfg = {
    a1: 1,          // вес победы
    a2: 0.5,        // вес разницы сетов
    a3: 0.3,        // вес разницы очков
    a4: 0.2,        // вес средней форы
    tau: 0.03,      // коэффициент экспоненциального затухания по давности матча
    fMax: 5,        // максимальная абсолютная фора, используемая для нормализации
    k: 5,           // коэффициент логистической функции для вероятности
    h2hK: 0.15      // вес личных встреч
  };
  const now = new Date();

  /* ----------------------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ----------------------- */

  // Парсинг одной игры из строки таблицы «Последние игры»
  function parseGame(row, header) {
    const dateCell = row.querySelector("td.date");
    const dateText = dateCell?.textContent.trim();
    if (!dateText) return null;

    const [d, m, y] = dateText.split(".").map(Number);
    const dt = new Date(2000 + y, m - 1, d);
    const diffDays = Math.floor((now - dt) / (24 * 3600 * 1000));

    const info = row.nextElementSibling;
    const playersText = info.querySelector("td.ev-mstat-ev")?.textContent.trim();
    const scoreText   = info.querySelector("td.score")?.textContent.trim();
    if (!playersText || !scoreText) return null;

    const match = scoreText.match(/^(\d+):(\d+)\s*\(([^)]+)\)/);
    if (!match) return null;

    const [, s1, s2, pts] = match;
    const sets1 = +s1, sets2 = +s2;
    const pairs  = pts.split(",").map(p => p.trim().split(":").map(Number));

    const isHome = playersText.indexOf(header) < playersText.indexOf(" - ");
    const playerSets = isHome ? sets1 : sets2;
    const oppSets    = isHome ? sets2 : sets1;

    const total1 = pairs.reduce((acc, [a]) => acc + a, 0);
    const total2 = pairs.reduce((acc, [, b]) => acc + b, 0);

    const playerPoints = isHome ? total1 : total2;
    const oppPoints    = isHome ? total2 : total1;
    const handicap     = playerPoints - oppPoints;
    const win          = playerSets > oppSets ? 1 : 0;

    const w = Math.exp(-cfg.tau * diffDays);                     // вес давности
    const sr = (playerSets + oppSets) ? (playerSets - oppSets) / (playerSets + oppSets) : 0;    // разница сетов
    const pr = (playerPoints + oppPoints) 
                 ? Math.tanh((playerPoints - oppPoints) / (playerPoints + oppPoints)) : 0;       // норм. разница очков
    const avgH = (playerSets + oppSets) ? handicap / (playerSets + oppSets) : 0;                // средняя фора на сет
    const hn = Math.max(-1, Math.min(1, avgH / cfg.fMax));                                      // норм. фора

    const qualityBonus = win
      ? (playerSets === 3 && oppSets === 0 ? 0.2
        : playerSets === 3 && oppSets === 1 ? 0.1
        : 0)
      : 0;

    const Mi = cfg.a1 * win + cfg.a2 * sr + cfg.a3 * pr + cfg.a4 * hn + qualityBonus;

    return {
      win,
      playerSets, oppSets,
      playerPoints, oppPoints,
      handicap,
      w, Mi,
      diffDays,
      dt
    };
  }

  // Парсинг секции «Последние игры» одной из сторон
  function parseSection(table) {
    const titleCell = table.querySelector("tr:first-child td.title, tr:first-child td");
    const header    = (titleCell?.textContent.trim() || "")
                        .replace(/^Последние игры\s+/i, "")
                        .replace(/:$/, "")
                        .trim();

    const rows = Array.from(table.querySelectorAll("tr")).slice(2);
    const games = [];
    for (let i = 0; i + 1 < rows.length && games.length < 5; i += 2) {
      const g = parseGame(rows[i], header);
      if (g) games.push(g);
    }
    return { player: header, games };
  }

  // Базовая сила (взвешенное среднее Mi) — все игры или первые limit
  function calcBaseS(games, limit = null) {
    const arr = limit ? games.slice(0, limit) : games;
    let num = 0, den = 0;
    arr.forEach(g => { num += g.w * g.Mi; den += g.w; });
    return den ? num / den : 0;
  }

  // Баланс фор (средняя положительная фора побед – средняя отрицательная фора поражений)
  function calcForaBalance(games) {
    const wins   = games.filter(g => g.win);
    const losses = games.filter(g => !g.win);
    const fW = wins.length   ? wins.reduce((s, g) => s +  g.handicap          , 0) / wins.length   : 0;
    const fL = losses.length ? losses.reduce((s, g) => s + Math.abs(g.handicap), 0) / losses.length : 0;
    return Math.tanh((fW - fL) / cfg.fMax);
  }

  // Дисперсия фор (для оценки волатильности)
  function calcForaVariance(games) {
    if (!games.length) return 0;
    const mean = games.reduce((s, g) => s + g.handicap, 0) / games.length;
    const var_ = games.reduce((s, g) => s + (g.handicap - mean) ** 2, 0) / games.length;
    return Math.sqrt(var_);
  }

  // Итоговая сила игрока с учётом фор
  function strengthAdj(games) {
    const S = calcBaseS(games);
    const F = calcForaBalance(games);
    return S + 0.25 * F;
  }

  // Чисто визуальная метка уровня силы
  function getStrengthLabel(x) {
    if (x >=  1.5) return "отличная";
    if (x >=  1.0) return "хорошая";
    if (x >=  0.5) return "средняя";
    if (x >=  0.0) return "слабая";
    return "очень слабая";
  }

  // Парсинг таблицы «Очные встречи»
  function parseH2H(playerA, playerB) {
    const h2hTable = [...document.querySelectorAll("table")]
      .find(t => t.querySelector("tr:first-child td.title")?.textContent.includes("Очные встречи"));
    if (!h2hTable) return { wA: 0, wB: 0, total: 0, wAweighted: 0, wBweighted: 0, sumW: 0 };

    const rows = [...h2hTable.querySelectorAll("tr")].slice(2);
    let wAweighted = 0, wBweighted = 0, sumW = 0, wA = 0, wB = 0;

    rows.forEach(row => {
      const score      = row.querySelector("td.score")?.textContent.trim();
      const playersTxt = row.querySelector("td.descr")?.textContent.trim();
      const dateTxt    = row.querySelector("td.date")?.textContent.trim();
      if (!score || !playersTxt || !dateTxt) return;

      const match = score.match(/^(\d+):(\d+)/);
      if (!match) return;
      const [s1, s2] = match.slice(1, 3).map(Number);
      const [d, m, y] = dateTxt.split(".").map(Number);
      const dt = new Date(2000 + y, m - 1, d);
      const diffDays = Math.floor((now - dt) / (24 * 3600 * 1000));
      const w = Math.exp(-cfg.tau * diffDays);

      const isAhome = playersTxt.indexOf(playerA) < playersTxt.indexOf(" - ");

      if ((isAhome && s1 > s2) || (!isAhome && s2 > s1)) {
        wAweighted += w; wA++;
      } else {
        wBweighted += w; wB++;
      }
      sumW += w;
    });
    return { wA, wB, total: wA + wB, wAweighted, wBweighted, sumW };
  }

  // Уровень уверенности прогноза (эмодзи)
  function getConfidenceLevel(pA, pB, varA, varB, h2hTotal) {
    const maxProb = Math.max(pA, pB);
    const minVar  = Math.min(varA, varB);

    if (maxProb > 0.75 && minVar < 8  && h2hTotal >= 3) return "🟢";
    if (maxProb > 0.65 && minVar < 12)                   return "🟡";
    return "🔴";
  }

  // Совет по ставке
  function getAdvice(pA, pB, varA, varB, normA, normB, h2h) {
    const maxVar      = Math.max(varA, varB);
    const probDiff    = Math.abs(pA - pB);
    const strengthDiff= Math.abs(normA - normB);

    if (maxVar > 15)              return "Высокая волатильность — рассмотреть тоталы или точный счёт.";
    if (probDiff < 0.15)          return "Примерно равные шансы — лучше играть тотал, а не исход.";
    if (strengthDiff > 20 && h2h.total >= 5)
                                 return "Явный фаворит подтверждён H2H — ставка на исход оправдана.";
    if (h2h.total < 3)            return "Мало личных встреч — снизьте размер ставки.";
    return "Умеренная уверенность — стандартные ставки с осторожностью.";
  }

  // Логирование в консоль с красивым форматом
  function logToConsole(sectionA, sectionB, S1, S2, h2h, finalData) {
    console.group("🎾 ТЕННИСНЫЙ АНАЛИЗ");
    
    // Логируем каждого игрока
    [sectionA, sectionB].forEach((section, index) => {
      const S = index === 0 ? S1 : S2;
      const Sraw = calcBaseS(section.games);
      const S2games = calcBaseS(section.games, 2);
      const varF = calcForaVariance(section.games);
      const foraBalance = calcForaBalance(section.games);
      
      console.group(`${section.player}:`);
      console.log(`S за 2 игры: ${S2games.toFixed(3)} (${getStrengthLabel(S2games)})`);
      console.log(`S за 5 игр: ${Sraw.toFixed(3)} (${getStrengthLabel(Sraw)})`);
      console.log(`Баланс фор: ${foraBalance.toFixed(3)} (${getStrengthLabel(foraBalance)})`);
      console.log(`S итоговая: ${S.toFixed(3)} (${getStrengthLabel(S)})`);
      console.log(`Дисперсия форы: ${varF.toFixed(2)}`);
      
      section.games.forEach((g, i) => {
        const res = g.win ? "Выиграл" : "Проиграл";
        const sign = g.handicap >= 0 ? "+" : "";
        console.log(
          `Игра ${i + 1}: ${res} ${g.playerSets}-${g.oppSets}, очки ${g.playerPoints}-${g.oppPoints}, фора ${sign}${g.handicap}`
        );
      });
      console.groupEnd();
    });

    // Итоговый результат
    console.group("📊 ИТОГОВЫЙ ПРОГНОЗ");
    console.table(finalData.players.map(p => ({
      "Игрок": p.name,
      "S (0-100)": p.strength,
      "Вероятность (%)": p.probability,
      "H2H побед": p.h2h,
      "Дисперсия фор": p.variance
    })));
    
    console.log(`H2H: ${sectionA.player} ${h2h.wA}-${h2h.wB} ${sectionB.player} (из ${h2h.total})`);
    console.log(`${finalData.confidence} Фаворит: ${finalData.favorite}`);
    console.log(`💡 Совет: ${finalData.advice}`);
    
    if (finalData.additionalInfo) {
      console.log("📈 Дополнительные показатели:", finalData.additionalInfo);
    }
    
    console.groupEnd();
    console.groupEnd();
  }

  /* ----------------------- ОСНОВНАЯ ФУНКЦИЯ АНАЛИЗА ----------------------- */

  function performAnalysis() {
    console.log("🔍 Начинаем анализ...");
    
    // Ищем две таблицы «Последние игры»
    const tables = document.querySelectorAll("table.ev-mstat-tbl");
    console.log(`Найдено таблиц: ${tables.length}`);
    
    if (tables.length < 2) {
      throw new Error("Не найдены две таблицы «Последние игры»");
    }

    const sectionA = parseSection(tables[0]);
    const sectionB = parseSection(tables[1]);
    
    console.log(`Игрок A: ${sectionA.player}, игр: ${sectionA.games.length}`);
    console.log(`Игрок B: ${sectionB.player}, игр: ${sectionB.games.length}`);

    // Базовые силы
    const S1raw   = calcBaseS(sectionA.games);
    const S2raw   = calcBaseS(sectionB.games);
    const Sadj1   = strengthAdj(sectionA.games);
    const Sadj2   = strengthAdj(sectionB.games);

    // Личные встречи
    const h2h = parseH2H(sectionA.player, sectionB.player);
    const hH  = h2h.sumW > 0 ? cfg.h2hK * (2 * (h2h.wAweighted / h2h.sumW) - 1) : 0;

    // Итоговые силы с учётом H2H (70% собственная форма + 30% H2H-коррекция)
    const SfA   = 0.7 * Sadj1 + hH;
    const SfB   = 0.7 * Sadj2 - hH;

    // Нормируем в диапазон 0-100
    const normA = 50 + 50 * SfA;
    const normB = 50 + 50 * SfB;

    // Вероятности (логистическая функция)
    let pA = 1 / (1 + Math.exp(-cfg.k * (SfA - SfB)));
    let pB = 1 - pA;

    // Коррекция на нестабильность фор
    const varA = calcForaVariance(sectionA.games);
    const varB = calcForaVariance(sectionB.games);
    if (varA > 10 || varB > 10) {
      pA = 0.35 + 0.3 * (pA - 0.5);
      pB = 1 - pA;
    }

    // Уровень уверенности и совет
    const confidence = getConfidenceLevel(pA, pB, varA, varB, h2h.total);
    const advice     = getAdvice(pA, pB, varA, varB, normA, normB, h2h);

    // Подробная статистика по матчам — строки для popup
    function gameStr(g, idx) {
      const res  = g.win ? "W" : "L";
      const sign = g.handicap >= 0 ? "+" : "";
      return `#${idx + 1}: ${res} ${g.playerSets}-${g.oppSets}, pts ${g.playerPoints}-${g.oppPoints}, fora ${sign}${g.handicap}`;
    }

    // Формируем итоговый объект для popup
    const finalData = {
      confidence,
      players: [
        {
          name: sectionA.player,
          strength: normA.toFixed(1),
          probability: (pA * 100).toFixed(1),
          h2h: h2h.wA.toString(),
          variance: varA.toFixed(1)
        },
        {
          name: sectionB.player,
          strength: normB.toFixed(1),
          probability: (pB * 100).toFixed(1),
          h2h: h2h.wB.toString(),
          variance: varB.toFixed(1)
        }
      ],
      favorite: pA > pB
        ? `${sectionA.player} [${normA.toFixed(1)}]`
        : `${sectionB.player} [${normB.toFixed(1)}]`,
      advice,
      h2hInfo: `${sectionA.player} ${h2h.wA}-${h2h.wB} ${sectionB.player} (из ${h2h.total} встреч)`,
      detailedStats: [
        {
          player: sectionA.player,
          games: sectionA.games.map(gameStr)
        },
        {
          player: sectionB.player,
          games: sectionB.games.map(gameStr)
        }
      ],
      additionalInfo: {
        "S базовая A": S1raw.toFixed(3),
        "S базовая B": S2raw.toFixed(3),
        "H2H коррекция": hH.toFixed(3),
        "Волатильность A": varA > 10 ? "Высокая" : "Нормальная",
        "Волатильность B": varB > 10 ? "Высокая" : "Нормальная",
        "Всего H2H": h2h.total.toString()
      }
    };

    // Выводим в консоль для отладки
    logToConsole(sectionA, sectionB, Sadj1, Sadj2, h2h, finalData);

    return finalData;
  }

  /* ----------------------- ОБРАБОТЧИК СООБЩЕНИЙ ----------------------- */

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("📨 Получено сообщение:", request);
    
    if (request.action === "analyze") {
      try {
        const data = performAnalysis();
        console.log("✅ Анализ завершен успешно");
        sendResponse({ success: true, data });
      } catch (err) {
        console.error("❌ Ошибка анализа:", err);
        sendResponse({ success: false, error: err.message });
      }
      return true; // Важно для асинхронного ответа
    }
  });

  console.log("🎾 Tennis Analysis готов к работе!");
})();
