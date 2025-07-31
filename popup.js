let analysisData = null;

// Tab switching
function showTab(tabName) {
  // Remove active from all tabs and contents
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  // Add active to clicked tab and corresponding content
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(tabName).classList.add('active');
}

// Initialize analysis
async function initAnalysis() {
  try {
    console.log('Starting analysis...');
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Current tab:', tab.url);
    
    const response = await chrome.tabs.sendMessage(tab.id, { action: "analyze" });
    console.log('Response received:', response);
    
    if (!response) {
      showError("Нет ответа от content script. Убедитесь, что вы на правильной странице.");
      return;
    }
    
    if (!response.success) {
      showError(response.error || "Неизвестная ошибка при анализе");
      return;
    }
    
    analysisData = response.data;
    displayResults();
    
  } catch (error) {
    console.error('Analysis error:', error);
    showError("Ошибка при анализе: " + error.message);
  }
}

function showError(message) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'block';
  document.getElementById('error').textContent = message;
}

function displayResults() {
  console.log('Displaying results:', analysisData);
  
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
  
  const data = analysisData;
  
  // Match header
  document.getElementById('matchTitle').textContent = 
    `${data.playerA.name} vs ${data.playerB.name}`;
  document.getElementById('confidence').textContent = data.confidence || "🟡";
  
  // Players
  displayPlayer('A', data.playerA);
  displayPlayer('B', data.playerB);
  
  // Mark favorite
  if (data.favorite === data.playerA.name) {
    document.getElementById('playerA').classList.add('favorite');
  } else {
    document.getElementById('playerB').classList.add('favorite');
  }
  
  // Win probability
  const winProbA = parseFloat(data.playerA.probability);
  const winProbB = parseFloat(data.playerB.probability);
  const maxProb = Math.max(winProbA, winProbB);
  const favoritePlayer = winProbA > winProbB ? data.playerA.name : data.playerB.name;
  
  document.getElementById('winProbability').textContent = 
    `${favoritePlayer} ${maxProb.toFixed(1)}%`;
  
  // Ensemble results
  if (data.advancedPrediction) {
    const ensemble = data.advancedPrediction.ensemble;
    const confidence = data.advancedPrediction.confidence;
    
    document.getElementById('ensembleValue').textContent = 
      `${(ensemble * 100).toFixed(1)}%`;
    document.getElementById('ensembleConfidence').textContent = 
      `Уверенность: ${(confidence * 100).toFixed(1)}%`;
  } else {
    document.getElementById('ensembleValue').textContent = 'Не доступно';
    document.getElementById('ensembleConfidence').textContent = 'Данные отсутствуют';
  }
  
  // Predicted scores
  displayPredictedScores(data.predictedScores);
  
  // Methods
  displayMethods(data.advancedPrediction?.predictions);
  
  // Details
  displayDetails(data);
}

function displayPlayer(letter, player) {
  document.getElementById(`player${letter}Name`).textContent = player.name;
  document.getElementById(`player${letter}Viz`).textContent = player.visualization || '';
  
  const statsContainer = document.getElementById(`player${letter}Stats`);
  statsContainer.innerHTML = `
    <div class="stat">
      <span>Сила:</span>
      <span>${player.strength}</span>
    </div>
    <div class="stat">
      <span>Вероятность:</span>
      <span>${player.probability}%</span>
    </div>
    <div class="stat">
      <span>H2H:</span>
      <span>${player.h2h}</span>
    </div>
    <div class="stat">
      <span>Стабильность:</span>
      <span>${player.stability}%</span>
    </div>
  `;
}

function displayPredictedScores(scores) {
  const container = document.getElementById('predictedScores');
  if (!scores || !Array.isArray(scores)) {
    container.innerHTML = '<div>Нет данных о счетах</div>';
    return;
  }
  
  container.innerHTML = scores.slice(0, 6).map(score => `
    <div class="score-item">
      <div class="score-value">${score.score}</div>
      <div class="score-prob">${score.probability}</div>
    </div>
  `).join('');
}

function displayMethods(predictions) {
  const methodsGrid = document.getElementById('methodsGrid');
  
  if (!predictions) {
    methodsGrid.innerHTML = '<div>Методы прогнозирования недоступны</div>';
    return;
  }
  
  const methodNames = {
    bradleyTerry: 'Bradley-Terry',
    elo: 'Elo Rating',
    glicko: 'Glicko',
    trueSkill: 'TrueSkill',
    bayesian: 'Bayesian',
    logistic: 'Logistic Reg.',
    markov: 'Markov Chain',
    poisson: 'Poisson'
  };
  
  // Grid display
  methodsGrid.innerHTML = Object.entries(predictions).map(([method, prob]) => `
    <div class="method-card ${method}">
      <div class="method-header">${methodNames[method] || method}</div>
      <div class="method-probability">${(prob * 100).toFixed(1)}%</div>
    </div>
  `).join('');
}

function displayDetails(data) {
  const detailsContent = document.getElementById('detailsContent');
  
  let html = '<div style="display: grid; gap: 15px;">';
  
  // Advanced Score Info
  if (data.advancedScore) {
    html += `
      <div class="method-card">
        <div class="method-header">Ожидаемый тотал очков</div>
        <div class="method-probability">${data.advancedScore.expectedTotal.toFixed(1)}</div>
      </div>
      <div class="method-card">
        <div class="method-header">Вероятность >74.5 очков</div>
        <div class="method-probability">${(data.advancedScore.probOver74_5 * 100).toFixed(1)}%</div>
      </div>
    `;
    
    if (data.advancedScore.mostLikelyScore) {
      html += `
        <div class="method-card">
          <div class="method-header">Наиболее вероятный счет</div>
          <div class="method-probability">${data.advancedScore.mostLikelyScore.scoreA}-${data.advancedScore.mostLikelyScore.scoreB}</div>
        </div>
      `;
    }
  }
  
  // H2H info
  if (data.h2h) {
    html += `
      <div class="method-card">
        <div class="method-header">Всего личных встреч</div>
        <div class="method-probability">${data.h2h.total}</div>
      </div>
    `;
  }
  
  html += '</div>';
  detailsContent.innerHTML = html;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup loaded');
  
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = e.target.getAttribute('data-tab');
      showTab(tabName);
    });
  });
  
  // Initialize analysis
  initAnalysis();
});
