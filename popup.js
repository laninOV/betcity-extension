// popup.js
chrome.runtime.onMessage.addListener((req) => {
  if (req.action==="showResults") {
    document.getElementById("results").innerHTML = req.data;
  }
});

// Запросим данные сразу при открытии попапа
chrome.tabs.query({active:true,currentWindow:true},([tab])=>{
  chrome.tabs.sendMessage(tab.id,{action:"showResults"},(res)=>{
    if (chrome.runtime.lastError) {
      document.getElementById("results").innerHTML =
        `<p>Ошибка обмена сообщениями: ${chrome.runtime.lastError.message}</p>`;
    } else if (!res) {
      document.getElementById("results").innerHTML =
        "<p>Данные не получены. Перезагрузите страницу и попробуйте снова.</p>";
    }
  });
});
