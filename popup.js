// popup.js
const out=document.getElementById('results');
chrome.tabs.query({active:true,currentWindow:true},([tab])=>{
  chrome.tabs.sendMessage(tab.id,{action:'getResults'},response=>{
    if(chrome.runtime.lastError) {
      out.innerHTML=`<p>Ошибка: ${chrome.runtime.lastError.message}</p>`;
    } else if(response && response.data) {
      out.innerHTML=response.data;
    } else {
      out.innerHTML='<p>Данные не получены</p>';
    }
  });
});
