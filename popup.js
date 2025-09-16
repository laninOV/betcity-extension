document.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const results = document.getElementById('results');

  function formatVisualization(visStr) {
    if (!visStr) return '';
    return [...visStr].map(ch => `<span style="margin-right:4px;">${ch}</span>`).join('');
  }

  function makeRecommendation(d) {
    // Убираем проверку red flags - больше не используем

    const pa = parseFloat(d.playerA.probability);
    const pb = parseFloat(d.playerB.probability);
    const sa = parseFloat(d.playerA.strength);
    const sb = parseFloat(d.playerB.strength);
    const dryA = parseInt(d.playerA.dryWins, 10);
    const dryB = parseInt(d.playerB.dryWins, 10);
    const btA = parseFloat(d.bt_pSetA ?? 0.5);
    const btB = parseFloat(d.bt_pSetB ?? 0.5);
    const btFavorite = d.bt_favorite;
    const btPMatch = parseFloat(d.bt_p_match ?? 0.5);

    const weights = {
      probabilityDiff: 2,
      strengthDiff: 1,
      h2hAdv: 0.5,
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
    const [hA, hB] = d.playerA.h2h.split('-').map(x => parseInt(x, 10));
    if (hA > hB) { scores.A += weights.h2hAdv; reasonsA.push("Лучшие H2H"); }
    if (hB > hA) { scores.B += weights.h2hAdv; reasonsB.push("Лучшие H2H"); }
    if (dryA > dryB + 2) { scores.A += weights.dryWins; reasonsA.push("Чаще выигрывает всухую"); }
    if (dryB > dryA + 2) { scores.B += weights.dryWins; reasonsB.push("Чаще выигрывает всухую"); }
    if (btA > btB + 0.1) { scores.A += weights.btAdv; reasonsA.push("Лучше (BT) по сетам"); }
    if (btB > btA + 0.1) { scores.B += weights.btAdv; reasonsB.push("Лучше (BT) по сетам"); }
    
    // Дополнительный бонус за высокую вероятность матча по BT
    if (btFavorite === d.playerA.name && btPMatch > 0.7) {
      scores.A += 0.3; reasonsA.push("Высокая вероятность по BT модели");
    }
    if (btFavorite === d.playerB.name && btPMatch > 0.7) {
      scores.B += 0.3; reasonsB.push("Высокая вероятность по BT модели");
    }

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

    return { verdictText, favorite, favScore, totalWeight, isRedFlag: false };
  }

  // Убираем блок рекомендаций - больше не используем

  // Betting recommendation function removed - block no longer exists

  function fillTop3Tables(d) {
    const topBTScoresBody = document.getElementById('topBTScoresBody');
    if (topBTScoresBody && d.btScoreProbs && Array.isArray(d.btScoreProbs)) {
      const top3bt = [...d.btScoreProbs]
        .sort((a, b) => {
          const probA = typeof a.probability === 'number' ? a.probability : parseFloat(a.probability) / 100;
          const probB = typeof b.probability === 'number' ? b.probability : parseFloat(b.probability) / 100;
          return probB - probA;
        })
        .slice(0, 3);

      topBTScoresBody.innerHTML = top3bt.map(item => {
        // Обработка вероятности для новой BT модели
        let probability;
        if (typeof item.probability === 'number') {
          probability = (item.probability * 100).toFixed(1);
        } else if (typeof item.label === 'string' && item.label.includes('%')) {
          probability = item.label;
        } else {
          probability = parseFloat(item.probability || 0).toFixed(1) + '%';
        }
        
        return `<tr><td>${item.score}</td><td>${probability}</td></tr>`;
      }).join('');
    }
  }

  function fillMainTable(data) {
    // Заполняем новую таблицу основных показателей
    const mainPlayerA = document.getElementById('mainPlayerA');
    const mainPlayerB = document.getElementById('mainPlayerB');
    const mainStrengthA = document.getElementById('mainStrengthA');
    const mainStrengthB = document.getElementById('mainStrengthB');
    const mainProbabilityA = document.getElementById('mainProbabilityA');
    const mainProbabilityB = document.getElementById('mainProbabilityB');
    const mainH2HA = document.getElementById('mainH2HA');
    const mainH2HB = document.getElementById('mainH2HB');
    const mainStabilityA = document.getElementById('mainStabilityA');
    const mainStabilityB = document.getElementById('mainStabilityB');

    if (mainPlayerA) mainPlayerA.textContent = data.playerA.name;
    if (mainPlayerB) mainPlayerB.textContent = data.playerB.name;
    if (mainStrengthA) mainStrengthA.textContent = data.playerA.strength;
    if (mainStrengthB) mainStrengthB.textContent = data.playerB.strength;
    if (mainProbabilityA) mainProbabilityA.textContent = data.playerA.probability + '%';
    if (mainProbabilityB) mainProbabilityB.textContent = data.playerB.probability + '%';
    if (mainH2HA) mainH2HA.textContent = data.playerA.h2h;
    if (mainH2HB) mainH2HB.textContent = data.playerB.h2h;
    if (mainStabilityA) mainStabilityA.textContent =
      typeof data.playerA.stability === 'number' ? `${data.playerA.stability}%` : '-';
    if (mainStabilityB) mainStabilityB.textContent =
      typeof data.playerB.stability === 'number' ? `${data.playerB.stability}%` : '-';

    // Определяем фаворита для подсветки
    const probA = parseFloat(data.playerA.probability);
    const probB = parseFloat(data.playerB.probability);
    const isFavA = probA > probB;
    
    // Добавляем классы для подсветки фаворита
    if (isFavA) {
      if (mainProbabilityA) mainProbabilityA.className = 'favorite-value';
      if (mainProbabilityB) mainProbabilityB.className = '';
    } else {
      if (mainProbabilityA) mainProbabilityA.className = '';
      if (mainProbabilityB) mainProbabilityB.className = 'favorite-value';
    }
  }

  function fillStatsTables(data) {
    const statName1 = document.getElementById('statName1');
    if (statName1) statName1.textContent = data.playerA.name;
    
    const statName2 = document.getElementById('statName2');
    if (statName2) statName2.textContent = data.playerB.name;
    
    // Преобразуем S₂ и S₅ в более понятный формат
    const formatStrength = (value) => {
      const num = parseFloat(value);
      if (isNaN(num)) return '-';
      if (num > 0) return `+${num.toFixed(3)}`;
      return num.toFixed(3);
    };
    
    const s2Player1 = document.getElementById('s2Player1');
    if (s2Player1) s2Player1.textContent = formatStrength(data.playerA.s2);
    
    const s2Player2 = document.getElementById('s2Player2');
    if (s2Player2) s2Player2.textContent = formatStrength(data.playerB.s2);
    
    const s5Player1 = document.getElementById('s5Player1');
    if (s5Player1) s5Player1.textContent = formatStrength(data.playerA.s5);
    
    const s5Player2 = document.getElementById('s5Player2');
    if (s5Player2) s5Player2.textContent = formatStrength(data.playerB.s5);

    // ⚡ Comeback ability
    const comeback1 = document.getElementById('comeback1');
    if (comeback1) {
      const v = data.playerA.comebackAbility;
      comeback1.textContent = (typeof v === 'number') ? `${v}%` : '-';
    }

    const comeback2 = document.getElementById('comeback2');
    if (comeback2) {
      const v = data.playerB.comebackAbility;
      comeback2.textContent = (typeof v === 'number') ? `${v}%` : '-';
    }

    // Стабильность (новая) удалена из интерфейса

    const dryWins1 = document.getElementById('dryWins1');
    if (dryWins1) dryWins1.textContent = data.playerA.dryWins;
    
    const dryWins2 = document.getElementById('dryWins2');
    if (dryWins2) dryWins2.textContent = data.playerB.dryWins;
    
    const dryLosses1 = document.getElementById('dryLosses1');
    if (dryLosses1) dryLosses1.textContent = data.playerA.dryLosses;
    
    const dryLosses2 = document.getElementById('dryLosses2');
    if (dryLosses2) dryLosses2.textContent = data.playerB.dryLosses;
    
    // Новые метрики - матчи сегодня с цветовой индикацией
    const matchesToday1 = document.getElementById('matchesToday1');
    if (matchesToday1) {
      const todayData = data.playerA.matchesToday;
      if (todayData && typeof todayData === 'object') {
        const winsText = todayData.wins > 0 ? `<span style="color: green; font-weight: bold;">${todayData.wins}</span>` : '';
        const lossesText = todayData.losses > 0 ? `<span style="color: red; font-weight: bold;">${todayData.losses}</span>` : '';
        const parts = [winsText, lossesText].filter(Boolean);
        matchesToday1.innerHTML = `${todayData.total} ${parts.length > 0 ? `(${parts.join('/')})` : ''}`;
      } else {
        matchesToday1.textContent = todayData || 0;
      }
    }
    
    const matchesToday2 = document.getElementById('matchesToday2');
    if (matchesToday2) {
      const todayData = data.playerB.matchesToday;
      if (todayData && typeof todayData === 'object') {
        const winsText = todayData.wins > 0 ? `<span style="color: green; font-weight: bold;">${todayData.wins}</span>` : '';
        const lossesText = todayData.losses > 0 ? `<span style="color: red; font-weight: bold;">${todayData.losses}</span>` : '';
        const parts = [winsText, lossesText].filter(Boolean);
        matchesToday2.innerHTML = `${todayData.total} ${parts.length > 0 ? `(${parts.join('/')})` : ''}`;
      } else {
        matchesToday2.textContent = todayData || 0;
      }
    }
    
    const formatScorePoints = (scorePoints) => {
      if (!scorePoints) return '-';
      const sign = scorePoints.totalPoints >= 0 ? '+' : '';
      return `${sign}${scorePoints.totalPoints} (${scorePoints.averagePoints})`;
    };
    
    const scorePoints1 = document.getElementById('scorePoints1');
    if (scorePoints1) scorePoints1.textContent = formatScorePoints(data.playerA.scorePoints);
    
    const scorePoints2 = document.getElementById('scorePoints2');
    if (scorePoints2) scorePoints2.textContent = formatScorePoints(data.playerB.scorePoints);
  }



  function fillVisualization(data) {
    const isFavA = parseFloat(data.playerA.probability) > 50;
    
    const vizNameFav = document.getElementById('vizNameFav');
    if (vizNameFav) vizNameFav.textContent = isFavA ? data.playerA.name : data.playerB.name;
    
    const vizNameUnd = document.getElementById('vizNameUnd');
    if (vizNameUnd) vizNameUnd.textContent = isFavA ? data.playerB.name : data.playerA.name;
    
    const matchVizFav = document.getElementById('matchVizFav');
    if (matchVizFav) matchVizFav.innerHTML = formatVisualization(isFavA ? data.playerA.visualization : data.playerB.visualization);
    
    const matchVizUnd = document.getElementById('matchVizUnd');
    if (matchVizUnd) matchVizUnd.innerHTML = formatVisualization(isFavA ? data.playerB.visualization : data.playerA.visualization);

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
    
    // Функция для анализа и подсветки высоких показателей
    const analyzeSetPerformance = (value) => {
      if (value === '-' || !value.includes('/')) return { class: '', highlight: false };
      
      const [won, total] = value.split('/').map(Number);
      if (total < 3) return { class: '', highlight: false }; // Мало данных
      
      const winRate = won / total;
      
      // Очень высокие показатели (90%+ при 3+ матчах или 80%+ при 5+ матчах)
      if ((winRate >= 0.9 && total >= 3) || (winRate >= 0.8 && total >= 5)) {
        return { class: 'set-excellent', highlight: true };
      }
      // Хорошие показатели (75%+ при 4+ матчах)
      if (winRate >= 0.75 && total >= 4) {
        return { class: 'set-good', highlight: true };
      }
      // Идеальные показатели (100%)
      if (winRate === 1.0 && total >= 3) {
        return { class: 'set-perfect', highlight: true };
      }
      
      return { class: '', highlight: false };
    };

    // Основные данные по каждому сету с подсветкой
    if (data.playerA.setWins) {
      Object.entries(data.playerA.setWins).forEach(([set, [p1Val]]) => {
        const p2Val = data.playerB.setWins && data.playerB.setWins[set] ? data.playerB.setWins[set][0] : '-';
        
        const p1Analysis = analyzeSetPerformance(p1Val);
        const p2Analysis = analyzeSetPerformance(p2Val);
        
        const p1Class = p1Analysis.class;
        const p2Class = p2Analysis.class;
        
        tbody.insertAdjacentHTML('beforeend', 
          `<tr>
            <td>${set.replace('set', '')}</td>
            <td class="${p1Class}">${p1Val}</td>
            <td class="${p2Class}">${p2Val}</td>
          </tr>`
        );
      });
    }
    
    // H2H данные по каждому сету (если есть)
    if (data.h2h && data.h2h.setWins) {
      // Рассчитываем суммарные H2H показатели
      const h2hP1Total = Object.values(data.h2h.setWins.playerA || {}).reduce((sum, [val]) => {
        const [won, total] = val.split('/').map(Number);
        return sum + (total || 0);
      }, 0);
      const h2hP1Won = Object.values(data.h2h.setWins.playerA || {}).reduce((sum, [val]) => {
        const [won, total] = val.split('/').map(Number);
        return sum + (won || 0);
      }, 0);
      const h2hP2Total = Object.values(data.h2h.setWins.playerB || {}).reduce((sum, [val]) => {
        const [won, total] = val.split('/').map(Number);
        return sum + (total || 0);
      }, 0);
      const h2hP2Won = Object.values(data.h2h.setWins.playerB || {}).reduce((sum, [val]) => {
        const [won, total] = val.split('/').map(Number);
        return sum + (won || 0);
      }, 0);
      
      // Показываем суммарные H2H в заголовочной строке (единый стиль)
      tbody.insertAdjacentHTML('beforeend', `<tr class="h2h-summary-row"><td><strong>H2H</strong></td><td><strong>${h2hP1Won}/${h2hP1Total}</strong></td><td><strong>${h2hP2Won}/${h2hP2Total}</strong></td></tr>`);
      
      Object.entries(data.h2h.setWins.playerA || {}).forEach(([set, [p1Val]]) => {
        const p2Val = data.h2h.setWins.playerB && data.h2h.setWins.playerB[set] ? data.h2h.setWins.playerB[set][0] : '-';
        tbody.insertAdjacentHTML('beforeend', `<tr class="h2h-set-row"><td><strong>${set.replace('set', '')}</strong></td><td><strong>${p1Val}</strong></td><td><strong>${p2Val}</strong></td></tr>`);
      });
    }
  }

  function fillPatternsTable(data) {
    // Заголовки с именами
    const patName1 = document.getElementById('patName1');
    if (patName1) patName1.textContent = data.playerA.name;
    const patName2 = document.getElementById('patName2');
    if (patName2) patName2.textContent = data.playerB.name;

    const fmt = (v) => (v == null ? '-' : `${Math.round(v * 100)}%`);

    const pattern3rd1 = document.getElementById('pattern3rd1');
    if (pattern3rd1) pattern3rd1.textContent = fmt(data.playerA.patterns?.pattern3rd);
    const pattern3rd2 = document.getElementById('pattern3rd2');
    if (pattern3rd2) pattern3rd2.textContent = fmt(data.playerB.patterns?.pattern3rd);

    const after01_1 = document.getElementById('after01_1');
    if (after01_1) after01_1.textContent = fmt(data.playerA.patterns?.after0_1);
    const after01_2 = document.getElementById('after01_2');
    if (after01_2) after01_2.textContent = fmt(data.playerB.patterns?.after0_1);

    const after11_1 = document.getElementById('after11_1');
    if (after11_1) after11_1.textContent = fmt(data.playerA.patterns?.after1_1);
    const after11_2 = document.getElementById('after11_2');
    if (after11_2) after11_2.textContent = fmt(data.playerB.patterns?.after1_1);
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
      
      // Проверяем, что мы на правильной странице
      const tab = tabs[0];
      if (!tab.url || !tab.url.includes('betcity.ru')) {
        setError('Откройте страницу матча на betcity.ru');
        return;
      }
      
      chrome.tabs.sendMessage(tab.id, { action: 'analyze' }, (response) => {
        loading.classList.add('hidden');
        
        // Улучшенная обработка ошибок соединения
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          if (errorMsg.includes('Receiving end does not exist')) {
            setError('Перезагрузите страницу и попробуйте снова');
          } else {
            setError('Ошибка соединения: ' + errorMsg);
          }
          return;
        }
        
        try {
          if (!response || !response.success) {
            throw new Error((response && response.error) || 'Ошибка анализа данных');
          }
          const d = response.data;
          fillTop3Tables(d);
          fillMainTable(d);
          fillStatsTables(d);
          fillVisualization(d);
          fillSetsTable(d);
          fillPatternsTable(d);
          
          // Логирование для отладки новой BT модели
          if (d.bt_favorite) {
            console.log(`BT Фаворит: ${d.bt_favorite}, Вероятность матча: ${(d.bt_p_match * 100).toFixed(1)}%`);
          }
          if (d.bettingStrategy) {
            console.log('Betting Strategy:', d.bettingStrategy);
          }
          if(results) results.classList.remove('hidden');
        } catch (e) {
          setError('Ошибка: ' + e.message);
        }
      });
    });
  }

  launchAnalyze();
});
