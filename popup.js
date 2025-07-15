// popup.js
document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {ask: 'stats'}, (response) => {
      const out = document.getElementById('out');
      if (chrome.runtime.lastError) {
        out.innerHTML = `<p>Ошибка обмена сообщениями: ${chrome.runtime.lastError.message}</p>`;
      } else if (!response) {
        out.innerHTML = '<p>Запрос stats вернул undefined — content.js не запущен или не ответил.</p>';
      } else {
        out.innerHTML = response;
      }
    });
  });
});
