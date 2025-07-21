document.addEventListener('DOMContentLoaded', function() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const error = document.getElementById('error');

    analyzeBtn.addEventListener('click', async function() {
        console.log('🎾 Кнопка анализа нажата');
        
        hideAllSections();
        loading.classList.remove('hidden');
        analyzeBtn.disabled = true;

        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            console.log('📄 Активная вкладка:', tab.url);
            
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'analyze'
            });
            
            console.log('📊 Ответ от content script:', response);

            if (response && response.success) {
                displayResults(response.data);
            } else {
                showError(response?.error || 'Не удалось получить данные для анализа');
            }
        } catch (err) {
            console.error('❌ Ошибка при анализе:', err);
            showError('Ошибка при анализе данных: ' + err.message);
        } finally {
            loading.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    });

    function hideAllSections() {
        loading.classList.add('hidden');
        results.classList.add('hidden');
        error.classList.add('hidden');
    }

    function showError(message) {
        error.querySelector('p').textContent = `❌ Ошибка: ${message}`;
        error.classList.remove('hidden');
    }

    function displayResults(data) {
        console.log('🎯 Отображаем результаты:', data);
        
        // Уровень уверенности
        document.getElementById('confidenceIcon').textContent = data.confidence;
        document.getElementById('confidenceText').textContent = getConfidenceText(data.confidence);

        // Основная таблица
        const tbody = document.getElementById('playersTableBody');
        tbody.innerHTML = '';
        
        data.players.forEach(player => {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = player.name;
            row.insertCell(1).textContent = player.strength;
            row.insertCell(2).textContent = player.probability;
            row.insertCell(3).textContent = player.h2h;
            row.insertCell(4).textContent = player.stability;
        });

        // Показатели силы
        document.getElementById('player1Name2').textContent = data.players[0].name;
        document.getElementById('player2Name2').textContent = data.players[1].name;
        document.getElementById('player1Name5').textContent = data.players[0].name;
        document.getElementById('player2Name5').textContent = data.players[1].name;
        
        document.getElementById('s2games1').textContent = data.strengthIndicators.s2games[0];
        document.getElementById('s2games2').textContent = data.strengthIndicators.s2games[1];
        document.getElementById('s5games1').textContent = data.strengthIndicators.s5games[0];
        document.getElementById('s5games2').textContent = data.strengthIndicators.s5games[1];

        // Вероятности по сетам
        document.getElementById('set1Prob').textContent = data.setProbabilities.set1;
        document.getElementById('set2Prob').textContent = data.setProbabilities.set2;
        document.getElementById('set3Prob').textContent = data.setProbabilities.set3;
        document.getElementById('set4Prob').textContent = data.setProbabilities.set4;

        // Фаворит и рекомендация
        document.getElementById('favoriteInfo').textContent = data.favorite;
        document.getElementById('adviceText').textContent = data.advice;

        // H2H информация
        document.getElementById('h2hInfo').textContent = data.h2hInfo;
        document.getElementById('h2hDryWins').textContent = data.h2hDryWins;

        // Сухие партии
        document.getElementById('dryPlayer1Name').textContent = data.players[0].name;
        document.getElementById('dryPlayer2Name').textContent = data.players[1].name;
        document.getElementById('dryWins1').textContent = data.dryGames.player1.wins;
        document.getElementById('dryLosses1').textContent = data.dryGames.player1.losses;
        document.getElementById('dryWins2').textContent = data.dryGames.player2.wins;
        document.getElementById('dryLosses2').textContent = data.dryGames.player2.losses;

        // Дополнительная информация
        displayAdditionalInfo(data.additionalInfo);

        results.classList.remove('hidden');
    }

    function displayAdditionalInfo(info) {
        const container = document.getElementById('additionalInfoContent');
        container.innerHTML = '';

        if (!info) return;

        const grid = document.createElement('div');
        grid.className = 'additional-grid';

        Object.entries(info).forEach(([key, value]) => {
            const item = document.createElement('div');
            item.className = 'additional-item';
            
            const label = document.createElement('div');
            label.className = 'label';
            label.textContent = key;
            
            const valueDiv = document.createElement('div');
            valueDiv.className = 'value';
            valueDiv.textContent = value;
            
            item.appendChild(label);
            item.appendChild(valueDiv);
            grid.appendChild(item);
        });

        container.appendChild(grid);
    }

    function getConfidenceText(confidence) {
        switch(confidence) {
            case '🟢': return 'Высокая уверенность';
            case '🟡': return 'Средняя уверенность';
            case '🔴': return 'Низкая уверенность';
            default: return 'Неопределенная уверенность';
        }
    }
});
