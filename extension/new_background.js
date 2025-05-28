/**
 * Background script for the Relay Auto Booker extension
 * This script handles automation scheduling and coordination
 */

// State
const activeAutomations = {};
let stats = {
  refreshCount: 0,
  matchCount: 0
};

// Initialize when the background script is loaded
initialize();

/**
 * Initialize the background script
 */
function initialize() {
  console.log('Relay Auto Booker background script initialized');
  
  // Set up message listeners
  chrome.runtime.onMessage.addListener(handleMessage);
  
  // Listen for tab removal to clean up automations
  chrome.tabs.onRemoved.addListener(handleTabRemoved);
  
  // Load active automations from storage
  loadActiveAutomations();
  
  // Set up alarm listener
  chrome.alarms.onAlarm.addListener(handleAlarm);
}

/**
 * Handle messages from popup or content scripts
 * @param {Object} message - The message object
 * @param {Object} sender - The sender of the message
 * @param {Function} sendResponse - Function to send a response
 * @returns {boolean} - Whether sendResponse will be called asynchronously
 */
function handleMessage(message, sender, sendResponse) {
  switch (message.action) {
    case 'startAutomation':
      startAutomation(message.tabId, message.settings, sendResponse);
      break;
    
    case 'stopAutomation':
      stopAutomation(message.tabId, sendResponse);
      break;
    
    case 'getAutomationStatus':
      getAutomationStatus(sendResponse);
      break;
    
    case 'updateSettings':
      updateSettings(message.settings, sendResponse);
      break;
    
    case 'getStats':
      getStats(sendResponse);
      break;
    
    case 'statsUpdated':
      updateStats(message.stats, sendResponse);
      break;
    
    case 'playAlert':
      playAlert(message.matches, sendResponse);
      break;
      
    case 'bookingSuccess':
      handleBookingSuccess(message.load, sendResponse);
      break;
      
    case 'highPriceLoad':
      handleHighPriceLoad(message.load, sendResponse);
      break;
      
    case 'autobookSuccess':
      handleAutobookSuccess(message.load, sendResponse);
      break;
      
    case 'getSettings':
      getSettings(sendResponse);
      break;
    
    default:
      console.error('Unknown action:', message.action);
      if (sendResponse) sendResponse({ success: false, error: 'Unknown action' });
  }
  
  return true;  // Will respond asynchronously
}

/**
 * Start automation for a tab
 * @param {number} tabId - The ID of the tab to automate
 * @param {Object} settings - The settings for automation
 * @param {Function} sendResponse - Function to send a response
 */
function startAutomation(tabId, settings, sendResponse) {
  // Check if tab exists
  chrome.tabs.get(tabId, tab => {
    if (chrome.runtime.lastError) {
      console.error('Error getting tab:', chrome.runtime.lastError);
      if (sendResponse) sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }
    
    // Stop any existing automation for this tab
    if (activeAutomations[tabId]) {
      stopAutomation(tabId);
    }
    
    // Set up the automation
    activeAutomations[tabId] = {
      tabId,
      settings,
      alarmName: `automation-${tabId}`,
      startTime: Date.now()
    };
    
    // Create alarm for refresh scheduling
    chrome.alarms.create(activeAutomations[tabId].alarmName, {
      delayInMinutes: settings.refreshSpeed / 60,
      periodInMinutes: settings.refreshSpeed / 60
    });
    
    // Save active automations to storage
    saveActiveAutomations();
    
    console.log(`Started automation for tab ${tabId} with refresh rate ${settings.refreshSpeed} seconds`);
    
    if (sendResponse) sendResponse({ success: true });
  });
}

/**
 * Stop automation for a tab
 * @param {number} tabId - The ID of the tab to stop automation for
 * @param {Function} sendResponse - Function to send a response
 */
function stopAutomation(tabId, sendResponse) {
  if (activeAutomations[tabId]) {
    // Clear the alarm
    chrome.alarms.clear(activeAutomations[tabId].alarmName, wasCleared => {
      // Remove from active automations
      delete activeAutomations[tabId];
      
      // Save active automations to storage
      saveActiveAutomations();
      
      console.log(`Stopped automation for tab ${tabId}`);
      
      if (sendResponse) sendResponse({ success: true });
    });
  } else {
    if (sendResponse) sendResponse({ success: false, error: 'No active automation for this tab' });
  }
}

/**
 * Update settings for active automations
 * @param {Object} newSettings - The new settings
 * @param {Function} sendResponse - Function to send a response
 */
function updateSettings(newSettings, sendResponse) {
  // Update settings for all active automations
  Object.keys(activeAutomations).forEach(tabId => {
    const automation = activeAutomations[tabId];
    
    // Update settings
    automation.settings = newSettings;
    
    // Update alarm period if refresh speed changed
    chrome.alarms.clear(automation.alarmName, () => {
      chrome.alarms.create(automation.alarmName, {
        delayInMinutes: newSettings.refreshSpeed / 60,
        periodInMinutes: newSettings.refreshSpeed / 60
      });
    });
  });
  
  // Save active automations to storage
  saveActiveAutomations();
  
  if (sendResponse) sendResponse({ success: true });
}

/**
 * Get settings for active automation
 * @param {Function} sendResponse - Function to send a response
 */
function getSettings(sendResponse) {
  const tabIds = Object.keys(activeAutomations);
  
  if (tabIds.length > 0) {
    const tabId = tabIds[0]; // Use the first active automation
    sendResponse(activeAutomations[tabId].settings);
  } else {
    // If no active automation, load settings from storage
    storage.loadSettings().then(settings => {
      sendResponse(settings);
    }).catch(error => {
      console.error('Error loading settings:', error);
      sendResponse(null);
    });
    
    return true; // Async response
  }
}

/**
 * Get the current automation status
 * @param {Function} sendResponse - Function to send a response
 */
function getAutomationStatus(sendResponse) {
  const tabIds = Object.keys(activeAutomations);
  
  if (tabIds.length > 0) {
    sendResponse({ 
      isActive: true, 
      tabId: parseInt(tabIds[0]),
      count: tabIds.length
    });
  } else {
    sendResponse({ isActive: false });
  }
}

/**
 * Handle tab removal
 * @param {number} tabId - The ID of the removed tab
 */
function handleTabRemoved(tabId) {
  if (activeAutomations[tabId]) {
    stopAutomation(tabId);
  }
}

/**
 * Handle alarm events
 * @param {Object} alarm - The alarm that fired
 */
function handleAlarm(alarm) {
  // Check if this is one of our automation alarms
  const alarmPrefix = 'automation-';
  
  if (alarm.name.startsWith(alarmPrefix)) {
    const tabId = parseInt(alarm.name.substring(alarmPrefix.length));
    
    // Check if tab is still active
    chrome.tabs.get(tabId, tab => {
      if (chrome.runtime.lastError) {
        // Tab no longer exists, stop automation
        stopAutomation(tabId);
        return;
      }
      
      // Send refresh command to the content script
      chrome.tabs.sendMessage(tabId, { action: 'refresh' }, response => {
        if (chrome.runtime.lastError) {
          console.error('Error refreshing tab:', chrome.runtime.lastError);
          // Content script might not be loaded, try reinjecting
          chrome.tabs.reload(tabId);
        } else {
          // Update refresh count
          stats.refreshCount++;
          chrome.runtime.sendMessage({
            action: 'statsUpdated',
            stats: {
              refreshCount: stats.refreshCount,
              matchCount: stats.matchCount
            }
          });
        }
      });
      
      // If search is enabled, also check for loads after a short delay
      // to allow the page to finish refreshing
      const settings = activeAutomations[tabId].settings;
      if (settings.isSearchEnabled) {
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { 
            action: 'checkForLoads',
            settings: settings
          }, response => {
            if (chrome.runtime.lastError) {
              console.error('Error checking for loads:', chrome.runtime.lastError);
            } else if (response && response.success && response.loads.length > 0) {
              console.log(`Found ${response.loads.length} matching loads`);
              
              // Update match count
              stats.matchCount += response.loads.length;
              
              // If alert is enabled, play alert sound
              if (settings.isAlertEnabled) {
                playAlert(response.loads);
              }
              
              // If autobook is enabled, attempt to book first load
              if (settings.isAutobookEnabled && response.loads.length > 0) {
                chrome.tabs.sendMessage(tabId, {
                  action: 'bookLoad',
                  loadId: response.loads[0].id,
                  settings: settings
                });
              }
            }
          });
        }, 2000); // Wait 2 seconds after refresh
      }
    });
  }
}

/**
 * Get current stats
 * @param {Function} sendResponse - Function to send a response
 */
function getStats(sendResponse) {
  sendResponse({ success: true, stats });
}

/**
 * Update stats from content script
 * @param {Object} newStats - The new stats
 * @param {Function} sendResponse - Function to send a response
 */
function updateStats(newStats, sendResponse) {
  // Update only the provided stats
  if (newStats.refreshCount !== undefined) {
    stats.refreshCount += newStats.refreshCount;
  }
  
  if (newStats.matchCount !== undefined) {
    stats.matchCount += newStats.matchCount;
  }
  
  if (sendResponse) sendResponse({ success: true });
}

/**
 * Play alert sound when matches are found
 * @param {Array} matches - The matches that triggered the alert
 * @param {Function} sendResponse - Function to send a response
 */
function playAlert(matches, sendResponse) {
  console.log('Playing alert for matches:', matches);
  
  // Create notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Matching Load Found!',
    message: `Found ${matches.length} load(s) matching your criteria.`,
    priority: 2
  });
  
  // Play the alert sound
  const audio = new Audio(chrome.runtime.getURL('alert.mp3'));
  audio.play().catch(error => {
    console.error('Error playing alert sound:', error);
  });
  
  if (sendResponse) sendResponse({ success: true });
}

/**
 * Handle booking success notification
 * @param {Object} load - The load that was booked
 * @param {Function} sendResponse - Function to send a response
 */
function handleBookingSuccess(load, sendResponse) {
  console.log('Handling successful booking:', load);
  
  // Create notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Load Booked Successfully!',
    message: `Successfully booked load from ${load.origin} to ${load.destination}.`,
    priority: 2
  });
  
  // Play success sound
  const audio = new Audio(chrome.runtime.getURL('successbook.mp3'));
  audio.play().catch(error => {
    console.error('Error playing success sound:', error);
  });
  
  if (sendResponse) sendResponse({ success: true });
}

/**
 * Handle automated booking success notification
 * @param {Object} load - The load that was auto-booked
 * @param {Function} sendResponse - Function to send a response
 */
function handleAutobookSuccess(load, sendResponse) {
  console.log('Handling auto-booking success:', load);
  
  // Create notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Auto-Booking Successful!',
    message: `Automatically booked load from ${load.origin} to ${load.destination}.`,
    priority: 2
  });
  
  // Play success sound
  const audio = new Audio(chrome.runtime.getURL('successbook.mp3'));
  audio.play().catch(error => {
    console.error('Error playing success sound:', error);
  });
  
  if (sendResponse) sendResponse({ success: true });
}

/**
 * Handle high price load notification
 * @param {Object} load - The high-priced load
 * @param {Function} sendResponse - Function to send a response
 */
function handleHighPriceLoad(load, sendResponse) {
  console.log('High price load detected:', load);
  
  // Create notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'High Value Load Found!',
    message: `Found a high-paying load: $${load.payout} from ${load.origin} to ${load.destination}.`,
    priority: 2
  });
  
  // Play price alert sound
  const audio = new Audio(chrome.runtime.getURL('price.mp3'));
  audio.play().catch(error => {
    console.error('Error playing price alert sound:', error);
  });
  
  if (sendResponse) sendResponse({ success: true });
}

/**
 * Save active automations to storage
 */
async function saveActiveAutomations() {
  try {
    await storage.saveActiveAutomations(activeAutomations);
  } catch (error) {
    console.error('Error saving active automations:', error);
  }
}

/**
 * Load active automations from storage
 */
async function loadActiveAutomations() {
  try {
    const loadedAutomations = await storage.loadActiveAutomations();
    
    // Restore automations
    Object.keys(loadedAutomations).forEach(tabId => {
      const automation = loadedAutomations[tabId];
      
      // Verify tab still exists
      chrome.tabs.get(parseInt(tabId), tab => {
        if (!chrome.runtime.lastError) {
          // Tab exists, restore automation
          startAutomation(parseInt(tabId), automation.settings);
        }
      });
    });
  } catch (error) {
    console.error('Error loading active automations:', error);
  }
}