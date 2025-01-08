// Add toast styles that work in both normal and fullscreen modes
const toastStyles = document.createElement('style');
toastStyles.textContent = `
  #speed-toast {
    position: fixed;
    left: 50%;
    bottom: 25vh;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 24px;
    border-radius: 20px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 18px;
    font-weight: 500;
    z-index: 9999999999;
    transition: opacity 0.15s ease-in-out;
    opacity: 0;
    pointer-events: none;
  }
`;
document.head.appendChild(toastStyles);

// Create toast element
const toast = document.createElement('div');
toast.id = 'speed-toast';
document.body.appendChild(toast);

// Global variable to track current playback speed
let currentSpeed = 1;

/**
 * Shows toast notification with current speed
 */
let toastTimeout;
function showToast(speed) {
  toast.textContent = `${speed}x`;
  toast.style.opacity = '1';
  
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
  }, 750);
}

/**
 * Gets current domain name without 'www.' prefix
 */
function getDomain() {
  return window.location.hostname.replace('www.', '');
}

/**
 * Sets playback speed for all video elements
 */
function setVideoSpeed(speed) {
  try {
    currentSpeed = speed;
    const videos = document.querySelectorAll('video');
    videos.forEach((video) => {
      if (video && video.playbackRate !== speed) {
        video.playbackRate = speed;
      }
    });

    // Save speed setting
    const domain = getDomain();
    chrome.storage.sync.get('domainSpeeds', (data) => {
      const domainSpeeds = data.domainSpeeds || {};
      domainSpeeds[domain] = speed;
      chrome.storage.sync.set({ domainSpeeds });
    });
  } catch (error) {
    console.error('Error setting video speed:', error);
  }
}

/**
 * Loads and applies saved speed setting
 */
function applySavedSpeed() {
  const domain = getDomain();
  chrome.storage.sync.get('domainSpeeds', (data) => {
    const domainSpeeds = data.domainSpeeds || {};
    const savedSpeed = domainSpeeds[domain] || 1;
    setVideoSpeed(savedSpeed);
  });
}

/**
 * Monitors and maintains speed settings for video elements
 */
function monitorVideoElements() {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    video.playbackRate = currentSpeed;
    
    video.addEventListener('play', () => {
      video.playbackRate = currentSpeed;
    });
    
    video.addEventListener('loadedmetadata', () => {
      video.playbackRate = currentSpeed;
    });
  });
}

// Watch for dynamically added videos
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    if (mutation.addedNodes.length) {
      monitorVideoElements();
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.metaKey && e.altKey) { // For Mac: Command + Option
    let newSpeed;
    switch (e.code) {
      case 'Equal':
      case 'NumpadAdd':
      case 'Plus':
        e.preventDefault();
        e.stopPropagation();
        newSpeed = Math.min(16, Math.round((currentSpeed + 0.05) * 100) / 100);
        setVideoSpeed(newSpeed);
        showToast(newSpeed);
        break;

      case 'Minus':
      case 'NumpadSubtract':
        e.preventDefault();
        e.stopPropagation();
        newSpeed = Math.max(0.1, Math.round((currentSpeed - 0.05) * 100) / 100);
        setVideoSpeed(newSpeed);
        showToast(newSpeed);
        break;

      case 'Delete':
      case 'Backspace':  
        e.preventDefault();
        e.stopPropagation();
        setVideoSpeed(1);
        showToast(1);
        break;
    }
  }
});

// Listen for speed change messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'setSpeed') {
    setVideoSpeed(request.speed);
    sendResponse({ success: true });
  }
  return true;
});

// Initialize
applySavedSpeed();
monitorVideoElements();

// Periodic check
setInterval(() => {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    if (video.playbackRate !== currentSpeed) {
      video.playbackRate = currentSpeed;
    }
  });
}, 1000);
