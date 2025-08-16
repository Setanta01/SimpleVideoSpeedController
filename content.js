(() => {

  if (window.__simpleVideoSpeedControllerLoaded) {
    return;
  }
  window.__simpleVideoSpeedControllerLoaded = true;


  if (!document.getElementById('__toastStyles')) {
    const toastStyles = document.createElement('style');
    toastStyles.id = '__toastStyles';
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
  }

  let toast = document.getElementById('speed-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'speed-toast';
    document.body.appendChild(toast);
  }

  let currentSpeed = 1;

  let toastTimeout;
  function showToast(speed) {
    toast.textContent = `${speed}x`;
    toast.style.opacity = '1';
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.style.opacity = '0';
    }, 750);
  }

  function getDomain() {
    return window.location.hostname.replace('www.', '');
  }

  function forceUpdateVideoSpeeds(speed) {
    const videos = document.querySelectorAll('video');
    videos.forEach((video) => {
      try {
        video.playbackRate = speed;
        if (video.playbackRate !== speed) {
          console.warn('Playback rate not allowed on this video');
        }
      } catch (err) {
        console.warn('Cannot set playbackRate on this video:', err.message);
      }
    });
  }

  let saveTimeout;

  async function setVideoSpeed(speed, skipStorage = false) {
    try {
      currentSpeed = speed;
      forceUpdateVideoSpeeds(speed);
      if (!skipStorage) {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
          const domain = getDomain();
          const data = await chrome.storage.sync.get('domainSpeeds');
          const domainSpeeds = data.domainSpeeds || {};
          domainSpeeds[domain] = speed;
          await chrome.storage.sync.set({ domainSpeeds });
          console.log(`Saved speed ${speed} for domain ${domain}`);
        }, 1000);
      }
    } catch (error) {
      console.error('Error setting video speed:', error);
    }
  }

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

  function isCrunchyroll() {
    return window.location.hostname.includes("crunchyroll.com");
  }

  function monitorVideoElements() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      if (isCrunchyroll()) {
        video.playbackRate = currentSpeed;
        return;
      }
      video.removeEventListener('ratechange', handleRateChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('ratechange', handleRateChange);
      video.addEventListener('play', handlePlay);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.playbackRate = currentSpeed;
    });
  }

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

  let throttleTimeout;
  const observer = new MutationObserver((mutations) => {
    if (throttleTimeout) return;
    const hasAddedNodes = mutations.some(mutation => mutation.addedNodes.length > 0);
    if (!hasAddedNodes) return;
    throttleTimeout = setTimeout(() => {
      monitorVideoElements();
      throttleTimeout = null;
    }, 100);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });

  document.addEventListener('keydown', (e) => {
    if (e.metaKey && e.altKey) {
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

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'setSpeed') {
      setVideoSpeed(request.speed);
      sendResponse({ success: true });
    }
    return true;
  });

  applySavedSpeed();
  monitorVideoElements();

  let lastSpeed = currentSpeed;
  setInterval(() => {
    if (currentSpeed !== lastSpeed) {
      forceUpdateVideoSpeeds(currentSpeed);
      lastSpeed = currentSpeed;
    }
  }, 1000);
})();
