document.addEventListener('DOMContentLoaded', function() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const error = document.getElementById('error');

    analyzeBtn.addEventListener('click', async function() {
        console.log('Кнопка анализа нажата');
        
        // Скрываем все секции
        hideAllSections();
        
        // Показываем загрузку
        loading.classList.remove('hidden');
        analyzeBtn.disabled = true;

        try {
            // Получаем активную вкладку
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            console.log('Активная вкладка:', tab.url);
            
            // Отправляем сообщение content script для анализа
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'analyze'
            });
            
            console.log('Ответ от content script:', response);

            if (response && response.success) {
                displayResults(response.data);
            } else {
                showError(response?.error || 'Не удалось получить данные для анализа');
            }
        } catch (err) {
            console.error('Ошибка при анализе:', err);
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
        console.log('Отображаем результаты:', data);
        
        // Отображаем уровень уверенности
        document.getElementById('confidenceIcon').textContent = data.confidence;
        document.getElementById('confidenceText').textContent = getConfidenceText(data.confidence);

        // Заполняем таблицу сравнения
        const tbody = document.getElementById('playersTableBody');
        tbody.innerHTML = '';
        
        data.players.forEach(player => {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = player.name;
            row.insertCell(1).textContent = player.strength;
            row.insertCell(2).textContent = player.probability;
            row.insertCell(3).textContent = player.h2h;
            row.insertCell(4).textContent = player.variance || '-';
        });

        // Показываем фаворита
        document.getElementById('favoriteInfo').textContent = data.favorite;

        // Показываем рекомендацию
        document.getElementById('adviceText').textContent = data.advice;

        // Показываем H2H информацию
        document.getElementById('h2hInfo').textContent = data.h2hInfo || 'Нет данных о личных встречах';

        // Показываем детальную статистику
        displayDetailedStats(data.detailedStats);

        // Показываем дополнительную информацию
        displayAdditionalInfo(data.additionalInfo);

        results.classList.remove('hidden');
    }

    function displayDetailedStats(stats) {
        const container = document.getElementById('detailedStatsContent');
        container.innerHTML = '';

        stats.forEach(playerStats => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-stats';
            
            const playerName = document.createElement('div');
            playerName.className = 'player-name';
            playerName.textContent = playerStats.player;
            playerDiv.appendChild(playerName);

            const statsGrid = document.createElement('div');
            statsGrid.className = 'stats-grid';
            
            playerStats.games.forEach(game => {
                const statItem = document.createElement('div');
                statItem.className = 'stat-item';
                statItem.textContent = game;
                statsGrid.appendChild(statItem);
            });

            playerDiv.appendChild(statsGrid);
            container.appendChild(playerDiv);
        });
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
