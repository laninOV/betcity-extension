// content.js
(() => {
  console.log('CONTENT SCRIPT LOADED');

  // Глобальная переменная для хранения HTML отчёта
  window.__betcityStats = window.__betcityStats || null;

  const cfg = { a1:1, a2:0.5, a3:0.3, a4:0.2, tau:0.05, fMax:5 };
  const now = new Date();

  function parseGame(row, header) {
    const dateCell = row.querySelector('td.date');
    const dateText = dateCell?.textContent.trim();
    if (!dateText) return null;
    const [d,m,y] = dateText.split('.').map(Number);
    const dt = new Date(2000+y, m-1, d);
    const diffDays = Math.floor((now - dt)/(1000*60*60*24));

    const info = row.nextElementSibling;
    const playersText = info.querySelector('td.ev-mstat-ev')?.textContent.trim();
    const scoreText   = info.querySelector('td.score')?.textContent.trim();
    if (!playersText || !scoreText) return null;

    const mch = scoreText.match(/^(\d+):(\d+)\s*\(([^)]+)\)/);
    if (!mch) return null;
    const [, s1,s2,pts] = mch;
    const sets1=+s1, sets2=+s2;
    const pairs = pts.split(',').map(p=>p.trim().split(':').map(Number));

    const isHome = playersText.indexOf(header) < playersText.indexOf(' - ');
    const playerSets = isHome? sets1 : sets2;
    const oppSets    = isHome? sets2 : sets1;
    const total1 = pairs.reduce((sum,[a])=>sum+a,0);
    const total2 = pairs.reduce((sum,[,b])=>sum+b,0);
    const playerPoints = isHome? total1 : total2;
    const oppPoints    = isHome? total2 : total1;
    const handicapSum  = playerPoints - oppPoints;
    const win = playerSets > oppSets ? 1 : 0;

    const w  = Math.exp(-cfg.tau*diffDays);
    const sr = (playerSets+oppSets)? (playerSets-oppSets)/(playerSets+oppSets) : 0;
    const pr = (playerPoints+oppPoints)
             ? Math.tanh((playerPoints-oppPoints)/(playerPoints+oppPoints))
             : 0;
    const avgH = (playerSets+oppSets)? handicapSum/(playerSets+oppSets): 0;
    const hn = Math.max(-1, Math.min(1, avgH/cfg.fMax));
    const Mi = cfg.a1*win + cfg.a2*sr + cfg.a3*pr + cfg.a4*hn;

    return { wonSets:playerSets, lostSets:oppSets, playerPoints, oppPoints, handicapSum, win, w, Mi };
  }

  function parseLast(table) {
    const titleText = table.querySelector('tr:first-child td.title, tr:first-child td')
                           .textContent.trim();
    const header = titleText.replace(/^Последние игры\s+/, '').replace(/:$/, '').trim();

    const rows = Array.from(table.querySelectorAll('tr')).slice(2);
    const games = [];
    for (let i=0; i+1<rows.length && games.length<5; i+=2) {
      const g = parseGame(rows[i], header);
      if (g) games.push(g);
    }
    return { player: header, games };
  }

  function calcS(games) {
    let num=0, den=0;
    games.forEach(g => { num += g.w * g.Mi; den += g.w; });
    return den? (num/den).toFixed(3): '—';
  }

  function renderSection(sec) {
    const S = calcS(sec.games);
    const sumSets   = sec.games.reduce((s,g)=>s+g.wonSets,0);
    const sumPoints = sec.games.reduce((s,g)=>s+g.playerPoints,0);
    const sumFora   = sec.games.filter(g=>g.win).reduce((s,g)=>s+g.handicapSum,0);

    let html = `<h3>${sec.player}: S=${S}, игр=${sec.games.length}</h3><ul>`;
    sec.games.forEach((g,i) => {
      const res = g.win? 'Выиграл' : 'Проиграл';
      const sign = g.handicapSum>=0? '+' : '';
      html += `<li>Игра ${i+1}: ${res} ${g.wonSets}-${g.lostSets}, ` +
              `очки ${g.playerPoints}-${g.oppPoints}, ${res.toLowerCase()} с форой ${sign}${g.handicapSum}</li>`;
    });
    html += `</ul><p>Суммарные сеты: ${sumSets}</p>` +
            `<p>Суммарные очки: ${sumPoints}</p>` +
            `<p>Суммарная фора по победам: ${sumFora>=0?'+':''}${sumFora}</p>`;
    return html;
  }

  // Отложенный расчёт, чтобы дать страницу прогрузиться
  setTimeout(() => {
    const tbls = document.querySelectorAll('table.ev-mstat-tbl');
    let resultHTML;
    if (tbls.length < 2) {
      resultHTML = '<p>Таблицы «Последние игры» не найдены</p>';
    } else {
      const s1 = parseLast(tbls[0]), s2 = parseLast(tbls[1]);
      resultHTML = renderSection(s1) + renderSection(s2);
    }
    window.__betcityStats = resultHTML;
  }, 500);

  // Обработчик запросов от popup.js
  chrome.runtime.onMessage.addListener((msg, sender, send) => {
    if (msg.action === 'getResults') {
      console.log('CONTENT SCRIPT: отправляю результаты в попап');
      send({ data: window.__betcityStats });
    }
  });
})();
