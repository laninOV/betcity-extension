document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const results = document.getElementById('results');

  analyzeBtn.addEventListener('click', () => {
    loading.classList.remove('hidden');
    results.classList.add('hidden');
    error.classList.add('hidden');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        loading.classList.add('hidden');
        error.querySelector('p').textContent = 'Активная вкладка не найдена.';
        error.classList.remove('hidden');
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: "analyze" }, (response) => {
        loading.classList.add('hidden');
        if (chrome.runtime.lastError) {
          error.querySelector('p').textContent = 'Ошибка связи: ' + chrome.runtime.lastError.message;
          error.classList.remove('hidden');
          return;
        }
        if (!response.success) {
          error.querySelector('p').textContent = 'Ошибка анализа: ' + response.error;
          error.classList.remove('hidden');
          return;
        }
        const d = response.data;

        // Топ-инфо
        document.getElementById('confidenceIcon').textContent = d.confidence;
        document.getElementById('confidenceText').textContent = ''; // Если есть текст, добавьте
        document.getElementById('favoriteText').textContent = d.favorite;

        // Основная таблица
        document.getElementById('mainTableBody').innerHTML = `
          <tr>
            <td>${d.playerA.name}</td>
            <td>${d.playerA.strength}</td>
            <td>${d.playerA.probability}%</td>
            <td>${d.playerA.h2h}</td>
            <td>${d.playerA.stability}/100</td>
          </tr>
          <tr>
            <td>${d.playerB.name}</td>
            <td>${d.playerB.strength}</td>
            <td>${d.playerB.probability}%</td>
            <td>${d.playerB.h2h}</td>
            <td>${d.playerB.stability}/100</td>
          </tr>
        `;

        // Статистика игрока
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

        // Победы в сетах
        document.getElementById('p1Sets').textContent = d.playerA.name;
        document.getElementById('p2Sets').textContent = d.playerB.name;
        const setsTableBody = document.getElementById('setsTableBody');
        setsTableBody.innerHTML = '';
        let total1 = 0, total2 = 0;
        Object.entries(d.playerA.setWins).forEach(([set, [p1, p2]]) => {
          const row = `
            <tr>
              <td>${set.replace('set', '')}</td>
              <td>${p1}</td>
              <td>${d.playerB.setWins[set][0]}</td>
            </tr>
          `;
          setsTableBody.insertAdjacentHTML('beforeend', row);
          total1 += parseInt(p1.split('/')[0]);
          total2 += parseInt(d.playerB.setWins[set][0].split('/')[0]);
        });
        document.getElementById('totalSets1').textContent = total1;
        document.getElementById('totalSets2').textContent = total2;

        // Визуализация
        const isFavA = parseFloat(d.playerA.probability) > 50;
        document.getElementById('vizNameFav').textContent = isFavA ? d.playerA.name : d.playerB.name;
        document.getElementById('matchVizFav').textContent = isFavA ? d.playerA.visualization : d.playerB.visualization;
        document.getElementById('vizNameUnd').textContent = isFavA ? d.playerB.name : d.playerA.name;
        document.getElementById('matchVizUnd').textContent = isFavA ? d.playerB.visualization : d.playerA.visualization;

        // H2H
        const h2hVizSection = document.getElementById('h2hVizSection');
        if (d.h2h.total > 0) {
          h2hVizSection.style.display = 'block';
          document.getElementById('h2hFavName').textContent = isFavA ? d.playerA.name : d.playerB.name;
          document.getElementById('h2hViz').textContent = d.h2h.visualization;
        } else {
          h2hVizSection.style.display = 'none';
        }

        results.classList.remove('hidden');
      });
    });
  });
});
