/**
 * Simplified content script for the Amazon Relay Auto Booker extension
 * Focuses only on the refresh functionality
 */

// State
let automationActive = false;
let refreshCount = 0;
let lastRefreshTime = null;
let overlayElement = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  try {
    switch (message.action) {
      case 'automationStarted':
        automationActive = true;
        createOverlay();
        sendResponse({ success: true });
        break;
        
      case 'automationStopped':
        automationActive = false;
        removeOverlay();
        sendResponse({ success: true });
        break;
        
      case 'performRefresh':
        refreshCount = message.count || (refreshCount + 1);
        lastRefreshTime = message.timestamp || Date.now();
        if (overlayElement) updateOverlayContent();
        refreshPage();
        sendResponse({ success: true });
        break;
        
      case 'refresh':
        refreshPage();
        sendResponse({ success: true });
        break;
        
      default:
        console.warn('Unknown message action:', message.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Keep the channel open for async response
});

/**
 * Refresh the page using the "Next Refresh" button at the bottom of the loadboard
 * Based on the reference extension functionality
 */
function refreshPage() {
  console.log('Looking for the "Next Refresh" button...');
  
  try {
    // Method 1: Direct selector approach based on Amazon Relay's structure
    // This version attempts to match the exact approach used in the reference extension
    const nextRefreshButtons = Array.from(document.querySelectorAll('button')).filter(button => {
      // Check if button or its parent container has refresh text
      const buttonText = button.textContent && button.textContent.toLowerCase();
      const parentText = button.parentElement && button.parentElement.textContent && button.parentElement.textContent.toLowerCase();
      
      return (buttonText && buttonText.includes('refresh')) || 
             (parentText && parentText.includes('next refresh'));
    });
    
    if (nextRefreshButtons.length > 0) {
      console.log('Found refresh button via direct matching');
      nextRefreshButtons[0].click();
      return true;
    }
    
    // Method 2: Using data attributes often found in Amazon Relay's UI
    const refreshElements = document.querySelectorAll('[data-ux-load-board-footer-label="nextRefreshLabel"], [data-test-id*="refresh"], [data-automation-id*="refresh"]');
    if (refreshElements.length > 0) {
      // Find the adjacent button - this is the Next Refresh button
      const container = refreshElements[0].closest('div[data-ux-load-board-footer], div.footer, div.load-board-footer');
      if (container) {
        const refreshButton = container.querySelector('button');
        if (refreshButton) {
          console.log('Found refresh button via data attributes');
          refreshButton.click();
          return true;
        }
      }
    }
    
    // Method 3: Looking for specific text pattern "Next Refresh"
    // Use a more thorough approach to find elements containing this text
    let nextRefreshElements = [];
    const allElements = document.querySelectorAll('div, span, p, button');
    
    for (const el of allElements) {
      if (el.textContent && el.textContent.includes('Next Refresh')) {
        nextRefreshElements.push(el);
      }
    }
    
    if (nextRefreshElements.length > 0) {
      // Sort by element size - the footer element is likely larger
      nextRefreshElements.sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        return (bRect.width * bRect.height) - (aRect.width * aRect.height);
      });
      
      for (const el of nextRefreshElements) {
        // Look for a button in this element, its parent, or ancestors
        let currentEl = el;
        let refreshButton = null;
        
        // Check 3 levels up
        for (let i = 0; i < 3; i++) {
          if (!currentEl) break;
          
          refreshButton = currentEl.querySelector('button');
          if (refreshButton) {
            console.log('Found refresh button near "Next Refresh" text');
            refreshButton.click();
            return true;
          }
          
          // Move up one level
          currentEl = currentEl.parentElement;
        }
      }
    }
    
    // Method 4: Search for buttons with time indicators nearby
    const timerElements = Array.from(document.querySelectorAll('span, div')).filter(el => 
      el.textContent && /\d+\s*s(ec|econds)?$/.test(el.textContent.trim())
    );
    
    for (const timerEl of timerElements) {
      let currentEl = timerEl;
      
      // Check 3 levels up
      for (let i = 0; i < 3; i++) {
        if (!currentEl) break;
        
        const refreshButton = currentEl.querySelector('button');
        if (refreshButton) {
          console.log('Found refresh button near timer element');
          refreshButton.click();
          return true;
        }
        
        // Move up one level
        currentEl = currentEl.parentElement;
      }
    }
    
    // Method 5: Last resort - look for any refresh icon button
    const refreshIconButtons = Array.from(document.querySelectorAll('button')).filter(button => {
      // Check if the button has an icon that might be a refresh icon
      return button.querySelector('svg, i, span[class*="icon"], img');
    });
    
    // Check buttons at the bottom of the page first (more likely to be the refresh button)
    refreshIconButtons.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return bRect.bottom - aRect.bottom; // Sort by bottom position (higher value = lower on page)
    });
    
    if (refreshIconButtons.length > 0) {
      console.log('Found potential refresh button with icon');
      refreshIconButtons[0].click();
      return true;
    }
    
    // Method 6: Create a refresh button if needed
    console.log('Could not find refresh button, creating a custom one as a last resort');
    const customRefreshButton = document.createElement('button');
    customRefreshButton.textContent = 'Refresh Now';
    customRefreshButton.style.position = 'fixed';
    customRefreshButton.style.bottom = '60px';
    customRefreshButton.style.right = '10px';
    customRefreshButton.style.zIndex = '10000';
    customRefreshButton.style.padding = '8px 16px';
    customRefreshButton.style.backgroundColor = '#2F6EB5';
    customRefreshButton.style.color = 'white';
    customRefreshButton.style.border = 'none';
    customRefreshButton.style.borderRadius = '4px';
    customRefreshButton.style.cursor = 'pointer';
    
    customRefreshButton.addEventListener('click', () => {
      // Try to simulate a natural refresh action
      const refreshEvent = new Event('refreshRequested', { bubbles: true });
      document.dispatchEvent(refreshEvent);
      
      // If that doesn't work, reload the page as a last resort
      setTimeout(() => {
        window.location.reload();
      }, 100);
    });
    
    document.body.appendChild(customRefreshButton);
    console.log('Added custom refresh button');
    
    // Click the button to perform immediate refresh
    customRefreshButton.click();
    return true;
    
  } catch (error) {
    console.error('Error when attempting to refresh page:', error);
    
    // Final fallback - if everything fails, just reload the page
    try {
      window.location.reload();
      return true;
    } catch (reloadError) {
      console.error('Even reload failed:', reloadError);
      return false;
    }
  }
}

/**
 * Create an overlay element to show automation status
 */
function createOverlay() {
  // If overlay already exists, don't create it again
  if (overlayElement) {
    return;
  }
  
  console.log('Creating overlay element');
  
  // Create the overlay element
  overlayElement = document.createElement('div');
  overlayElement.style.position = 'fixed';
  overlayElement.style.bottom = '10px';
  overlayElement.style.right = '10px';
  overlayElement.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
  overlayElement.style.color = 'white';
  overlayElement.style.padding = '10px';
  overlayElement.style.borderRadius = '5px';
  overlayElement.style.zIndex = '9999';
  overlayElement.style.fontSize = '12px';
  overlayElement.style.fontFamily = 'Arial, sans-serif';
  overlayElement.style.cursor = 'pointer';
  overlayElement.style.userSelect = 'none';
  overlayElement.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
  
  // Add content to the overlay
  updateOverlayContent();
  
  // Add the overlay to the document
  document.body.appendChild(overlayElement);
}

/**
 * Update the content of the overlay element
 */
function updateOverlayContent() {
  if (!overlayElement) {
    return;
  }
  
  const refreshTimeStr = lastRefreshTime 
    ? new Date(lastRefreshTime).toLocaleTimeString() 
    : 'None';
  
  overlayElement.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 5px;">Relay Auto Booker (Simple)</div>
    <div>Status: <span style="color: #0f0;">Active</span></div>
    <div>Mode: <span style="color: #2196F3;">Auto Refresh</span></div>
    <div>Refresh count: ${refreshCount}</div>
    <div>Last refresh: ${refreshTimeStr}</div>
    <div style="font-size: 10px; margin-top: 5px; color: #ccc;">Refreshing automatically</div>
  `;
}

/**
 * Remove the overlay element
 */
function removeOverlay() {
  if (overlayElement) {
    console.log('Removing overlay element');
    overlayElement.remove();
    overlayElement = null;
  }
}