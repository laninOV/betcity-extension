// content.js — полный код скрипта для расчёта «Последние игры» двух игроков на странице Betcity
(() => {
  // Параметры формулы
  const cfg = {
    a1: 1.0,    // вес победы
    a2: 0.5,    // вес соотношения сетов
    a3: 0.3,    // вес соотношения очков
    a4: 0.2,    // вес форы
    tau: 0.05,  // коэффициент экспоненциального затухания
    fMax: 5.0   // максимальная фора для нормировки
  };
  const now = new Date();

  // Функция парсинга одной игры (две подряд строки <tr> в блоке "Последние игры")
  function parseGame(row, header) {
    // Строка с датой
    const dateCell = row.querySelector('td.date');
    const dateText = dateCell?.textContent.trim();
    if (!dateText) return null;
    const [d, m, y] = dateText.split('.').map(Number);
    const matchDate = new Date(2000 + y, m - 1, d);
    const diffDays = Math.floor((now - matchDate) / (1000 * 60 * 60 * 24));

    // Строка с игроками и счётом
    const infoRow = row.nextElementSibling;
    const playersText = infoRow.querySelector('td.ev-mstat-ev')?.textContent.trim();
    const scoreText   = infoRow.querySelector('td.score')?.textContent.trim();
    if (!playersText || !scoreText) return null;

    // Разбор счёта сетов и очков
    const match = scoreText.match(/^(\d+):(\d+)\s*\(([^)]+)\)/);
    if (!match) return null;
    const [, s1, s2, pts] = match;
    const sets1 = +s1, sets2 = +s2;
    const pairs = pts.split(',').map(p => p.trim().split(':').map(Number));

    // Определяем, чей счёт считать «наш» (header — имя игрока после «Последние игры»)
    const isHome = playersText.indexOf(header) < playersText.indexOf(' - ');
    const playerSets = isHome ? sets1 : sets2;
    const oppSets    = isHome ? sets2 : sets1;

    // Считаем очки
    const total1 = pairs.reduce((sum, [a]) => sum + a, 0);
    const total2 = pairs.reduce((sum, [, b]) => sum + b, 0);
    const playerPoints = isHome ? total1 : total2;
    const oppPoints    = isHome ? total2 : total1;
    const handicapSum  = playerPoints - oppPoints;
    const win = playerSets > oppSets ? 1 : 0;

    // Вычисляем вес и вклад для S
    const w = Math.exp(-cfg.tau * diffDays);
    const sr = (playerSets + oppSets)
      ? (playerSets - oppSets) / (playerSets + oppSets)
      : 0;
    const pr = (playerPoints + oppPoints)
      ? Math.tanh((playerPoints - oppPoints) / (playerPoints + oppPoints))
      : 0;
    const avgHandicap = (playerSets + oppSets)
      ? handicapSum / (playerSets + oppSets)
      : 0;
    const hn = Math.max(-1, Math.min(1, avgHandicap / cfg.fMax));
    const Mi = cfg.a1 * win + cfg.a2 * sr + cfg.a3 * pr + cfg.a4 * hn;

    return {
      diffDays,
      win,
      wonSets: playerSets,
      lostSets: oppSets,
      playerPoints,
      oppPoints,
      handicapSum,
      w,
      Mi
    };
  }

  // Функция разбора блока "Последние игры <Игрок>:"
  function parseLast(table) {
    // Извлечь имя игрока из заголовка
    const titleText = table.querySelector('tr:first-child td.title, tr:first-child td')
      .textContent.trim();
    const header = titleText
      .replace(/^Последние игры\s+/, '')
      .replace(/:$/, '')
      .trim();

    // Собираем все строки с данными (после двух строк заголовка)
    const rows = Array.from(table.querySelectorAll('tr')).slice(2);
    const games = [];
    // Каждые 2 строки — один матч, ограничиваем первыми пятью
    for (let i = 0; i + 1 < rows.length && games.length < 5; i += 2) {
      const game = parseGame(rows[i], header);
      if (game) games.push(game);
    }
    return { player: header, games };
  }

  // Вычисление итогового показателя S
  function calcS(games) {
    let num = 0, den = 0;
    games.forEach(g => {
      num += g.w * g.Mi;
      den += g.w;
    });
    return den ? (num / den).toFixed(3) : '—';
  }

  // Формирование HTML-отчёта для секции
  function generateReport(section) {
    const S = calcS(section.games);
    const totalSets = section.games.reduce((sum, g) => sum + g.wonSets, 0);
    const totalPoints = section.games.reduce((sum, g) => sum + g.playerPoints, 0);
    const totalHandicapWins = section.games
      .filter(g => g.win)
      .reduce((sum, g) => sum + g.handicapSum, 0);

    let html = `<h3>${section.player}: S=${S}, игр=${section.games.length}</h3><ul>`;
    section.games.forEach((g, i) => {
      const result = g.win ? 'Выиграл' : 'Проиграл';
      const sign = g.handicapSum >= 0 ? '+' : '';
      html += `<li>Игра ${i+1}: ${result} ${g.wonSets}-${g.lostSets}, очки ${g.playerPoints}-${g.oppPoints}, ${result.toLowerCase()} с форой ${sign}${g.handicapSum}</li>`;
    });
    html += '</ul>';
    html += `<p>Суммарные сеты: ${totalSets}</p>`;
    html += `<p>Суммарные очки: ${totalPoints}</p>`;
    html += `<p>Суммарная фора по победам: ${totalHandicapWins >= 0 ? '+' : ''}${totalHandicapWins}</p>`;
    return html;
  }

  // Основной запуск: парсим две таблицы "ev-mstat-tbl"
  const lastTables = document.querySelectorAll('table.ev-mstat-tbl');
  if (lastTables.length < 2) {
    chrome.runtime.sendMessage({ action: 'showResults', data: '<p>Таблицы «Последние игры» не найдены</p>' });
    return;
  }
  const firstSection = parseLast(lastTables[0]);
  const secondSection = parseLast(lastTables[1]);
  const reportHtml = generateReport(firstSection) + generateReport(secondSection);

  // Отправляем результат в popup
  chrome.runtime.sendMessage({ action: 'showResults', data: reportHtml });
})();
