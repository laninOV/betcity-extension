// content.js
// В самом начале content.js

(() => {
  console.log("content.js запущен");
  const cfg = { a1:1, a2:0.5, a3:0.3, a4:0.2, tau:0.05, fMax:5 };
  const now = new Date();

  function parseGame(row, header) {
    const dateCell = row.querySelector("td.date");
    const dateText = dateCell?.textContent.trim();
    if (!dateText) return null;
    const [d,m,y] = dateText.split(".").map(Number);
    const dt = new Date(2000+y, m-1, d);
    const diffDays = Math.floor((now - dt)/(1000*60*60*24));

    const info = row.nextElementSibling;
    const playersText = info.querySelector("td.ev-mstat-ev")?.textContent.trim();
    const scoreText   = info.querySelector("td.score")?.textContent.trim();
    if (!playersText||!scoreText) return null;

    const match = scoreText.match(/^(\d+):(\d+)\s*\(([^)]+)\)/);
    if (!match) return null;
    const [, s1,s2,pts] = match;
    const sets1=+s1, sets2=+s2;
    const pairs = pts.split(",").map(p=>p.trim().split(":").map(Number));

    const isHome = playersText.indexOf(header)<playersText.indexOf(" - ");
    const playerSets = isHome? sets1: sets2;
    const oppSets    = isHome? sets2: sets1;

    const total1 = pairs.reduce((sum,[a])=>sum+a,0);
    const total2 = pairs.reduce((sum,[,b])=>sum+b,0);
    const playerPoints = isHome? total1: total2;
    const oppPoints    = isHome? total2: total1;
    const handicap = playerPoints-oppPoints;
    const win = playerSets>oppSets?1:0;

    const w  = Math.exp(-cfg.tau*diffDays);
    const sr = (playerSets+oppSets)? (playerSets-oppSets)/(playerSets+oppSets):0;
    const pr = (playerPoints+oppPoints)
             ? Math.tanh((playerPoints-oppPoints)/(playerPoints+oppPoints))
             :0;
    const avgH = (playerSets+oppSets)? handicap/(playerSets+oppSets):0;
    const hn = Math.max(-1,Math.min(1,avgH/cfg.fMax));
    const Mi = cfg.a1*win + cfg.a2*sr + cfg.a3*pr + cfg.a4*hn;

    return { win, playerSets, oppSets, playerPoints, oppPoints, handicap, w, Mi };
  }

  function parseSection(table) {
    const title = table.querySelector("tr:first-child td.title, tr:first-child td")
                       .textContent.trim();
    const header = title.replace(/^Последние игры\s+/,"").replace(/:$/,"").trim();
    const rows = Array.from(table.querySelectorAll("tr")).slice(2);
    const games = [];
    for (let i=0; i+1<rows.length && games.length<5; i+=2) {
      const g = parseGame(rows[i], header);
      if (g) games.push(g);
    }
    return { header, games };
  }

  function calcS(games) {
    let num=0, den=0;
    games.forEach(g=>{ num+=g.w*g.Mi; den+=g.w; });
    return den? num/den : 0;
  }

  function report(sec) {
    const S = calcS(sec.games);
    console.group(`Игрок ${sec.header}: S = ${S.toFixed(3)}, матчей = ${sec.games.length}`);
    sec.games.forEach((g,i)=>{
      const res = g.win? "Выиграл":"Проиграл";
      const sign = g.handicap>=0? "+": "";
      console.log(
        `Игра ${i+1}: ${res} ${g.playerSets}-${g.oppSets}, `+
        `очки ${g.playerPoints}-${g.oppPoints}, ${res.toLowerCase()} с форой ${sign}${g.handicap}`
      );
    });
    console.groupEnd();
    return S;
  }

  // Основной запуск
  const tables = document.querySelectorAll("table.ev-mstat-tbl");
  if (tables.length<2) {
    console.error("Не найдены таблицы «Последние игры»");
    return;
  }
  const sec1 = parseSection(tables[0]);
  const sec2 = parseSection(tables[1]);
  const S1 = report(sec1);
  const S2 = report(sec2);

  // Расчёт вероятности победы
  const k = 7;  // чувствительный коэффициент
  const p1 = 1/(1 + Math.exp(-k*(S1 - S2)));
  const p2 = 1 - p1;
  console.log(`Вероятность победы: ${sec1.header} = ${(p1*100).toFixed(1)}%, `+
              `${sec2.header} = ${(p2*100).toFixed(1)}%`);
})();
