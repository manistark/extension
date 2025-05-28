/**
 * Storage utilities for the Relay Auto Booker extension
 */

// Default settings
const DEFAULT_SETTINGS = {
  // Core settings
  activeMode: 'search',
  refreshSpeed: 30,
  
  // Global settings
  randomizer: 500,
  priceChangeThreshold: 20,
  notificationSound: 'alert',
  notificationVolume: 80,
  fastBook: true,
  showTripDetails: true,
  hideRefreshResults: false,
  onlyAmazonLocations: false,
  hideAutobookMode: false,
  skipCurrentTrips: false,
  hideSimilarTrips: true,
  startStopHotkey: false,
  
  // Filters
  filters: {
    quantity: 1,
    maxDeparture: '',
    startWithin: '∞',
    maxDuration: '∞',
    distanceMin: 0,
    distanceMax: 9999,
    stopsMin: 0,
    stopsMax: 10,
    stemTime: 0,
    maxDeadhead: 50,
    payoutMin: 0,
    filterBy: 'No filter'
  }
};

/**
 * Load settings from storage
 * @returns {Promise<object>} The loaded settings
 */
function loadSettings() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(['settings'], result => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        if (result.settings) {
          // Merge with defaults to ensure all properties exist
          resolve({ ...DEFAULT_SETTINGS, ...result.settings });
        } else {
          // No settings found, use defaults
          resolve({ ...DEFAULT_SETTINGS });
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Save settings to storage
 * @param {object} settings - The settings to save
 * @returns {Promise<void>}
 */
function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set({ settings }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get default settings
 * @returns {object} The default settings
 */
function getDefaultSettings() {
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save trip data for comparison
 * @param {object} tripData - Trip data to save
 * @returns {Promise<void>}
 */
function saveTripData(tripData) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set({ tripData }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Load saved trip data
 * @returns {Promise<object>} The loaded trip data
 */
function loadTripData() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(['tripData'], result => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        if (result.tripData) {
          resolve(result.tripData);
        } else {
          resolve({});
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Save automation state
 * @param {object} state - The automation state to save
 * @returns {Promise<void>}
 */
function saveAutomationState(state) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set({ automationState: state }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Load automation state
 * @returns {Promise<object>} The loaded automation state
 */
function loadAutomationState() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(['automationState'], result => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        if (result.automationState) {
          resolve(result.automationState);
        } else {
          resolve(null);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Clear all stored data
 * @returns {Promise<void>}
 */
function clearAllStorage() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Export storage functions
window.RelayAutoBooker = window.RelayAutoBooker || {};
window.RelayAutoBooker.storage = {
  loadSettings,
  saveSettings,
  getDefaultSettings,
  saveTripData,
  loadTripData,
  saveAutomationState,
  loadAutomationState,
  clearAllStorage
};
