// Global state to track current speed and domain
let currentSpeed = 1;
let currentDomain = '';

/**
 * Initialize the popup UI and load saved settings
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Set default value in custom speed input
  const customSpeedInput = document.getElementById('customSpeed');
  if (customSpeedInput) {
    customSpeedInput.value = "1.00";
  }

  // Get current tab's domain
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.url) {
      currentDomain = new URL(tabs[0].url).hostname.replace('www.', '');
      document.title = `Speed for ${currentDomain}`;
    }
  } catch (error) {
    console.error('Error getting current domain:', error);
  }

  // Initialize event listeners
  setupEventListeners();
  
  // Load and apply saved speed for current domain
  try {
    const data = await chrome.storage.sync.get('domainSpeeds');
    const domainSpeeds = data.domainSpeeds || {};
    const savedSpeed = domainSpeeds[currentDomain];
    if (savedSpeed) {
      currentSpeed = savedSpeed;
      updateUI(savedSpeed);
    } else {
      currentSpeed = 1;
      updateUI(1);
    }
  } catch (error) {
    console.error('Error loading saved speed:', error);
    updateUI(1); // Fallback to default speed
  }
});

/**
 * Set up all event listeners for the popup UI
 */
function setupEventListeners() {
  // Speed preset button listeners
  document.querySelectorAll('.speed-button').forEach(button => {
    button.addEventListener('click', () => {
      const speed = parseFloat(button.dataset.speed);
      handleSpeedChange(speed);
    });
  });

  // Arrow button listeners for fine-tuning speed
  document.getElementById('speedUp').addEventListener('click', () => {
    const newSpeed = Math.round((currentSpeed + 0.05) * 100) / 100;
    handleSpeedChange(newSpeed);
  });

  document.getElementById('speedDown').addEventListener('click', () => {
    const newSpeed = Math.max(0.1, Math.round((currentSpeed - 0.05) * 100) / 100);
    handleSpeedChange(newSpeed);
  });

  // Custom speed input controls
  const customSpeedInput = document.getElementById('customSpeed');
  const setCustomSpeedBtn = document.getElementById('setCustomSpeed');
  
  if (setCustomSpeedBtn && customSpeedInput) {
    // Handle Set button click
    setCustomSpeedBtn.addEventListener('click', () => {
      const speed = parseFloat(customSpeedInput.value);
      if (speed && speed > 0) {
        handleSpeedChange(speed);
      }
    });

    // Handle Enter key in custom speed input
    customSpeedInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const speed = parseFloat(customSpeedInput.value);
        if (speed && speed > 0) {
          handleSpeedChange(speed);
        }
      }
    });
  }
}

/**
 * Update the UI to reflect the current speed
 * @param {number} speed - The current playback speed
 */
function updateUI(speed) {
  // Update preset button highlights
  document.querySelectorAll('.speed-button').forEach(button => {
    const buttonSpeed = parseFloat(button.dataset.speed);
    button.classList.toggle('selected', buttonSpeed === speed);
  });

  // Update custom speed input
  const customSpeedInput = document.getElementById('customSpeed');
  if (customSpeedInput) {
    customSpeedInput.value = speed.toFixed(2);
  }
}

/**
 * Handle speed changes, update storage and notify content script
 * @param {number} speed - The new playback speed to set
 */
async function handleSpeedChange(speed) {
  // Update UI immediately for responsiveness
  currentSpeed = speed;
  updateUI(speed);
  
  // Save speed for current domain and update video speed
  try {
    const data = await chrome.storage.sync.get('domainSpeeds');
    const domainSpeeds = data.domainSpeeds || {};
    domainSpeeds[currentDomain] = speed;
    
    // Perform background operations in parallel
    await Promise.all([
      chrome.storage.sync.set({ domainSpeeds }),
      sendSpeedToContentScript(speed)
    ]);
  } catch (error) {
    console.error('Error in background operations:', error);
  }
}

/**
 * Send speed change message to content script
 * @param {number} speed - The new playback speed to set
 */
async function sendSpeedToContentScript(speed) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    return chrome.tabs.sendMessage(tabs[0].id, { 
      action: 'setSpeed', 
      speed: speed 
    });
  }
}