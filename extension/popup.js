/**
 * Popup script for the Relay Auto Booker extension
 */

// DOM elements
let statusEl;
let activeModeEl;
let refreshIntervalEl;
let runtimeEl;
let refreshCountEl;
let startBtn;
let stopBtn;
let settingsBtn;
let matchesCountEl;

// State
let isActive = false;
let statusInterval = null;
let status = {
  isActive: false,
  activeMode: 'search',
  refreshSpeed: 30,
  refreshCount: 0,
  startTime: null,
  matchesCount: 0
};

// Initialize popup
document.addEventListener('DOMContentLoaded', initPopup);

function initPopup() {
  // Get DOM elements
  statusEl = document.getElementById('status-value');
  activeModeEl = document.getElementById('active-mode');
  refreshIntervalEl = document.getElementById('refresh-interval');
  runtimeEl = document.getElementById('runtime');
  refreshCountEl = document.getElementById('refresh-count');
  matchesCountEl = document.getElementById('matches-count');
  startBtn = document.getElementById('start-btn');
  stopBtn = document.getElementById('stop-btn');
  settingsBtn = document.getElementById('settings-btn');
  
  // Set up toggle switches
  setupToggles();
  
  // Add event listeners
  startBtn.addEventListener('click', startAutomation);
  stopBtn.addEventListener('click', stopAutomation);
  settingsBtn.addEventListener('click', openSettings);
  
  // Check current status
  checkStatus();
  
  // Start status update interval
  statusInterval = setInterval(checkStatus, 1000);
}

// Clean up when popup closes
window.addEventListener('unload', () => {
  if (statusInterval) {
    clearInterval(statusInterval);
  }
});

// Set up toggle switches
function setupToggles() {
  const toggles = [
    { id: 'fast-book-toggle', checkboxId: 'fast-book-checkbox', setting: 'fastBook' },
    { id: 'show-details-toggle', checkboxId: 'show-details-checkbox', setting: 'showTripDetails' },
    { id: 'hide-similar-toggle', checkboxId: 'hide-similar-checkbox', setting: 'hideSimilarTrips' }
  ];
  
  toggles.forEach(toggle => {
    const toggleEl = document.getElementById(toggle.id);
    const checkboxEl = document.getElementById(toggle.checkboxId);
    
    if (toggleEl && checkboxEl) {
      // Update toggle appearance based on initial state
      if (checkboxEl.checked) {
        toggleEl.classList.add('active');
      }
      
      // Add click listener
      toggleEl.addEventListener('click', () => {
        checkboxEl.checked = !checkboxEl.checked;
        
        // Update appearance
        if (checkboxEl.checked) {
          toggleEl.classList.add('active');
        } else {
          toggleEl.classList.remove('active');
        }
        
        // Update setting
        updateSetting(toggle.setting, checkboxEl.checked);
      });
    }
  });
}

// Check current status of automation
function checkStatus() {
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response) {
      status = response;
      updateUI();
    }
  });
}

// Update UI based on current status
function updateUI() {
  // Update status indicator
  if (status.isActive) {
    statusEl.textContent = 'Active';
    statusEl.className = 'status-value active';
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } else {
    statusEl.textContent = 'Inactive';
    statusEl.className = 'status-value inactive';
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
  
  // Update other status information
  activeModeEl.textContent = status.activeMode ? status.activeMode.charAt(0).toUpperCase() + status.activeMode.slice(1) : 'Search';
  refreshIntervalEl.textContent = (status.refreshSpeed || 30) + 's';
  refreshCountEl.textContent = status.refreshCount || 0;
  matchesCountEl.textContent = status.matchesCount || 0;
  
  // Update runtime
  if (status.isActive && status.startTime) {
    const runtime = calculateRuntime(status.startTime);
    runtimeEl.textContent = runtime;
  } else {
    runtimeEl.textContent = '00:00:00';
  }
}

// Calculate runtime from start time
function calculateRuntime(startTime) {
  const now = Date.now();
  const elapsed = Math.floor((now - startTime) / 1000);
  
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');
}

// Start automation
function startAutomation() {
  // Get active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) return;
    
    const tab = tabs[0];
    
    // Load settings
    chrome.storage.local.get(['settings'], (result) => {
      const settings = result.settings || getDefaultSettings();
      
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'startMonitoring',
        tabId: tab.id,
        settings: settings
      }, (response) => {
        console.log('Start automation response:', response);
        
        if (response && response.success) {
          checkStatus();
        }
      });
    });
  });
}

// Stop automation
function stopAutomation() {
  chrome.runtime.sendMessage({ action: 'stopMonitoring' }, (response) => {
    console.log('Stop automation response:', response);
    
    if (response && response.success) {
      checkStatus();
    }
  });
}

// Open settings page
function openSettings() {
  chrome.runtime.openOptionsPage();
}

// Update a setting
function updateSetting(key, value) {
  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || getDefaultSettings();
    settings[key] = value;
    
    chrome.storage.local.set({ settings }, () => {
      console.log(`Setting ${key} updated to ${value}`);
      
      // Update content script with new settings if active
      if (status.isActive) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'updateSettings',
              settings: settings
            });
          }
        });
      }
    });
  });
}

// Get default settings
function getDefaultSettings() {
  return {
    activeMode: 'search',
    refreshSpeed: 30,
    priceChangeThreshold: 20,
    fastBook: true,
    showTripDetails: true,
    hideSimilarTrips: true,
    filters: {
      maxDeparture: '',
      startWithin: '∞',
      maxDuration: '∞',
      distanceMin: 0,
      distanceMax: 9999,
      stemTime: 0,
      maxDeadhead: 50,
      stopsMax: 10,
      payoutMin: 0,
      filterBy: 'No filter'
    }
  };
}
