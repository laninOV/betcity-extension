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

      topBTScoresBody.innerHTML = top3bt.map((item) => {
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
    const mainH2HA = document.getElementById('mainH2HA');
    const mainH2HB = document.getElementById('mainH2HB');
    const mainStabilityA = document.getElementById('mainStabilityA');
    const mainStabilityB = document.getElementById('mainStabilityB');

    if (mainPlayerA) mainPlayerA.textContent = data.playerA.name;
    if (mainPlayerB) mainPlayerB.textContent = data.playerB.name;
    if (mainStrengthA) mainStrengthA.textContent = data.playerA.strength;
    if (mainStrengthB) mainStrengthB.textContent = data.playerB.strength;
    if (mainH2HA) mainH2HA.textContent = data.playerA.h2h;
    if (mainH2HB) mainH2HB.textContent = data.playerB.h2h;
    // Стабильность приходит как 0..1 — приведём к % и округлим
    const fmtStab = (val) => {
      if (typeof val !== 'number' || isNaN(val)) return '-';
      const v = (val <= 1 ? val * 100 : val);
      return `${Math.round(v)}%`;
    };
    if (mainStabilityA) mainStabilityA.textContent = fmtStab(data.playerA.stability);
    if (mainStabilityB) mainStabilityB.textContent = fmtStab(data.playerB.stability);

    // Убрали показатель "Вероятность" из основных — подсветки больше нет

    // Подсветка: жёлтая — явное преимущество, красная — слабая сторона/риск
    const clearHL = (el) => {
      if (!el) return;
      el.classList.remove('metric-highlight');
      el.classList.remove('metric-bad');
      el.classList.remove('favorite-value');
    };

    // Сила: разница >= 12 пунктов (0..100)
    const strA = parseFloat(data.playerA.strength);
    const strB = parseFloat(data.playerB.strength);
    clearHL(mainStrengthA); clearHL(mainStrengthB);
    if (!isNaN(strA) && !isNaN(strB)) {
      if (strA - strB >= 12) {
        if (mainStrengthA) mainStrengthA.classList.add('metric-highlight');
        if (mainStrengthB) mainStrengthB.classList.add('metric-bad');
      } else if (strB - strA >= 12) {
        if (mainStrengthB) mainStrengthB.classList.add('metric-highlight');
        if (mainStrengthA) mainStrengthA.classList.add('metric-bad');
      }
    }

    // Стабильность: разница >= 15 п.п.
    const rawStabA = parseFloat(data.playerA.stability);
    const rawStabB = parseFloat(data.playerB.stability);
    const stabA = isNaN(rawStabA) ? NaN : (rawStabA <= 1 ? rawStabA * 100 : rawStabA);
    const stabB = isNaN(rawStabB) ? NaN : (rawStabB <= 1 ? rawStabB * 100 : rawStabB);
    clearHL(mainStabilityA); clearHL(mainStabilityB);
    if (!isNaN(stabA) && !isNaN(stabB)) {
      const lowStabTh = 40; // низкая стабильность < 40%
      if (stabA < lowStabTh && mainStabilityA) mainStabilityA.classList.add('metric-bad');
      if (stabB < lowStabTh && mainStabilityB) mainStabilityB.classList.add('metric-bad');
      if (stabA - stabB >= 15) {
        if (mainStabilityA) mainStabilityA.classList.add('metric-highlight');
        if (mainStabilityB) mainStabilityB.classList.add('metric-bad');
      } else if (stabB - stabA >= 15) {
        if (mainStabilityB) mainStabilityB.classList.add('metric-highlight');
        if (mainStabilityA) mainStabilityA.classList.add('metric-bad');
      }
    }

    // H2H: преимущество >= 3 побед
    clearHL(mainH2HA); clearHL(mainH2HB);
    try {
      const [hA, hB] = (data.playerA.h2h || '0-0').split('-').map(x => parseInt(x, 10));
      if ((hA - hB) >= 3) {
        if (mainH2HA) mainH2HA.classList.add('metric-highlight');
        if (mainH2HB) mainH2HB.classList.add('metric-bad');
      } else if ((hB - hA) >= 3) {
        if (mainH2HB) mainH2HB.classList.add('metric-highlight');
        if (mainH2HA) mainH2HA.classList.add('metric-bad');
      }
    } catch (_) {}
  }

  function fillStatsTables(data) {
    const statName1 = document.getElementById('statName1');
    if (statName1) statName1.textContent = data.playerA.name;
    
    const statName2 = document.getElementById('statName2');
    if (statName2) statName2.textContent = data.playerB.name;
    
    // Преобразуем S₂ и S₅ к новой шкале 0..100
    const formatStrength = (value) => {
      const num = parseFloat(value);
      if (isNaN(num)) return '-';
      return String(Math.round(num));
    };
    
    const s2Player1 = document.getElementById('s2Player1');
    if (s2Player1) s2Player1.textContent = formatStrength(data.playerA.s2);
    
    const s2Player2 = document.getElementById('s2Player2');
    if (s2Player2) s2Player2.textContent = formatStrength(data.playerB.s2);
    
    const s5Player1 = document.getElementById('s5Player1');
    if (s5Player1) s5Player1.textContent = formatStrength(data.playerA.s5);
    const s5Player2 = document.getElementById('s5Player2');
    if (s5Player2) s5Player2.textContent = formatStrength(data.playerB.s5);

    // Универсальная подсветка различий (зелёный >=40%, жёлтый >=20%, красный — сильно ниже)
    (function() {
      const clearPair = (a, b) => {
        [a, b].forEach(el => {
          if (!el) return;
          el.classList.remove('metric-good','metric-highlight','metric-bad');
        });
      };
      const compareAndColor = (elA, elB, valA, valB, { scale = 'percent', higherBetter = true, green = 0.40, yellow = 0.20 } = {}) => {
        const a = parseFloat(valA); const b = parseFloat(valB);
        if (isNaN(a) || isNaN(b)) return;
        let x = a, y = b;
        if (!higherBetter) { x = -a; y = -b; }
        // Нормализуем к 0..1 для процентных метрик
        const norm = (v) => scale === 'percent' ? Math.max(0, Math.min(1, v / 100)) : v;
        const nx = norm(x), ny = norm(y);
        const betterIsA = nx >= ny;
        const maxv = Math.max(Math.abs(nx), Math.abs(ny), 1e-6);
        const diffRatio = Math.abs(nx - ny) / maxv; // симметричная относительная разница
        if (diffRatio >= green) {
          (betterIsA ? elA : elB)?.classList.add('metric-good');
          (betterIsA ? elB : elA)?.classList.add('metric-bad');
        } else if (diffRatio >= yellow) {
          (betterIsA ? elA : elB)?.classList.add('metric-highlight');
        }
      };

      // S2/S5 — больше = лучше
      clearPair(s2Player1, s2Player2);
      clearPair(s5Player1, s5Player2);
      compareAndColor(s2Player1, s2Player2, data.playerA.s2, data.playerB.s2, { scale: 'percent', higherBetter: true });
      compareAndColor(s5Player1, s5Player2, data.playerA.s5, data.playerB.s5, { scale: 'percent', higherBetter: true });
    })();

    // ⚡ Comeback ability (процент, сравнение A vs B)
    const comeback1 = document.getElementById('comeback1');
    const comeback2 = document.getElementById('comeback2');
    const cA = (typeof data.playerA.comebackAbility === 'number') ? data.playerA.comebackAbility : null;
    const cB = (typeof data.playerB.comebackAbility === 'number') ? data.playerB.comebackAbility : null;
    if (comeback1) comeback1.textContent = (cA != null) ? `${cA}%` : '-';
    if (comeback2) comeback2.textContent = (cB != null) ? `${cB}%` : '-';
    if (comeback1 && comeback2 && cA != null && cB != null) {
      [comeback1, comeback2].forEach(el => { el.classList.remove('metric-good','metric-highlight','metric-bad'); });
      // больше = лучше
      const betterIsA = (cA >= cB);
      const maxv = Math.max(Math.abs(cA), Math.abs(cB), 1e-6);
      const diffRatio = Math.abs(cA - cB) / maxv;
      if (diffRatio >= 0.40) {
        (betterIsA ? comeback1 : comeback2).classList.add('metric-good');
        (betterIsA ? comeback2 : comeback1).classList.add('metric-bad');
      } else if (diffRatio >= 0.20) {
        (betterIsA ? comeback1 : comeback2).classList.add('metric-highlight');
      }
    }

    // Стабильность (новая) удалена из интерфейса

    const dryWins1 = document.getElementById('dryWins1');
    if (dryWins1) {
      dryWins1.textContent = data.playerA.dryWins;
      dryWins1.classList.remove('metric-highlight');
      dryWins1.classList.remove('metric-bad');
      if ((+data.playerA.dryWins || 0) >= 3) dryWins1.classList.add('metric-highlight');
    }
    
    const dryWins2 = document.getElementById('dryWins2');
    if (dryWins2) {
      dryWins2.textContent = data.playerB.dryWins;
      dryWins2.classList.remove('metric-highlight');
      dryWins2.classList.remove('metric-bad');
      if ((+data.playerB.dryWins || 0) >= 3) dryWins2.classList.add('metric-highlight');
    }
    
    const dryLosses1 = document.getElementById('dryLosses1');
    if (dryLosses1) {
      dryLosses1.textContent = data.playerA.dryLosses;
      dryLosses1.classList.remove('metric-highlight');
      dryLosses1.classList.remove('metric-bad');
      if ((+data.playerA.dryLosses || 0) >= 3) dryLosses1.classList.add('metric-bad');
    }
    
    const dryLosses2 = document.getElementById('dryLosses2');
    if (dryLosses2) {
      dryLosses2.textContent = data.playerB.dryLosses;
      dryLosses2.classList.remove('metric-highlight');
      dryLosses2.classList.remove('metric-bad');
      if ((+data.playerB.dryLosses || 0) >= 3) dryLosses2.classList.add('metric-bad');
    }
    
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

    // Доп. подсветка: матчи сегодня и очковые баллы (без изменения содержимого)
    // matchesToday1/2
    (function() {
      const el1 = document.getElementById('matchesToday1');
      const el2 = document.getElementById('matchesToday2');
      const t1 = data.playerA.matchesToday;
      const t2 = data.playerB.matchesToday;
      if (el1 && t1 && typeof t1 === 'object') {
        el1.classList.remove('metric-highlight');
        el1.classList.remove('metric-bad');
        if ((t1.total || 0) >= 3 || (t1.losses || 0) >= 2) el1.classList.add('metric-bad');
        else if ((t1.wins || 0) >= 2) el1.classList.add('metric-highlight');
      }
      if (el2 && t2 && typeof t2 === 'object') {
        el2.classList.remove('metric-highlight');
        el2.classList.remove('metric-bad');
        if ((t2.total || 0) >= 3 || (t2.losses || 0) >= 2) el2.classList.add('metric-bad');
        else if ((t2.wins || 0) >= 2) el2.classList.add('metric-highlight');
      }
    })();

    // Последняя игра (дней назад)
    (function() {
      const lastGame1 = document.getElementById('lastGame1');
      const lastGame2 = document.getElementById('lastGame2');
      const fmtDays = (n) => {
        if (n == null || isNaN(n)) return '-';
        const d = Math.max(0, parseInt(n, 10));
        const lastTwo = d % 100;
        const lastOne = d % 10;
        let word = 'дней';
        if (lastTwo < 11 || lastTwo > 14) {
          if (lastOne === 1) word = 'день';
          else if (lastOne >= 2 && lastOne <= 4) word = 'дня';
        }
        return `${d} ${word}`;
      };
      if (lastGame1) lastGame1.textContent = fmtDays(data.playerA.lastGameDays);
      if (lastGame2) lastGame2.textContent = fmtDays(data.playerB.lastGameDays);
    })();

    // scorePoints1/2 — подсветка по разнице totalPoints (только когда знаки разные)
    (function() {
      const sp1 = document.getElementById('scorePoints1');
      const sp2 = document.getElementById('scorePoints2');
      if (!sp1 || !sp2) return;
      const clear = (el) => el && el.classList.remove(
        'metric-highlight','metric-bad','metric-green-light','metric-green-strong','metric-danger'
      );
      clear(sp1); clear(sp2);

      const tp1 = parseInt(data.playerA?.scorePoints?.totalPoints, 10);
      const tp2 = parseInt(data.playerB?.scorePoints?.totalPoints, 10);
      if (isNaN(tp1) || isNaN(tp2)) return;

      const bothPositive = tp1 > 0 && tp2 > 0;
      const bothNegative = tp1 < 0 && tp2 < 0;
      const oppositeSign = (tp1 > 0 && tp2 < 0) || (tp1 < 0 && tp2 > 0);

      if (bothPositive || bothNegative) {
        // оба + или оба - — ярко красное, не рассматриваем
        sp1.classList.add('metric-danger');
        sp2.classList.add('metric-danger');
        return;
      }

      // Считаем разницу только когда знаки строго разные (+/-)
      if (!oppositeSign) return;
      const diff = Math.abs(tp1 - tp2);
      if (diff >= 10) {
        const p1IsBetter = tp1 > tp2; // положительный больше отрицательного
        const winEl = p1IsBetter ? sp1 : sp2;
        // 10..11.99 — светло-зеленый, >=12 — темно-зеленый
        if (diff >= 12) {
          winEl.classList.add('metric-green-strong');
        } else {
          winEl.classList.add('metric-green-light');
        }
      }
    })();
  }



  function fillVisualization(data) {
    // Визуализацию показываем строго в порядке таблиц статистики:
    // первая строка — Player A, вторая — Player B.
    const vizNameFav = document.getElementById('vizNameFav');
    if (vizNameFav) vizNameFav.textContent = data.playerA.name;

    const vizNameUnd = document.getElementById('vizNameUnd');
    if (vizNameUnd) vizNameUnd.textContent = data.playerB.name;

    const matchVizFav = document.getElementById('matchVizFav');
    if (matchVizFav) matchVizFav.innerHTML = formatVisualization(data.playerA.visualization);

    const matchVizUnd = document.getElementById('matchVizUnd');
    if (matchVizUnd) matchVizUnd.innerHTML = formatVisualization(data.playerB.visualization);

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
    const clearHL = (el) => { if (el) { el.classList.remove('metric-highlight'); el.classList.remove('metric-bad'); } };
    const applyHL = (el, v) => {
      if (!el) return;
      clearHL(el);
      if (v == null) return;
      if (v >= 0.6) el.classList.add('metric-highlight');
      if (v <= 0.35) el.classList.add('metric-bad');
    };

    const pattern3rd1 = document.getElementById('pattern3rd1');
    const p3a = data.playerA.patterns?.pattern3rd ?? null;
    if (pattern3rd1) pattern3rd1.textContent = fmt(p3a);
    applyHL(pattern3rd1, p3a);
    const pattern3rd2 = document.getElementById('pattern3rd2');
    const p3b = data.playerB.patterns?.pattern3rd ?? null;
    if (pattern3rd2) pattern3rd2.textContent = fmt(p3b);
    applyHL(pattern3rd2, p3b);

    const after01_1 = document.getElementById('after01_1');
    const p01a = data.playerA.patterns?.after0_1 ?? null;
    if (after01_1) after01_1.textContent = fmt(p01a);
    applyHL(after01_1, p01a);
    const after01_2 = document.getElementById('after01_2');
    const p01b = data.playerB.patterns?.after0_1 ?? null;
    if (after01_2) after01_2.textContent = fmt(p01b);
    applyHL(after01_2, p01b);

    const after11_1 = document.getElementById('after11_1');
    const p11a = data.playerA.patterns?.after1_1 ?? null;
    if (after11_1) after11_1.textContent = fmt(p11a);
    applyHL(after11_1, p11a);
    const after11_2 = document.getElementById('after11_2');
    const p11b = data.playerB.patterns?.after1_1 ?? null;
    if (after11_2) after11_2.textContent = fmt(p11b);
    applyHL(after11_2, p11b);
  }

  function fillNonBTProbability(data) {
    const aNameEl = document.getElementById('probNoBtNameA');
    const bNameEl = document.getElementById('probNoBtNameB');
    const aValEl = document.getElementById('probNoBtA');
    const bValEl = document.getElementById('probNoBtB');
    if (aNameEl) aNameEl.textContent = data.playerA.name;
    if (bNameEl) bNameEl.textContent = data.playerB.name;
    let a = data.playerA?.nonBTProbability;
    let b = data.playerB?.nonBTProbability;
    // Фоллбэк: если nonBTProbability не пришла, используем общую вероятность из модели (без BT)
    if (a == null || isNaN(parseFloat(a))) a = data.playerA?.probability;
    if (b == null || isNaN(parseFloat(b))) b = data.playerB?.probability;
    if (aValEl) aValEl.textContent = (a != null && !isNaN(parseFloat(a))) ? (parseFloat(a).toFixed(1) + '%') : '-';
    if (bValEl) bValEl.textContent = (b != null && !isNaN(parseFloat(b))) ? (parseFloat(b).toFixed(1) + '%') : '-';
  }

  function fillCommonOpponents(data) {
    const block = document.getElementById('commonOppBlock');
    const summaryEl = document.getElementById('commonOppSummary');
    const nameA = document.getElementById('commonOppNameA');
    const nameB = document.getElementById('commonOppNameB');
    const tbody = document.getElementById('commonOppTableBody');

    if (nameA) nameA.textContent = data.playerA.name;
    if (nameB) nameB.textContent = data.playerB.name;

    const items = data.commonOpponents || [];
    if (!items.length) {
      if (block) block.style.display = 'none';
      return;
    }
    if (block) block.style.display = '';

    if (summaryEl) summaryEl.textContent = data.commonOppSummary || '';
    if (tbody) tbody.innerHTML = '';

    const fmtRow = (o) => {
      const pts = (o.pointsDiff > 0 ? '+' : '') + (o.pointsDiff || 0);
      return `${o.wins}-${o.losses} (сеты ${o.setsWon}-${o.setsLost}, очки ${pts})`;
    };

    items.forEach(row => {
      const adv = row.advantage;
      const aCellClass = adv === 'A' ? 'metric-highlight' : (adv === 'B' ? 'metric-bad' : '');
      const bCellClass = adv === 'B' ? 'metric-highlight' : (adv === 'A' ? 'metric-bad' : '');
      const advLabel = adv === 'A' ? data.playerA.name : (adv === 'B' ? data.playerB.name : '—');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.opponent}</td>
        <td class="${aCellClass}">${fmtRow(row.a)}</td>
        <td class="${bCellClass}">${fmtRow(row.b)}</td>
        <td>${advLabel}</td>
      `;
      tbody && tbody.appendChild(tr);
    });
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
          fillNonBTProbability(d);
          fillVisualization(d);
          fillSetsTable(d);
          fillPatternsTable(d);
          fillCommonOpponents(d);
          
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
