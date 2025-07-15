// background.js
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url.includes("/ru/mstat/")) return;
  // Инжектируем content.js в активную вкладку
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });
});
