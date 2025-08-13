

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
 * Force update all video speeds
 */
function forceUpdateVideoSpeeds(speed) {
  const videos = document.querySelectorAll('video');
  videos.forEach((video) => {
    try {
      video.playbackRate = speed;

      // Testa se realmente foi alterado
      if (video.playbackRate !== speed) {
        console.warn('Playback rate not allowed on this video');
      }
    } catch (err) {
      console.warn('Cannot set playbackRate on this video:', err.message);
    }
  });
}

/**
 * Sets playback speed for all video elements
 */
async function setVideoSpeed(speed, skipStorage = false) {
  try {
    console.log(`Setting video speed to ${speed} (skipStorage: ${skipStorage})`);
    currentSpeed = speed;
    forceUpdateVideoSpeeds(speed);

    // Save speed setting if not skipped
    if (!skipStorage) {
      const domain = getDomain();
      const data = await chrome.storage.sync.get('domainSpeeds');
      const domainSpeeds = data.domainSpeeds || {};
      domainSpeeds[domain] = speed;
      await chrome.storage.sync.set({ domainSpeeds });
      console.log(`Saved speed ${speed} for domain ${domain}`);
    }
  } catch (error) {
    console.error('Error setting video speed:', error);
  }
}

/**
 * Loads and applies saved speed setting
 */
async function applySavedSpeed() {
  try {
    const domain = getDomain();
    const data = await chrome.storage.sync.get('domainSpeeds');
    const domainSpeeds = data.domainSpeeds || {};
    const savedSpeed = domainSpeeds[domain] || 1;
    console.log(`Loading saved speed for ${domain}: ${savedSpeed}`);
    await setVideoSpeed(savedSpeed, true);
  } catch (error) {
    console.error('Error loading saved speed:', error);
  }
}

/**
 * Monitors and maintains speed settings for video elements
 */
function isCrunchyroll() {
  return window.location.hostname.includes("crunchyroll.com");
}

function monitorVideoElements() {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    // Se for Crunchyroll, não force handlers
    if (isCrunchyroll()) return;

    video.removeEventListener('ratechange', handleRateChange);
    video.removeEventListener('play', handlePlay);
    video.removeEventListener('loadedmetadata', handleLoadedMetadata);

    video.addEventListener('ratechange', handleRateChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    video.playbackRate = currentSpeed;
  });
}


// Event handlers for video elements
function handleRateChange(event) {
  if (event.target.playbackRate !== currentSpeed) {
    event.target.playbackRate = currentSpeed;
  }
}

function handlePlay() {
  this.playbackRate = currentSpeed;
}

function handleLoadedMetadata() {
  this.playbackRate = currentSpeed;
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

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.domainSpeeds) {
    const domain = getDomain();
    const domainSpeeds = changes.domainSpeeds.newValue || {};
    const newSpeed = domainSpeeds[domain];
    
    console.log('Storage changed:', {
      domain,
      newSpeed,
      currentSpeed,
      allDomainSpeeds: domainSpeeds
    });
    
    if (newSpeed && newSpeed !== currentSpeed) {
      console.log(`Updating speed from storage change: ${newSpeed}`);
      setVideoSpeed(newSpeed, true);
      showToast(newSpeed);
    }
  }
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

// More aggressive periodic check
setInterval(() => {
  forceUpdateVideoSpeeds(currentSpeed);
}, 1000);