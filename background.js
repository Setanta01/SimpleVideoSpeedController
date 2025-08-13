/**
 * Listen for tab updates and inject content script
 * This ensures the content script is loaded after page navigation
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only inject when the page is fully loaded and has a valid URL
  if (changeInfo.status === 'complete' && tab.url) {
    const url = new URL(tab.url);

    // Bloquear domínios que não devem receber o script
    const blockedDomains = [
      'chrome://',
      'chrome-extension://'
      
    ];

    const isBlocked = blockedDomains.some(domain => url.href.startsWith(domain) || url.hostname.includes(domain));

    if (isBlocked) {
      console.log(`Bloqueado: ${url.href}`);
      return;
    }

    // Se passou nas verificações, injeta o script
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    }).catch(err => {
      console.warn('Erro ao injetar script:', err.message);
    });
  }
});
