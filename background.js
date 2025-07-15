chrome.action.onClicked.addListener(tab => {
  if (!tab.id || !tab.url.includes('/ru/mstat/')) return;
  // Контент-скрипт инжектится автоматически popup.js
});
