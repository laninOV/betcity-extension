document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const loading    = document.getElementById('loading');
  const results    = document.getElementById('results');
  const errorBlock = document.getElementById('error');

  analyzeBtn.addEventListener('click', async () => {
    loading.classList.remove('hidden');
    analyzeBtn.disabled = true;
    results.classList.add('hidden');
    errorBlock.classList.add('hidden');

    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      const {success, data, error} = await chrome.tabs.sendMessage(tab.id, {action: 'analyze'});
      success ? displayResults(data) : showError(error);
    } catch (e) {
      showError(e.message);
    } finally {
      loading.classList.add('hidden');
      analyzeBtn.disabled = false;
    }
  });

  function showError(msg) {
    errorBlock.querySelector('p').textContent = `❌ ${msg}`;
    errorBlock.classList.remove('hidden');
  }

  function displayResults(d) {
    const [A, B] = d.players;
    const fav    = d.favorite === A.name ? A : B;
    const und    = fav === A ? B : A;
    const favA   = fav === A;

    // Верхняя часть
    document.getElementById('confidenceIcon').textContent = d.confidence;
    document.getElementById('confidenceText').textContent =
      d.confidence === '🟢' ? 'Высокая' :
      d.confidence === '🟡' ? 'Средняя' : 'Низкая';
    document.getElementById('favoriteText').textContent = fav.name;

    // Основная таблица
    const mt = document.getElementById('mainTableBody');
    mt.innerHTML = '';
    [A, B].forEach(p => {
      const row = mt.insertRow();
      row.insertCell(0).textContent = p.name;
      row.insertCell(1).textContent = p.strength;
      row.insertCell(2).textContent = p.probability;
      row.insertCell(3).textContent = p.h2h;
      row.insertCell(4).textContent = p.stability;
    });

    // 📊 Статистика игрока
    document.getElementById('statName1').textContent = A.name;
    document.getElementById('statName2').textContent = B.name;
    document.getElementById('s2Player1').textContent  = d.strengthData.s2[0];
    document.getElementById('s2Player2').textContent  = d.strengthData.s2[1];
    document.getElementById('s5Player1').textContent  = d.strengthData.s5[0];
    document.getElementById('s5Player2').textContent  = d.strengthData.s5[1];
    document.getElementById('dryWins1').textContent   = d.dryGames.player1.wins;
    document.getElementById('dryWins2').textContent   = d.dryGames.player2.wins;
    document.getElementById('dryLosses1').textContent = d.dryGames.player1.losses;
    document.getElementById('dryLosses2').textContent = d.dryGames.player2.losses;

    // H2H сухие поражения
    const add = d.additionalInfo;
    const lossA = add['H2H сухие поражения A'] || '0';
    const lossB = add['H2H сухие поражения B'] || '0';
    document.getElementById('h2hDryLoss1').textContent = favA ? lossA : lossB;
    document.getElementById('h2hDryLoss2').textContent = favA ? lossB : lossA;

    // 🎯 Победы в сетах + итоги
    document.getElementById('p1Sets').textContent = A.name;
    document.getElementById('p2Sets').textContent = B.name;
    const stb = document.getElementById('setsTableBody');
    stb.innerHTML = '';
    let sum1 = 0, sum2 = 0;
    ['set1','set2','set3','set4','set5'].forEach((k,i) => {
      const row = stb.insertRow();
      const v1 = d.setWins[k][0], v2 = d.setWins[k][1];
      row.insertCell(0).textContent = (i+1).toString();
      row.insertCell(1).textContent = v1;
      row.insertCell(2).textContent = v2;
      sum1 += parseInt(v1, 10);
      sum2 += parseInt(v2, 10);
    });
    document.getElementById('totalSets1').textContent = sum1.toString();
    document.getElementById('totalSets2').textContent = sum2.toString();

    // 🎲 Визуализация H2H относительно фаворита
    document.getElementById('vizNameFav').textContent = fav.name + ':';
    document.getElementById('vizNameUnd').textContent = und.name + ':';
    document.getElementById('matchVizFav').textContent =
      d.matchVisualizations[favA ? 'player1' : 'player2']
        .replace(/◯/g,'🟢').replace(/⚫/g,'🔴');
    document.getElementById('matchVizUnd').textContent =
      d.matchVisualizations[favA ? 'player2' : 'player1']
        .replace(/◯/g,'🟢').replace(/⚫/g,'🔴');

    if (d.matchVisualizations.h2h) {
      document.getElementById('h2hVizSection').style.display = 'block';
      document.getElementById('h2hFavName').textContent = fav.name;
      let viz = d.matchVisualizations.h2h;
      if (!favA) viz = viz.replace(/◯/g,'🔄').replace(/⚫/g,'◯').replace(/🔄/g,'⚫');
      document.getElementById('h2hViz').textContent = viz.replace(/◯/g,'🟢').replace(/⚫/g,'🔴');
    }

    results.classList.remove('hidden');
  }
});
