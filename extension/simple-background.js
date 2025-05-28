/**
 * Simple background script for the Relay Auto Booker extension
 * Focused only on calling the refresh functionality
 */

// Constants
const ALARM_NAME = 'refreshAlarm';

// State
let automationState = {
  isActive: false,
  tabId: null,
  refreshCount: 0,
  startTime: null,
  settings: null
};

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log('Relay Auto Booker extension installed');
  resetAutomationState();
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  switch (message.action) {
    case 'startAutomation':
    case 'startRefreshing':
      try {
        startAutomation(message.tabId, message.settings || { refreshSpeed: message.interval || 30 });
        sendResponse({ 
          success: true,
          isActive: automationState.isActive,
          refreshCount: automationState.refreshCount,
          startTime: automationState.startTime
        });
      } catch (error) {
        console.error('Error starting automation:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;
      
    case 'stopAutomation':
    case 'stopRefreshing':
      try {
        stopAutomation();
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error stopping automation:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;
      
    case 'getAutomationStatus':
    case 'getStatus':
      sendResponse({
        isActive: automationState.isActive,
        refreshCount: automationState.refreshCount,
        startTime: automationState.startTime
      });
      break;
      
    case 'refresh':
      // One-time refresh
      if (automationState.tabId) {
        performRefresh();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No active tab' });
      }
      break;
      
    default:
      console.warn('Unknown message action:', message.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
  
  return true; // Keep the message channel open for async responses
});

// Handle tab closing
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === automationState.tabId) {
    console.log('Active tab closed, stopping automation');
    stopAutomation();
  }
});

// Handle alarm for refresh timing
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME && automationState.isActive) {
    performRefresh();
  }
});

/**
 * Start the automation process
 * @param {number} tabId - The ID of the tab to automate
 * @param {object} settings - The settings for the automation
 */
function startAutomation(tabId, settings) {
  console.log('Starting automation with settings:', settings);
  
  // Save current state
  automationState.isActive = true;
  automationState.tabId = tabId;
  automationState.settings = settings;
  automationState.refreshCount = 0;
  automationState.startTime = Date.now();
  
  // Persist state to storage
  persistAutomationState();
  
  // Create refresh alarm
  const refreshInterval = parseInt(settings.refreshSpeed || 30);
  createRefreshAlarm(refreshInterval);
  
  // Notify content script
  notifyContentScript({ action: 'automationStarted', settings });
  
  console.log(`Automation started with refresh interval: ${refreshInterval} seconds`);
}

/**
 * Stop the automation process
 */
function stopAutomation() {
  console.log('Stopping automation');
  
  // Clear any active alarms
  chrome.alarms.clear(ALARM_NAME);
  
  // Notify content script if we have an active tab
  if (automationState.tabId) {
    notifyContentScript({ action: 'automationStopped' });
  }
  
  // Update state
  automationState.isActive = false;
  
  // Reset and persist state
  resetAutomationState();
  persistAutomationState();
}

/**
 * Create an alarm for refresh timing
 * @param {number} intervalSeconds - The interval in seconds
 */
function createRefreshAlarm(intervalSeconds) {
  // Clear any existing alarm
  chrome.alarms.clear(ALARM_NAME, () => {
    // Create new alarm
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: intervalSeconds / 60, // Convert seconds to minutes
      periodInMinutes: intervalSeconds / 60  // Convert seconds to minutes
    });
    
    console.log(`Created refresh alarm with interval: ${intervalSeconds} seconds`);
  });
}

/**
 * Perform the refresh action
 */
function performRefresh() {
  if (!automationState.isActive || !automationState.tabId) {
    console.warn('Cannot refresh: automation not active or missing tab ID');
    return;
  }
  
  console.log('Performing refresh on tab', automationState.tabId);
  
  // Increment refresh count
  automationState.refreshCount++;
  
  // Notify content script to perform refresh
  notifyContentScript({ 
    action: 'performRefresh',
    count: automationState.refreshCount,
    timestamp: Date.now()
  });
  
  // Persist updated state
  persistAutomationState();
}

/**
 * Notify the content script in the active tab
 * @param {object} message - The message to send
 */
function notifyContentScript(message) {
  if (!automationState.tabId) {
    console.warn('Cannot notify content script: no active tab ID');
    return;
  }
  
  try {
    chrome.tabs.sendMessage(automationState.tabId, message)
      .catch(error => {
        console.error('Error sending message to content script:', error);
      });
  } catch (error) {
    console.error('Failed to notify content script:', error);
  }
}

/**
 * Reset the automation state to defaults
 */
function resetAutomationState() {
  automationState = {
    isActive: false,
    tabId: null,
    refreshCount: 0,
    startTime: null,
    settings: null
  };
}

/**
 * Persist the current automation state to storage
 */
function persistAutomationState() {
  chrome.storage.local.set({ automationState }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving automation state:', chrome.runtime.lastError);
    }
  });
}

/**
 * Load the automation state from storage
 */
function loadAutomationState() {
  chrome.storage.local.get(['automationState'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error loading automation state:', chrome.runtime.lastError);
      return;
    }
    
    if (result.automationState) {
      const savedState = result.automationState;
      
      // If there was an active automation, it was interrupted
      if (savedState.isActive) {
        console.log('Detected interrupted automation, resetting state');
        resetAutomationState();
        persistAutomationState();
      }
    }
  });
}

// Load state on startup
loadAutomationState();