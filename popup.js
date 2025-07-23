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
        displayResults(response.data);
      });
    });
  });

  function displayResults(data) {
    // Топ-инфо
    document.getElementById('confidenceIcon').textContent = getConfidenceIcon(data.prediction.probability);
    document.getElementById('confidenceText').textContent = getConfidenceText(data.prediction.probability);
    document.getElementById('favoriteText').textContent = data.playerA.name; // Замените на логику фаворита

    // Основная таблица
    const mainTableBody = document.getElementById('mainTableBody');
    mainTableBody.innerHTML = '';
    const row1 = `
      <tr>
        <td>${data.playerA.name}</td>
        <td>${data.playerA.strength.toFixed(3)}</td>
        <td>${(data.prediction.probability * 100).toFixed(1)}%</td>
        <td>0-0</td> <!-- Замените на реальные H2H -->
        <td>${data.playerA.stability}%</td>
      </tr>
    `;
    const row2 = `
      <tr>
        <td>${data.playerB.name}</td>
        <td>${data.playerB.strength.toFixed(3)}</td>
        <td>${((1 - data.prediction.probability) * 100).toFixed(1)}%</td>
        <td>0-0</td>
        <td>${data.playerB.stability}%</td>
      </tr>
    `;
    mainTableBody.insertAdjacentHTML('beforeend', row1 + row2);

    // Статистика игрока
    document.getElementById('statName1').textContent = data.playerA.name;
    document.getElementById('statName2').textContent = data.playerB.name;
    document.getElementById('s2Player1').textContent = calcBaseS(data.playerA.games, 2).toFixed(3);
    document.getElementById('s2Player2').textContent = calcBaseS(data.playerB.games, 2).toFixed(3);
    document.getElementById('s5Player1').textContent = data.playerA.strength.toFixed(3);
    document.getElementById('s5Player2').textContent = data.playerB.strength.toFixed(3);
    document.getElementById('dryWins1').textContent = data.playerA.dryGames.wins;
    document.getElementById('dryWins2').textContent = data.playerB.dryGames.wins;
    document.getElementById('dryLosses1').textContent = data.playerA.dryGames.losses;
    document.getElementById('dryLosses2').textContent = data.playerB.dryGames.losses;
    document.getElementById('h2hDryLoss1').textContent = '0'; // Замените на реальные данные из H2H
    document.getElementById('h2hDryLoss2').textContent = '0';

    // Победы в сетах
    document.getElementById('p1Sets').textContent = data.playerA.name;
    document.getElementById('p2Sets').textContent = data.playerB.name;
    const setsTableBody = document.getElementById('setsTableBody');
    setsTableBody.innerHTML = '';
    let total1 = 0, total2 = 0;
    Object.entries(data.playerA.setWins).forEach(([set, [p1, p2]]) => {
      const [wins1, tot1] = p1.split('/');
      const [wins2, tot2] = data.playerB.setWins[set][0].split('/'); // Адаптируйте
      const row = `
        <tr>
          <td>${set.replace('set', '')}</td>
          <td>${p1}</td>
          <td>${data.playerB.setWins[set][0]}</td>
        </tr>
      `;
      setsTableBody.insertAdjacentHTML('beforeend', row);
      total1 += parseInt(wins1);
      total2 += parseInt(wins2);
    });
    document.getElementById('totalSets1').textContent = total1;
    document.getElementById('totalSets2').textContent = total2;

    // Визуализация
    document.getElementById('vizNameFav').textContent = data.playerA.name;
    document.getElementById('matchVizFav').textContent = data.playerA.visualization;
    document.getElementById('vizNameUnd').textContent = data.playerB.name;
    document.getElementById('matchVizUnd').textContent = data.playerB.visualization;
    const h2hVizSection = document.getElementById('h2hVizSection');
    h2hVizSection.style.display = 'none'; // Если нет H2H, скрыть
    // Если есть H2H, раскомментируйте и адаптируйте
    // h2hVizSection.style.display = 'block';
    // document.getElementById('h2hFavName').textContent = data.playerA.name;
    // document.getElementById('h2hViz').textContent = '◯ ⚫ ◯'; // Пример

    results.classList.remove('hidden');
  }

  // Вспомогательные функции (адаптируйте по необходимости)
  function getConfidenceIcon(prob) {
    return prob > 0.7 ? '🟢' : (prob > 0.5 ? '🟡' : '🔴');
  }

  function getConfidenceText(prob) {
    return prob > 0.7 ? 'Высокая уверенность' : (prob > 0.5 ? 'Средняя уверенность' : 'Низкая уверенность');
  }
});
