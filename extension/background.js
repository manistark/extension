/**
 * Background Service Worker for Relay Auto Booker
 * Handles state management and tab communication
 */

// Constants
const ALARM_NAME = 'relay-auto-refresh';

// State
let activeTabId = null;
let isActive = false;
let status = {
  isActive: false,
  activeMode: 'search',
  refreshSpeed: 30,
  refreshCount: 0,
  startTime: null,
  matchesCount: 0
};

// Initialize when extension is loaded
chrome.runtime.onInstalled.addListener(() => {
  console.log('Relay Auto Booker extension installed');
  
  // Initialize default settings if not already set
  chrome.storage.local.get(['settings'], (result) => {
    if (!result.settings) {
      const defaultSettings = {
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
      chrome.storage.local.set({ settings: defaultSettings });
    }
  });
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.action);
  
  switch (message.action) {
    case 'getStatus':
      sendResponse(status);
      break;
      
    case 'startMonitoring':
      startMonitoring(message.tabId, message.settings, sendResponse);
      return true; // Keep channel open for async response
      
    case 'stopMonitoring':
      stopMonitoring(sendResponse);
      return true; // Keep channel open for async response
      
    case 'updateStatus':
      updateStatus(message.data);
      sendResponse({ success: true });
      break;
      
    case 'refreshNow':
      refreshTab(sendResponse);
      return true; // Keep channel open for async response
      
    case 'bookLoad':
      handleBookLoad(message.loadId, sendResponse);
      return true; // Keep channel open for async response
      
    case 'logMatches':
      logMatches(message.count);
      sendResponse({ success: true });
      break;
  }
});

// Start monitoring for loads
function startMonitoring(tabId, settings, sendResponse) {
  if (isActive) {
    stopMonitoring();
  }
  
  // Set up the alarm for auto-refresh
  if (settings && settings.refreshSpeed) {
    // Convert seconds to minutes for the alarm API, with minimum of 1ms
    // For very small values (like 1ms), use delayInMinutes with tiny value
    const refreshTimeInMinutes = Math.max(0.00001, settings.refreshSpeed / 60);
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: refreshTimeInMinutes });
  }
  
  // Update state
  activeTabId = tabId;
  isActive = true;
  status = {
    isActive: true,
    activeMode: settings?.activeMode || 'search',
    refreshSpeed: settings?.refreshSpeed || 30,
    refreshCount: 0,
    startTime: Date.now(),
    matchesCount: 0
  };
  
  // Notify the content script to start monitoring
  chrome.tabs.sendMessage(tabId, {
    action: 'startMonitoring',
    settings: settings
  }, (response) => {
    // If there was an error or no response, try to reload the page
    if (chrome.runtime.lastError || !response || !response.success) {
      chrome.tabs.reload(tabId);
    }
  });
  
  sendResponse({ success: true, status });
}

// Stop monitoring for loads
function stopMonitoring(sendResponse) {
  // Clear the alarm
  chrome.alarms.clear(ALARM_NAME);
  
  // Update state
  isActive = false;
  status.isActive = false;
  
  // If we have an active tab, send message to stop monitoring
  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, {
      action: 'stopMonitoring'
    }, () => {
      // Ignore any error from closed tabs
      if (chrome.runtime.lastError) {
        console.log('Error sending stop message:', chrome.runtime.lastError);
      }
    });
    
    activeTabId = null;
  }
  
  if (sendResponse) {
    sendResponse({ success: true, status });
  }
}

// Refresh the active tab
function refreshTab(sendResponse) {
  if (activeTabId && isActive) {
    // First try to use the content script to refresh
    chrome.tabs.sendMessage(activeTabId, {
      action: 'refreshPage'
    }, (response) => {
      // If there's an error or no response, use tab reload
      if (chrome.runtime.lastError || !response || !response.success) {
        chrome.tabs.reload(activeTabId);
      }
      
      // Update refresh count
      status.refreshCount++;
      
      if (sendResponse) {
        sendResponse({ success: true });
      }
    });
  } else if (sendResponse) {
    sendResponse({ success: false, error: 'No active tab' });
  }
}

// Handle booked loads
function handleBookLoad(loadId, sendResponse) {
  if (activeTabId && isActive) {
    chrome.tabs.sendMessage(activeTabId, {
      action: 'bookLoad',
      loadId: loadId
    }, (response) => {
      if (sendResponse) {
        if (chrome.runtime.lastError) {
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message 
          });
        } else {
          sendResponse(response);
        }
      }
    });
  } else if (sendResponse) {
    sendResponse({ success: false, error: 'No active tab' });
  }
}

// Update status from content scripts
function updateStatus(data) {
  if (data) {
    status = { ...status, ...data };
  }
}

// Log matches count
function logMatches(count) {
  if (typeof count === 'number') {
    status.matchesCount = count;
  }
}

// Handle alarm for auto-refresh
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME && isActive && activeTabId) {
    refreshTab();
  }
});

// Listen for tab closed or navigated away
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    stopMonitoring();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // If the URL changes in the active tab, check if we need to stop monitoring
  if (tabId === activeTabId && changeInfo.url) {
    // Check if the new URL is still a Relay loadboard
    const isRelayLoadboard = 
      changeInfo.url.includes('relay.amazon') && 
      (changeInfo.url.includes('loadboard') || changeInfo.url.includes('search'));
    
    if (!isRelayLoadboard) {
      stopMonitoring();
    }
  }
});
