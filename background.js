// background.js
chrome.action.onClicked.addListener(tab => {
  if (!tab.id || !tab.url.includes('/ru/mstat/')) return;
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });
});
