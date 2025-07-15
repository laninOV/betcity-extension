// utils.js - Вспомогательные функции для расчетов
export const CONFIG = {
    a1: 1.0,    // вес победы
    a2: 0.5,    // вес соотношения сетов  
    a3: 0.3,    // вес соотношения очков
    a4: 0.2,    // вес форы
    tau: 0.05,  // коэффициент затухания
    fMax: 5.0   // максимальная фора
};

// Функция парсинга даты
export function parseDateString(dateStr) {
    const parts = dateStr.split('.');
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]) + 2000;
    
    const matchDate = new Date(year, month - 1, day);
    const currentDate = new Date(2025, 6, 15); // 15 июля 2025
    const daysAgo = Math.floor((currentDate - matchDate) / (1000 * 60 * 60 * 24));
    
    return { matchDate, daysAgo };
}

// Функция парсинга счета матча
export function parseMatchScore(scoreStr) {
    const scoreMatch = scoreStr.match(/(\d+):(\d+)\s*\(([^)]+)\)/);
    if (!scoreMatch) return null;
    
    const sets1 = parseInt(scoreMatch[1]);
    const sets2 = parseInt(scoreMatch[2]);
    const pointsStr = scoreMatch[3];
    
    const setScores = [];
    pointsStr.split(',').forEach(setScore => {
        setScore = setScore.trim();
        if (setScore.includes(':')) {
            const [p1, p2] = setScore.split(':').map(p => parseInt(p));
            setScores.push([p1, p2]);
        }
    });
    
    return { sets1, sets2, setScores };
}

// Функция расчета силы игрока
export function calculatePlayerStrength(matches, config = CONFIG) {
    if (!matches || matches.length === 0) return 0;
    
    let numerator = 0;
    let denominator = 0;
    
    matches.forEach(match => {
        // Экспоненциальный вес по времени
        const wi = Math.exp(-config.tau * match.daysAgo);
        
        // Компоненты формулы
        const setsRatio = (match.setsWon + match.setsLost) > 0 ? 
            (match.setsWon - match.setsLost) / (match.setsWon + match.setsLost) : 0;
        
        const pointsRatio = (match.pointsWon + match.pointsLost) > 0 ? 
            Math.tanh((match.pointsWon - match.pointsLost) / (match.pointsWon + match.pointsLost)) : 0;
        
        const handicapNorm = Math.max(-1, Math.min(1, match.handicap / config.fMax));
        
        // Вклад матча Mi
        const Mi = config.a1 * match.win + 
                  config.a2 * setsRatio + 
                  config.a3 * pointsRatio + 
                  config.a4 * handicapNorm;
        
        numerator += wi * Mi;
        denominator += wi;
    });
    
    return denominator > 0 ? numerator / denominator : 0;
}

// Функция экспорта в CSV
export function exportToCSV(playersData) {
    const headers = ['Игрок', 'Сила', 'Матчей', 'Побед', 'Поражений'];
    const rows = playersData.map(player => [
        player.name,
        player.strength.toFixed(3),
        player.matches.length,
        player.matches.filter(m => m.win === 1).length,
        player.matches.filter(m => m.win === 0).length
    ]);
    
    const csvContent = [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `betcity_stats_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// Функция получения конфигурации из storage
export function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['config'], (result) => {
            resolve(result.config || CONFIG);
        });
    });
}

// Функция сохранения конфигурации
export function saveConfig(config) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ config: config }, resolve);
    });
}
