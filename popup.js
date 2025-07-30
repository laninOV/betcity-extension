document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const results = document.getElementById('results');
  let formChartInstance = null;

  function renderFormChart(d) {
    if (!window.Chart || !d.formChartData) return;
    const ctx = document.getElementById('formChart')?.getContext('2d');
    if (!ctx) return;
    if (formChartInstance) formChartInstance.destroy();

    const historyLength = 5;
    const createFullData = (form, prediction) => {
      const fullData = [...form];
      const lastIndex = form.findLastIndex(v => v !== null);
      if (lastIndex !== -1 && lastIndex < fullData.length - 1) {
        fullData[lastIndex + 1] = prediction[lastIndex + 1];
      }
      return fullData.map((val, i) => (val ?? prediction[i]));
    };

    const playerAData = createFullData(d.formChartData.playerA.form, d.formChartData.playerA.prediction);
    const playerBData = createFullData(d.formChartData.playerB.form, d.formChartData.playerB.prediction);

    formChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: d.formChartData.labels,
        datasets: [
          {
            label: d.playerA.name,
            data: playerAData,
            borderColor: 'rgba(54,162,235,1)',
            tension: 0.4,
            spanGaps: true,
            segment: {
              borderDash: ctx => (ctx.p1.parsed.x < historyLength - 1 ? undefined : [6, 6])
            }
          },
          {
            label: d.playerB.name,
            data: playerBData,
            borderColor: 'rgba(255,99,132,1)',
            tension: 0.4,
            spanGaps: true,
            segment: {
              borderDash: ctx => (ctx.p1.parsed.x < historyLength - 1 ? undefined : [6, 6])
            }
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 15, padding: 10, font: { size: 10 } } }
        },
        scales: {
          y: { beginAtZero: false, ticks: { color: '#333' } },
          x: { ticks: { color: '#333' } }
        }
      }
    });
  }

  function formatVisualization(visStr) {
    if (!visStr) return '';
    return [...visStr].map(ch => `<span style="margin-right:6px;">${ch}</span>`).join('');
  }

  analyzeBtn.addEventListener('click', () => {
    loading.classList.remove('hidden');
    results.classList.add('hidden');
    error.classList.add('hidden');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) {
        loading.classList.add('hidden');
        error.querySelector('p').textContent = 'Активная вкладка не найдена.';
        error.classList.remove('hidden');
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: 'analyze' }, (response) => {
        loading.classList.add('hidden');
        try {
          if (chrome.runtime.lastError || !response || !response.success) {
            throw new Error(
              (response && response.error) ||
              (chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Ошибка связи или анализа.')
            );
          }
          const d = response.data;
          const isFavA = parseFloat(d.playerA.probability) > 50;

          // --- Основная таблица ---
          const mainTableBody = document.getElementById('mainTableBody');
          if (mainTableBody) {
            mainTableBody.innerHTML = `
              <tr style="background-color: ${isFavA ? 'rgba(54, 162, 235, 0.2)' : 'transparent'};">
                <td>${d.playerA.name}</td>
                <td>${d.playerA.strength}</td>
                <td>${d.playerA.probability}%</td>
                <td>${d.playerA.h2h}</td>
                <td>${d.playerA.stability}/100</td>
              </tr>
              <tr style="background-color: ${!isFavA ? 'rgba(255, 99, 132, 0.2)' : 'transparent'};">
                <td>${d.playerB.name}</td>
                <td>${d.playerB.strength}</td>
                <td>${d.playerB.probability}%</td>
                <td>${d.playerB.h2h}</td>
                <td>${d.playerB.stability}/100</td>
              </tr>
            `;
          }

          // --- Confidence и фаворит ---
          const confidenceIcon = document.getElementById('confidenceIcon');
          if (confidenceIcon) confidenceIcon.textContent = d.confidence;
          const favoriteText = document.getElementById('favoriteText');
          if (favoriteText) favoriteText.textContent = d.favorite;

          // --- Статистика игроков ---
          if (document.getElementById('statName1')) document.getElementById('statName1').textContent = d.playerA.name;
          if (document.getElementById('statName2')) document.getElementById('statName2').textContent = d.playerB.name;
          if (document.getElementById('s2Player1')) document.getElementById('s2Player1').textContent = d.playerA.s2;
          if (document.getElementById('s2Player2')) document.getElementById('s2Player2').textContent = d.playerB.s2;
          if (document.getElementById('s5Player1')) document.getElementById('s5Player1').textContent = d.playerA.s5;
          if (document.getElementById('s5Player2')) document.getElementById('s5Player2').textContent = d.playerB.s5;
          if (document.getElementById('dryWins1')) document.getElementById('dryWins1').textContent = d.playerA.dryWins;
          if (document.getElementById('dryWins2')) document.getElementById('dryWins2').textContent = d.playerB.dryWins;
          if (document.getElementById('dryLosses1')) document.getElementById('dryLosses1').textContent = d.playerA.dryLosses;
          if (document.getElementById('dryLosses2')) document.getElementById('dryLosses2').textContent = d.playerB.dryLosses;
          if (document.getElementById('h2hDryLoss1')) document.getElementById('h2hDryLoss1').textContent = d.playerA.h2hDryLoss;
          if (document.getElementById('h2hDryLoss2')) document.getElementById('h2hDryLoss2').textContent = d.playerB.h2hDryLoss;

          // --- Победы в сетах ---
          if (document.getElementById('p1Sets')) document.getElementById('p1Sets').textContent = d.playerA.name;
          if (document.getElementById('p2Sets')) document.getElementById('p2Sets').textContent = d.playerB.name;
          const setsTableBody = document.getElementById('setsTableBody');
          if (setsTableBody) {
            setsTableBody.innerHTML = '';
            let total1 = 0, total2 = 0;
            if (d.playerA.setWins) {
              Object.entries(d.playerA.setWins).forEach(([set, [p1Val]]) => {
                const p2Val = d.playerB.setWins[set] ? d.playerB.setWins[set][0] : '';
                setsTableBody.insertAdjacentHTML('beforeend', `
                  <tr>
                    <td>${set.replace('set', '')}</td>
                    <td>${p1Val}</td>
                    <td>${p2Val}</td>
                  </tr>`);
                total1 += parseInt(p1Val.split('/')[0]) || 0;
                total2 += parseInt(p2Val.split('/')[0]) || 0;
              });
            }
            if (document.getElementById('totalSets1')) document.getElementById('totalSets1').textContent = total1;
            if (document.getElementById('totalSets2')) document.getElementById('totalSets2').textContent = total2;
          }

          // --- Вероятности итоговых счетов (классика) ---
          const scoreTableBody = document.getElementById('scoreTableBody');
          if (scoreTableBody) {
            scoreTableBody.innerHTML = '';
            if (d.predictedScores && d.predictedScores.length) {
              d.predictedScores.forEach((item, index) => {
                const row = document.createElement('tr');
                if (index === 0) {
                  row.style.fontWeight = 'bold';
                  const [scoreA, scoreB] = item.score.split(':').map(Number);
                  row.style.backgroundColor = scoreA > scoreB ? 'rgba(54, 162, 235, 0.2)' : 'rgba(255, 99, 132, 0.2)';
                }
                row.innerHTML = `<td>${item.score}</td><td>${item.probability}</td>`;
                scoreTableBody.appendChild(row);
              });
            }
          }

          // --- Вероятности итоговых счетов по Брэдли–Терри ---
          const btScoreTableBody = document.getElementById('btScoreTableBody');
          if (btScoreTableBody) {
            btScoreTableBody.innerHTML = '';
            if (Array.isArray(d.btScoreProbs)) {
              d.btScoreProbs.forEach((row, idx) => {
                btScoreTableBody.insertAdjacentHTML('beforeend', `<tr><td>${row.score}</td><td>${row.probability}</td></tr>`);
              });
            }
          }

          // --- Вероятности по количеству сетов ---
          const setsDistTableBody = document.getElementById('setsDistTableBody');
          if (setsDistTableBody && d.setsDist) {
            setsDistTableBody.innerHTML = `
              <tr><td>3 сета</td><td>${(d.setsDist.P3 * 100).toFixed(1)}%</td></tr>
              <tr><td>4 сета</td><td>${(d.setsDist.P4 * 100).toFixed(1)}%</td></tr>
              <tr><td>5 сетов</td><td>${(d.setsDist.P5 * 100).toFixed(1)}%</td></tr>
            `;
          }

          // --- ТБ 3.5 по сетам ---
          const setsOver35Body = document.getElementById('setsOver35Body');
          if (setsOver35Body && d.setsOver35) {
            setsOver35Body.innerHTML = `
              <tr style="color:#217007;font-weight:600;">
                <td>Больше 3.5</td>
                <td><b>${(d.setsOver35.prob * 100).toFixed(1)}%</b></td>
              </tr>
              <tr style="color:#a43030;">
                <td>Меньше 3.5</td>
                <td>${(100 - d.setsOver35.prob * 100).toFixed(1)}%</td>
              </tr>
            `;
            const setsOver35Explain = document.getElementById('setsOver35Explain');
            if (setsOver35Explain && d.setsOver35.parts) {
              setsOver35Explain.innerHTML = `
                <span style="color:#888;">В последних матчах</span>: 
                <span style="color:#1a63d6;">Игрок 1:</span> ${(d.setsOver35.parts.overA * 100).toFixed(1)}%, 
                <span style="color:#ca4a06;">Игрок 2:</span> ${(d.setsOver35.parts.overB * 100).toFixed(1)}%, 
                <span style="color:#af27ae;">Очные:</span> ${(d.setsOver35.parts.overH2H * 100).toFixed(1)}%
              `;
            }
          }

          // --- Визуализация последних матчей ---
          const vizNameFav = document.getElementById('vizNameFav');
          const vizNameUnd = document.getElementById('vizNameUnd');
          const matchVizFav = document.getElementById('matchVizFav');
          const matchVizUnd = document.getElementById('matchVizUnd');
          if (vizNameFav) vizNameFav.textContent = isFavA ? d.playerA.name : d.playerB.name;
          if (vizNameUnd) vizNameUnd.textContent = isFavA ? d.playerB.name : d.playerA.name;
          if (matchVizFav) matchVizFav.innerHTML = formatVisualization(isFavA ? d.playerA.visualization : d.playerB.visualization);
          if (matchVizUnd) matchVizUnd.innerHTML = formatVisualization(isFavA ? d.playerB.visualization : d.playerA.visualization);

          // --- Визуализация очных встреч ---
          const h2hVizSection = document.getElementById('h2hVizSection');
          if (h2hVizSection) {
            if (d.h2h && d.h2h.total > 0) {
              h2hVizSection.style.display = 'block';
              const h2hFavName = document.getElementById('h2hFavName');
              const h2hViz = document.getElementById('h2hViz');
              if (h2hFavName) h2hFavName.textContent = isFavA ? d.playerA.name : d.playerB.name;
              if (h2hViz) h2hViz.textContent = d.h2h.visualization;
            } else {
              h2hVizSection.style.display = 'none';
            }
          }

          // --- График формы игроков ---
          renderFormChart(d);

          results.classList.remove('hidden');
        } catch (e) {
          console.error('Ошибка при отображении данных:', e);
          if (error) {
            error.querySelector('p').textContent = 'Ошибка: ' + e.message;
            error.classList.remove('hidden');
          }
        }
      });
    });
  });
});
