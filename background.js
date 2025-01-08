/**
 * Listen for tab updates and inject content script
 * This ensures the content script is loaded after page navigation
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only inject when the page is fully loaded
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  }
});