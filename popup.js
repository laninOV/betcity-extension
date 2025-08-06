document.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const results = document.getElementById('results');

  function formatVisualization(visStr) {
    if (!visStr) return '';
    return [...visStr].map(ch => `<span style="margin-right:4px;">${ch}</span>`).join('');
  }

  function getKuTbRecommendation(value) {
    if (value === null || value === undefined) return '-';
    if (value > 0.40) return 'Ставить ТБ 3.5';
    if (value >= 0.30) return 'Учитывать соперника';
    return 'Избегать ТБ 3.5';
  }

  function makeRecommendation(d) {
    const pa = parseFloat(d.playerA.probability);
    const pb = parseFloat(d.playerB.probability);
    const sa = parseFloat(d.playerA.strength);
    const sb = parseFloat(d.playerB.strength);
    const stA = parseInt(d.playerA.stability, 10);
    const stB = parseInt(d.playerB.stability, 10);
    const kuA = d.playerA.ku_tb35_mod ?? d.playerA.ku_tb35;
    const kuB = d.playerB.ku_tb35_mod ?? d.playerB.ku_tb35;
    const dryA = parseInt(d.playerA.dryWins, 10);
    const dryB = parseInt(d.playerB.dryWins, 10);
    const btA = parseFloat(d.bt_pSetA ?? 0.5);
    const btB = parseFloat(d.bt_pSetB ?? 0.5);

    const weights = {
      probabilityDiff: 2,
      strengthDiff: 1,
      stabilityDiff: 0.7,
      h2hAdv: 0.5,
      kuHigh: 0.5,
      kuLowOpponent: 0.3,
      dryWins: 0.2,
      btAdv: 0.4
    };

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

    const scores = { A: 0, B: 0 };
    const reasonsA = [];
    const reasonsB = [];

    if (pa > pb + 5) { scores.A += weights.probabilityDiff; reasonsA.push("Высокая вероятность"); }
    if (pb > pa + 5) { scores.B += weights.probabilityDiff; reasonsB.push("Высокая вероятность"); }
    if (sa > sb + 2) { scores.A += weights.strengthDiff;    reasonsA.push("Больше сила"); }
    if (sb > sa + 2) { scores.B += weights.strengthDiff;    reasonsB.push("Больше сила"); }
    if (stA > stB + 5) { scores.A += weights.stabilityDiff; reasonsA.push("Более стабильные"); }
    if (stB > stA + 5) { scores.B += weights.stabilityDiff; reasonsB.push("Более стабильные"); }
    const [hA, hB] = d.playerA.h2h.split('-').map(x => parseInt(x, 10));
    if (hA > hB) { scores.A += weights.h2hAdv; reasonsA.push("Лучшие H2H"); }
    if (hB > hA) { scores.B += weights.h2hAdv; reasonsB.push("Лучшие H2H"); }
    if (kuA > 0.4) { scores.A += weights.kuHigh; reasonsA.push("Высокая упорность"); }
    if (kuB > 0.4) { scores.B += weights.kuHigh; reasonsB.push("Высокая упорность"); }
    if (kuA < 0.3) { scores.B += weights.kuLowOpponent; reasonsB.push("Низкая упорность соперника"); }
    if (kuB < 0.3) { scores.A += weights.kuLowOpponent; reasonsA.push("Низкая упорность соперника"); }
    if (dryA > dryB + 2) { scores.A += weights.dryWins; reasonsA.push("Чаще выигрывает всухую"); }
    if (dryB > dryA + 2) { scores.B += weights.dryWins; reasonsB.push("Чаще выигрывает всухую"); }
    if (btA > btB + 0.1) { scores.A += weights.btAdv; reasonsA.push("Лучше (BT) по сетам"); }
    if (btB > btA + 0.1) { scores.B += weights.btAdv; reasonsB.push("Лучше (BT) по сетам"); }

    let verdictText = '';
    let favorite = null;
    let favScore = 0;

    if (scores.A - scores.B > 1.2) {
      verdictText = `Фаворит: ${d.playerA.name} (ЗА)\nПричины: ${reasonsA.join(', ')}`;
      favorite = d.playerA.name;
      favScore = scores.A;
    } else if (scores.B - scores.A > 1.2) {
      verdictText = `Фаворит: ${d.playerB.name} (ЗА)\nПричины: ${reasonsB.join(', ')}`;
      favorite = d.playerB.name;
      favScore = scores.B;
    } else {
      verdictText = `Равные шансы или высокая неопределённость — аккуратнее!\nЗА ${d.playerA.name}: ${reasonsA.join(', ') || 'нет ярких причин'}\nЗА ${d.playerB.name}: ${reasonsB.join(', ') || 'нет ярких причин'}`;
      favorite = null;
      favScore = 0;
    }

    return { verdictText, favorite, favScore, totalWeight };
  }

  function fillRecommendationBlock(d) {
    const recBlock = document.getElementById('recommendationBlock');
    if (!recBlock) return;

    const rec = makeRecommendation(d);

    let confidenceHTML = '';
    if (rec.favorite) {
      const percent = ((rec.favScore / rec.totalWeight) * 100).toFixed(1);
      confidenceHTML = `
        <div style="margin-top:6px; font-size: 12px; font-weight: 600; color: #8ab4f8;">
          Индикатор уверенности: <strong>${rec.favScore.toFixed(2)}</strong> / <em>${rec.totalWeight.toFixed(2)}</em> (${percent}%)
        </div>`;
    }

    recBlock.innerHTML = `
      <pre style="margin:0; white-space: pre-wrap; font-weight: 700; font-size: 14px; color:#dbe7ff;">${rec.verdictText}</pre>
      ${confidenceHTML}
    `;
  }

  function fillTop3Tables(d) {
    const topGeneralScoresBody = document.getElementById('topGeneralScoresBody');
    if (topGeneralScoresBody && d.predictedScores && Array.isArray(d.predictedScores)) {
      const top3general = [...d.predictedScores]
        .sort((a, b) => parseFloat(b.probability) - parseFloat(a.probability))
        .slice(0, 3);

      topGeneralScoresBody.innerHTML = top3general.map(item =>
        `<tr><td>${item.score}</td><td>${parseFloat(item.probability).toFixed(1)}%</td></tr>`
      ).join('');
    }

    const topBTScoresBody = document.getElementById('topBTScoresBody');
    if (topBTScoresBody && d.btScoreProbs && Array.isArray(d.btScoreProbs)) {
      const top3bt = [...d.btScoreProbs]
        .sort((a, b) => parseFloat(b.probability) - parseFloat(a.probability))
        .slice(0, 3);

      topBTScoresBody.innerHTML = top3bt.map(item =>
        `<tr><td>${item.score}</td><td>${parseFloat(item.probability).toFixed(1)}%</td></tr>`
      ).join('');
    }
  }

  function fillMainTable(data) {
    const isFavA = parseFloat(data.playerA.probability) > 50;
    document.getElementById('mainTableBody').innerHTML = `
      <tr style="background-color: ${isFavA ? 'rgba(54, 162, 235, 0.12)' : 'transparent'}; text-align:center;">
        <td style="text-align:left; padding-left:10px;">${data.playerA.name}</td>
        <td>${data.playerA.strength}</td>
        <td>${data.playerA.probability}%</td>
        <td>${data.playerA.h2h}</td>
        <td>${data.playerA.stability}/100</td>
      </tr>
      <tr style="background-color: ${!isFavA ? 'rgba(255, 99, 132, 0.12)' : 'transparent'}; text-align:center;">
        <td style="text-align:left; padding-left:10px;">${data.playerB.name}</td>
        <td>${data.playerB.strength}</td>
        <td>${data.playerB.probability}%</td>
        <td>${data.playerB.h2h}</td>
        <td>${data.playerB.stability}/100</td>
      </tr>
    `;
  }

  function fillStatsTables(data) {
    document.getElementById('statName1').textContent = data.playerA.name;
    document.getElementById('statName2').textContent = data.playerB.name;
    document.getElementById('s2Player1').textContent = data.playerA.s2;
    document.getElementById('s2Player2').textContent = data.playerB.s2;
    document.getElementById('s5Player1').textContent = data.playerA.s5;
    document.getElementById('s5Player2').textContent = data.playerB.s5;
    document.getElementById('dryWins1').textContent = data.playerA.dryWins;
    document.getElementById('dryWins2').textContent = data.playerB.dryWins;
    document.getElementById('dryLosses1').textContent = data.playerA.dryLosses;
    document.getElementById('dryLosses2').textContent = data.playerB.dryLosses;
  }

  function fillKUBlock(data) {
    document.getElementById('kuTbPlayerA').textContent = data.playerA.name;
    document.getElementById('kuTbValueA').textContent = data.playerA.ku_tb35_mod ?? data.playerA.ku_tb35;
    document.getElementById('kuTbRecA').textContent = getKuTbRecommendation(parseFloat(data.playerA.ku_tb35_mod ?? data.playerA.ku_tb35));
    document.getElementById('kuTbPlayerB').textContent = data.playerB.name;
    document.getElementById('kuTbValueB').textContent = data.playerB.ku_tb35_mod ?? data.playerB.ku_tb35;
    document.getElementById('kuTbRecB').textContent = getKuTbRecommendation(parseFloat(data.playerB.ku_tb35_mod ?? data.playerB.ku_tb35));
  }

  function fillVisualization(data) {
    const isFavA = parseFloat(data.playerA.probability) > 50;
    document.getElementById('vizNameFav').textContent = isFavA ? data.playerA.name : data.playerB.name;
    document.getElementById('vizNameUnd').textContent = isFavA ? data.playerB.name : data.playerA.name;
    document.getElementById('matchVizFav').innerHTML = formatVisualization(isFavA ? data.playerA.visualization : data.playerB.visualization);
    document.getElementById('matchVizUnd').innerHTML = formatVisualization(isFavA ? data.playerB.visualization : data.playerA.visualization);

    const h2hVizRow = document.getElementById('h2hVizRow');
    const h2hVizInline = document.getElementById('h2hVizInline');
    if (h2hVizRow && h2hVizInline && data.h2h && data.h2h.total > 0) {
      h2hVizRow.style.display = 'flex';
      h2hVizInline.innerHTML = formatVisualization(data.h2h.visualization);
    } else if (h2hVizRow) {
      h2hVizRow.style.display = 'none';
    }
  }

  function countWonSets(setWins) {
    if (!setWins) return 0;
    return Object.values(setWins).reduce((sum, [wins]) => {
      const won = Number(wins.split('/')[0]) || 0;
      return sum + won;
    }, 0);
  }

  function countTotalSets(setWins) {
    if (!setWins) return 0;
    return Object.values(setWins).reduce((sum, [wins]) => {
      const total = Number((wins || "0/0").split('/')[1]) || 0;
      return sum + total;
    }, 0);
  }

  function fillSetsTable(data) {
    const p1Name = data.playerA.name || 'Игрок 1';
    const p2Name = data.playerB.name || 'Игрок 2';

    const p1Won = countWonSets(data.playerA.setWins);
    const p1Total = countTotalSets(data.playerA.setWins);
    const p2Won = countWonSets(data.playerB.setWins);
    const p2Total = countTotalSets(data.playerB.setWins);

    document.getElementById('p1Sets').textContent = `${p1Name} (${p1Won}/${p1Total})`;
    document.getElementById('p2Sets').textContent = `${p2Name} (${p2Won}/${p2Total})`;

    const tbody = document.getElementById('setsTableBody');
    tbody.innerHTML = '';
    if (data.playerA.setWins) {
      Object.entries(data.playerA.setWins).forEach(([set, [p1Val]]) => {
        const p2Val = data.playerB.setWins && data.playerB.setWins[set] ? data.playerB.setWins[set][0] : '-';
        tbody.insertAdjacentHTML('beforeend', `<tr><td>${set.replace('set', '')}</td><td>${p1Val}</td><td>${p2Val}</td></tr>`);
      });
    }
  }

  function fillScoreDetails(data) {
    const scoreTableBody = document.getElementById('scoreTableBody');
    if (scoreTableBody && data.predictedScores) {
      scoreTableBody.innerHTML = '';
      data.predictedScores.forEach((item, index) => {
        const row = document.createElement('tr');
        if(index === 0) row.style.fontWeight = 'bold';
        row.innerHTML = `<td>${item.score}</td><td>${item.probability}</td>`;
        scoreTableBody.appendChild(row);
      });
    }

    const btScoreTableBody = document.getElementById('btScoreTableBody');
    if (btScoreTableBody && Array.isArray(data.btScoreProbs)) {
      btScoreTableBody.innerHTML = '';
      data.btScoreProbs.forEach((row, idx) => {
        const tr = document.createElement('tr');
        if(idx === 0) tr.style.fontWeight = 'bold';
        tr.innerHTML = `<td>${row.score}</td><td>${row.probability}</td>`;
        btScoreTableBody.appendChild(tr);
      });
    }
  }

  function setError(message) {
    loading.classList.add('hidden');
    if (error) {
      error.querySelector('p').textContent = message;
      error.classList.remove('hidden');
    }
  }

  function launchAnalyze() {
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    if (results) results.classList.add('hidden');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) {
        setError('Не найдена активная вкладка.');
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: 'analyze' }, (response) => {
        loading.classList.add('hidden');
        try {
          if (chrome.runtime.lastError || !response || !response.success) {
            throw new Error((response && response.error) || (chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Ошибка анализа.'));
          }
          const d = response.data;
          fillRecommendationBlock(d);
          fillTop3Tables(d);
          fillMainTable(d);
          fillStatsTables(d);
          fillKUBlock(d);
          fillVisualization(d);
          fillSetsTable(d);
          fillScoreDetails(d);
          if(results) results.classList.remove('hidden');
        } catch (e) {
          setError('Ошибка: ' + e.message);
        }
      });
    });
  }

  launchAnalyze();
});
