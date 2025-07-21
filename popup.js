document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const loading    = document.getElementById('loading');
  const results    = document.getElementById('results');
  const error      = document.getElementById('error');

  analyzeBtn.addEventListener('click', async () => {
    loading.classList.remove('hidden');
    analyzeBtn.disabled = true;
    results.classList.add('hidden');
    error.classList.add('hidden');
    try {
      const [tab]    = await chrome.tabs.query({active: true, currentWindow: true});
      const response = await chrome.tabs.sendMessage(tab.id, {action:'analyze'});
      if (response.success) displayResults(response.data);
      else showError(response.error);
    } catch (e) {
      showError(e.message);
    } finally {
      loading.classList.add('hidden');
      analyzeBtn.disabled = false;
    }
  });

  function showError(msg) {
    error.querySelector('p').textContent = `❌ ${msg}`;
    error.classList.remove('hidden');
  }

  function displayResults(data) {
    const name1 = data.players[0].name;
    const name2 = data.players[1].name;

    // top info
    document.getElementById('confidenceIcon').textContent = data.confidence;
    document.getElementById('confidenceText').textContent =
      data.confidence==='🟢'?'Высокая':data.confidence==='🟡'?'Средняя':'Низкая';
    document.getElementById('favoriteText').textContent = data.favorite;

    // main table
    const tbody = document.getElementById('mainTableBody');
    tbody.innerHTML = '';
    data.players.forEach(p => {
      const r = tbody.insertRow();
      r.insertCell(0).textContent = p.name;
      r.insertCell(1).textContent = p.strength;
      r.insertCell(2).textContent = p.probability;
      r.insertCell(3).textContent = p.h2h;
      r.insertCell(4).textContent = p.stability;
    });

    // strength
    ['','','','b'].forEach(suf => {
      document.getElementById(`strengthName1${suf}`)
        .textContent = name1 + ': ';
      document.getElementById(`strengthName2${suf}`)
        .textContent = ' : ' + name2;
    });
    document.getElementById('s2Player1').textContent = data.strengthData.s2[0];
    document.getElementById('s2Player2').textContent = data.strengthData.s2[1];
    document.getElementById('s5Player1').textContent = data.strengthData.s5[0];
    document.getElementById('s5Player2').textContent = data.strengthData.s5[1];

    // sets
    document.getElementById('p1Sets').textContent = name1;
    document.getElementById('p2Sets').textContent = name2;
    const stb = document.getElementById('setsTableBody');
    stb.innerHTML = '';
    ['set1','set2','set3','set4','set5'].forEach((k,i)=>{
      const r = stb.insertRow();
      r.insertCell(0).textContent = (i+1).toString();
      r.insertCell(1).textContent = data.setWins[k][0];
      r.insertCell(2).textContent = data.setWins[k][1];
    });

    // dry games
    ['','b'].forEach(suf => {
      document.getElementById(`dryName1${suf}`).textContent = name1 + ': ';
      document.getElementById(`dryName2${suf}`).textContent = ' : ' + name2;
    });
    document.getElementById('dryWins1').textContent   = data.dryGames.player1.wins;
    document.getElementById('dryWins2').textContent   = data.dryGames.player2.wins;
    document.getElementById('dryLosses1').textContent = data.dryGames.player1.losses;
    document.getElementById('dryLosses2').textContent = data.dryGames.player2.losses;

    // match visualization
    document.getElementById('vizName1').textContent = name1 + ':';
    document.getElementById('vizName2').textContent = name2 + ':';
    document.getElementById('matchViz1').textContent = 
      data.matchVisualizations.player1.replace(/◯/g,'🟢').replace(/⚫/g,'🔴');
    document.getElementById('matchViz2').textContent = 
      data.matchVisualizations.player2.replace(/◯/g,'🟢').replace(/⚫/g,'🔴');

    if (data.matchVisualizations.h2h) {
      document.getElementById('h2hVizSection').style.display = 'block';
      document.getElementById('h2hViz').textContent = 
        data.matchVisualizations.h2h.replace(/◯/g,'🟢').replace(/⚫/g,'🔴');
    }

    // key data
    document.getElementById('labelA').textContent  = name1;
    document.getElementById('labelB').textContent  = name2;
    document.getElementById('labelA2').textContent = name1;
    document.getElementById('labelB2').textContent = name2;
    document.getElementById('h2hTotal').textContent = data.additionalInfo['H2H всего встреч'];
    document.getElementById('h2hPercA').textContent  = data.additionalInfo['Процент побед A в H2H'];
    document.getElementById('h2hPercB').textContent  = data.additionalInfo['Процент побед B в H2H'];
    document.getElementById('h2hDryA').textContent  = data.additionalInfo['H2H сухие победы A'];
    document.getElementById('h2hDryB').textContent  = data.additionalInfo['H2H сухие победы B'];

    results.classList.remove('hidden');
  }
});
