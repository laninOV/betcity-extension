// popup.js
chrome.runtime.onMessage.addListener((req) => {
  if (req.action === "showResults") {
    document.getElementById("results").innerHTML = req.data;
  }
});

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  chrome.tabs.sendMessage(tab.id, { action: "getResults" }, (response) => {
    if (chrome.runtime.lastError) {
      document.getElementById("results").innerHTML =
        `<p>Ошибка: ${chrome.runtime.lastError.message}</p>`;
    } else if (response && response.data) {
      document.getElementById("results").innerHTML = response.data;
    } else {
      document.getElementById("results").innerHTML =
        "<p>Данные не получены. Обновите страницу и попробуйте снова.</p>";
    }
  });
});
