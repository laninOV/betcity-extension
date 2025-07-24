document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const results = document.getElementById('results');
  let chartInstance = null;

  function renderFormChart(d) {
    if (!window.Chart || !d.formChartData) return;
    const ctx = document.getElementById('formChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    // 1. Объединяем данные формы и прогноза в один массив для каждого игрока
    const playerA_fullData = [...d.formChartData.playerA.form];
    const playerB_fullData = [...d.formChartData.playerB.form];

    // Находим последнюю точку формы и соединяем ее с первой точкой прогноза
    const lastFormIndexA = d.formChartData.playerA.form.findLastIndex(v => v !== null);
    if (lastFormIndexA !== -1 && lastFormIndexA < playerA_fullData.length - 1) {
        playerA_fullData[lastFormIndexA + 1] = d.formChartData.playerA.prediction[lastFormIndexA + 1];
    }
    const lastFormIndexB = d.formChartData.playerB.form.findLastIndex(v => v !== null);
    if (lastFormIndexB !== -1 && lastFormIndexB < playerB_fullData.length - 1) {
        playerB_fullData[lastFormIndexB + 1] = d.formChartData.playerB.prediction[lastFormIndexB + 1];
    }

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: d.formChartData.labels,
        datasets: [
          {
            label: d.playerA.name,
            data: playerA_fullData.map((val, i) => val ?? d.formChartData.playerA.prediction[i]), // Единый массив данных
            borderColor: 'rgba(54,162,235,1)',
            backgroundColor: 'rgba(54,162,235,0.1)',
            tension: 0.4,
            spanGaps: true, // Соединяет точки через null
            // 2. Умное переключение стиля линии
            segment: {
              borderColor: ctx => (ctx.p1.parsed.x < 7 ? undefined : 'rgba(54,162,235,0.5)'),
              borderDash: ctx => (ctx.p1.parsed.x < 7 ? undefined : [6, 6]),
            }
          },
          {
            label: d.playerB.name,
            data: playerB_fullData.map((val, i) => val ?? d.formChartData.playerB.prediction[i]), // Единый массив данных
            borderColor: 'rgba(255,99,132,1)',
            backgroundColor: 'rgba(255,99,132,0.1)',
            tension: 0.4,
            spanGaps: true,
            // Умное переключение стиля линии
            segment: {
              borderColor: ctx => (ctx.p1.parsed.x < 7 ? undefined : 'rgba(255,99,132,0.5)'),
              borderDash: ctx => (ctx.p1.parsed.x < 7 ? undefined : [6, 6]),
            }
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 15, padding: 10, font: { size: 10 } }
          }
        },
        scales: {
          y: { beginAtZero: false }
        }
      }
    });
  }

  analyzeBtn.addEventListener('click', () => {
    loading.classList.remove('hidden');
    results.classList.add('hidden');
    error.classList.add('hidden');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        loading.classList.add('hidden');
        error.querySelector('p').textContent = 'Активная вкладка не найдена.';
        error.classList.remove('hidden');
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: "analyze" }, (response) => {
        loading.classList.add('hidden');
        if (chrome.runtime.lastError || !response || !response.success) {
          error.querySelector('p').textContent = response ? response.error : 'Ошибка связи или анализа.';
          error.classList.remove('hidden');
          return;
        }

        const d = response.data;

        // Ваш код для заполнения всех таблиц — ОН СОХРАНЕН
        document.getElementById('confidenceIcon').textContent = d.confidence;
        document.getElementById('favoriteText').textContent = d.favorite;
        document.getElementById('mainTableBody').innerHTML = `
          <tr><td>${d.playerA.name}</td><td>${d.playerA.strength}</td><td>${d.playerA.probability}%</td><td>${d.playerA.h2h}</td><td>${d.playerA.stability}/100</td></tr>
          <tr><td>${d.playerB.name}</td><td>${d.playerB.strength}</td><td>${d.playerB.probability}%</td><td>${d.playerB.h2h}</td><td>${d.playerB.stability}/100</td></tr>
        `;
        document.getElementById('statName1').textContent = d.playerA.name;
        document.getElementById('statName2').textContent = d.playerB.name;
        document.getElementById('s2Player1').textContent = d.playerA.s2;
        document.getElementById('s2Player2').textContent = d.playerB.s2;
        document.getElementById('s5Player1').textContent = d.playerA.s5;
        document.getElementById('s5Player2').textContent = d.playerB.s5;
        document.getElementById('dryWins1').textContent = d.playerA.dryWins;
        document.getElementById('dryWins2').textContent = d.playerB.dryWins;
        document.getElementById('dryLosses1').textContent = d.playerA.dryLosses;
        document.getElementById('dryLosses2').textContent = d.playerB.dryLosses;
        document.getElementById('h2hDryLoss1').textContent = d.playerA.h2hDryLoss;
        document.getElementById('h2hDryLoss2').textContent = d.playerB.h2hDryLoss;
        document.getElementById('p1Sets').textContent = d.playerA.name;
        document.getElementById('p2Sets').textContent = d.playerB.name;
        const setsTableBody = document.getElementById('setsTableBody');
        setsTableBody.innerHTML = '';
        let total1 = 0, total2 = 0;
        Object.entries(d.playerA.setWins).forEach(([set, [p1, p2]]) => {
          const row = `<tr><td>${set.replace('set', '')}</td><td>${p1}</td><td>${d.playerB.setWins[set][0]}</td></tr>`;
          setsTableBody.insertAdjacentHTML('beforeend', row);
          total1 += parseInt(p1.split('/')[0]);
          total2 += parseInt(d.playerB.setWins[set][0].split('/')[0]);
        });
        document.getElementById('totalSets1').textContent = total1;
        document.getElementById('totalSets2').textContent = total2;
        const isFavA = parseFloat(d.playerA.probability) > 50;
        document.getElementById('vizNameFav').textContent = isFavA ? d.playerA.name : d.playerB.name;
        document.getElementById('matchVizFav').textContent = isFavA ? d.playerA.visualization : d.playerB.visualization;
        document.getElementById('vizNameUnd').textContent = isFavA ? d.playerB.name : d.playerA.name;
        document.getElementById('matchVizUnd').textContent = isFavA ? d.playerB.visualization : d.playerA.visualization;
        const h2hVizSection = document.getElementById('h2hVizSection');
        if (d.h2h && d.h2h.total > 0) {
          h2hVizSection.style.display = 'block';
          document.getElementById('h2hFavName').textContent = isFavA ? d.playerA.name : d.playerB.name;
          document.getElementById('h2hViz').textContent = d.h2h.visualization;
        } else {
          h2hVizSection.style.display = 'none';
        }

        results.classList.remove('hidden');
        renderFormChart(d);
      });
    });
  });
});
