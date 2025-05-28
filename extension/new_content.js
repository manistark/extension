/**
 * Content script for the Amazon Relay Auto Booker extension
 * 
 * This script is injected into relay.amazon.in pages and interacts directly with the DOM
 */

// State
let settings = {};
let isProcessing = false;
let lastFoundLoads = [];
let enhancementsInitialized = false;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'refresh':
      refreshPage();
      sendResponse({ success: true });
      break;
    
    case 'checkForLoads':
      checkForLoads(message.settings)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Async response
    
    case 'bookLoad':
      bookLoad(message.loadId, message.settings)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Async response
    
    case 'updateSettings':
      settings = message.settings;
      
      // Initialize or update fast booking with new settings
      if (typeof initializeFastBooking === 'function') {
        initializeFastBooking(settings.isAutobookEnabled);
      }
      
      // Initialize or update loadboard actions with new settings
      if (typeof initializeLoadboardActions === 'function') {
        initializeLoadboardActions(settings);
      }
      
      sendResponse({ success: true });
      break;
      
    case 'getSettings':
      sendResponse(settings);
      break;
  }
});

// Initialize enhancement features when the page is fully loaded
window.addEventListener('load', () => {
  if (!enhancementsInitialized) {
    enhancementsInitialized = true;
    
    // Load settings and initialize enhancements
    chrome.runtime.sendMessage({ action: 'getAutomationStatus' }, response => {
      if (response && response.isActive) {
        // Get current settings
        chrome.runtime.sendMessage({ action: 'getSettings' }, currentSettings => {
          settings = currentSettings || settings;
          
          // Initialize fast booking
          if (typeof initializeFastBooking === 'function') {
            initializeFastBooking(settings.isAutobookEnabled);
          }
          
          // Initialize loadboard actions
          if (typeof initializeLoadboardActions === 'function') {
            initializeLoadboardActions(settings);
          }
        });
      }
    });
  }
});

/**
 * Refresh the page using the "Next Refresh" button at the bottom of the loadboard
 * Based on the screenshot provided by the user
 */
function refreshPage() {
  console.log('Looking for the "Next Refresh" button...');
  
  // Method 1: Try to find the refresh button based on the text "Next Refresh" and a button nearby
  const nextRefreshText = Array.from(document.querySelectorAll('*')).find(el => 
    el.textContent && el.textContent.trim() === 'Next Refresh'
  );
  
  if (nextRefreshText) {
    // Find the nearest button element, likely the refresh button
    const refreshButton = nextRefreshText.parentElement.querySelector('button');
    if (refreshButton) {
      console.log('Found refresh button next to "Next Refresh" text');
      refreshButton.click();
      return true;
    }
    
    // Look for any button in the parent container
    const parentContainer = nextRefreshText.closest('div');
    if (parentContainer) {
      const buttonInContainer = parentContainer.querySelector('button');
      if (buttonInContainer) {
        console.log('Found button in the parent container of "Next Refresh" text');
        buttonInContainer.click();
        return true;
      }
    }
  }
  
  // Method 2: Try to find the specific bottom area with the refresh button
  // Based on the screenshot, this looks like a section with text and a button with a refresh icon
  const bottomRefreshArea = document.querySelector('.refresh-section, [class*="refresh"], [id*="refresh"]');
  if (bottomRefreshArea) {
    const refreshButton = bottomRefreshArea.querySelector('button');
    if (refreshButton) {
      console.log('Found refresh button in the bottom refresh area');
      refreshButton.click();
      return true;
    }
  }
  
  // Method 3: Target the refresh icon specifically
  const refreshIcon = document.querySelector('svg[class*="refresh"], i[class*="refresh"], [class*="refresh-icon"]');
  if (refreshIcon) {
    const clickableParent = refreshIcon.closest('button, a');
    if (clickableParent) {
      console.log('Found refresh button via its icon');
      clickableParent.click();
      return true;
    }
  }
  
  // Method 4: Look for elements that have text including both "Next" and "Refresh"
  const refreshContainer = Array.from(document.querySelectorAll('div, span, section')).find(el => {
    const text = el.textContent;
    return text && text.includes('Next') && text.includes('Refresh');
  });
  
  if (refreshContainer) {
    // Try to find the refresh button in this container
    const buttons = refreshContainer.querySelectorAll('button');
    if (buttons.length > 0) {
      console.log('Found refresh button in container with "Next Refresh" text');
      buttons[0].click();
      return true;
    }
  }
  
  // Method 5: Based on the specific selector for the button seen in the screenshot
  // Looking for a button near a seconds counter, which is shown in the screenshot
  const refreshButtonWithTimer = document.querySelector('button[aria-label="Refresh"], button[title*="refresh"], button.refresh-button');
  if (refreshButtonWithTimer) {
    console.log('Found refresh button with specific selector');
    refreshButtonWithTimer.click();
    return true;
  }
  
  // Method 6: Look for buttons near elements containing "s" (seconds indicator)
  const secondsIndicator = Array.from(document.querySelectorAll('span, div')).find(el => 
    el.textContent && /^\d+s$/.test(el.textContent.trim())
  );
  
  if (secondsIndicator) {
    const refreshButton = secondsIndicator.parentElement.querySelector('button') || 
                          secondsIndicator.closest('div').querySelector('button');
    if (refreshButton) {
      console.log('Found refresh button near seconds indicator');
      refreshButton.click();
      return true;
    }
  }
  
  // Method 7: Try specifically for the element shown in the screenshot 
  // It has text "Next Refresh 25s" and a button with a refresh icon
  // Using a more generic finder based on the structure
  console.log('Trying to find the refresh button based on screenshot pattern...');
  const elements = document.querySelectorAll('div');
  for (const el of elements) {
    if (el.textContent && el.textContent.includes('Next Refresh') && el.textContent.includes('s')) {
      // This is likely the container we want
      console.log('Found container with "Next Refresh Xs" text');
      
      // Look for buttons in this container or nearby
      const refreshButton = el.querySelector('button') || 
                          el.parentElement.querySelector('button') ||
                          el.closest('div').querySelector('button');
      
      if (refreshButton) {
        console.log('Found refresh button in the refresh container');
        refreshButton.click();
        return true;
      }
    }
  }
  
  console.log('WARNING: Could not find the refresh button - this may affect the extension functionality');
  // We don't use window.location.reload() anymore as it's not the desired behavior
  console.log('Please ensure you are on the Amazon Relay loadboard page');
}

/**
 * Check for available loads that match criteria
 * @param {Object} settings - Filter settings
 * @returns {Promise<Object>} - Result with loads
 */
async function checkForLoads(settings) {
  if (isProcessing) {
    return { success: false, error: 'Already processing loads' };
  }
  
  try {
    isProcessing = true;
    console.log('Checking for loads with settings:', settings);
    
    // Wait for loads to be loaded in the DOM
    await waitForLoadsToLoad();
    
    // Different methods to detect loads, for resilience
    const loads = await detectLoads();
    
    if (!loads || loads.length === 0) {
      console.log('No loads found on the page');
      isProcessing = false;
      return { success: true, loads: [] };
    }
    
    console.log(`Found ${loads.length} loads on the page`);
    
    // Apply filters
    const matchingLoads = loads.filter(load => matchesFilter(load, settings.filters[0]));
    
    console.log(`${matchingLoads.length} loads match the filter criteria`);
    
    // Save the last found matching loads
    lastFoundLoads = matchingLoads;
    
    // If there are matching loads, play a sound and update stats
    if (matchingLoads.length > 0 && settings.isAlertEnabled) {
      playNewLoadAlert(matchingLoads);
      
      // Update match count in the background script
      chrome.runtime.sendMessage({
        action: 'statsUpdated',
        stats: {
          matchCount: matchingLoads.length,
          refreshCount: 0 // We don't update refresh count here
        }
      });
    }
    
    isProcessing = false;
    return { success: true, loads: matchingLoads };
  } catch (error) {
    console.error('Error checking for loads:', error);
    isProcessing = false;
    return { success: false, error: error.message };
  }
}

/**
 * Book a specific load
 * @param {string} loadId - ID of the load to book
 * @param {Object} settings - Booking settings
 * @returns {Promise<Object>} - Result of booking attempt
 */
async function bookLoad(loadId, settings) {
  if (isProcessing) {
    return { success: false, error: 'Already processing a booking' };
  }
  
  try {
    isProcessing = true;
    console.log(`Attempting to book load: ${loadId}`);
    
    // Find the load in the last found loads
    const loadToBook = lastFoundLoads.find(load => load.id === loadId);
    
    if (!loadToBook) {
      throw new Error('Load not found in the list of matching loads');
    }
    
    // Find and click the book button for this load
    const bookButton = await findBookButtonForLoad(loadId);
    
    if (!bookButton) {
      throw new Error('Book button not found for this load');
    }
    
    // Click the book button
    bookButton.click();
    
    // Wait for the booking form/modal to appear
    await waitForElement('.booking-form, .booking-modal, form[action*="book"]');
    
    // Fill out booking form if needed
    await fillBookingForm();
    
    // Find and click the submit/confirm button
    const submitButton = document.querySelector('.confirm-booking, .submit-booking, button[type="submit"]');
    
    if (submitButton) {
      submitButton.click();
      
      // Wait for confirmation message or redirect
      const success = await waitForBookingConfirmation();
      
      if (success) {
        console.log('Booking confirmed successfully');
        // Play success sound
        const successAudio = new Audio(chrome.runtime.getURL('successbook.mp3'));
        successAudio.play().catch(error => {
          console.error('Error playing success sound:', error);
        });
        
        // Send success notification
        chrome.runtime.sendMessage({
          action: 'bookingSuccess',
          load: loadToBook
        });
      } else {
        console.log('Booking not confirmed');
      }
      
      isProcessing = false;
      return { success: success, load: loadToBook };
    } else {
      throw new Error('Submit button not found');
    }
  } catch (error) {
    console.error('Error booking load:', error);
    isProcessing = false;
    return { success: false, error: error.message };
  }
}

/**
 * Play alert sound for new loads
 * @param {Array} loads - The matching loads
 */
function playNewLoadAlert(loads) {
  try {
    console.log('Playing alert for new loads');
    
    // Send message to background script to play alert
    chrome.runtime.sendMessage({
      action: 'playAlert',
      matches: loads
    });
    
    // Also try to play locally in case background fails
    try {
      const newLoadAudio = new Audio(chrome.runtime.getURL('new.mp3'));
      newLoadAudio.play().catch(error => {
        console.error('Error playing new load alert sound:', error);
      });
    } catch (error) {
      console.error('Error creating audio element:', error);
    }
  } catch (error) {
    console.error('Error playing new load alert:', error);
  }
}

/**
 * Wait for loads to be loaded in the DOM
 * @returns {Promise<void>}
 */
async function waitForLoadsToLoad() {
  console.log('Waiting for loads to load in the DOM...');
  
  // Try different selectors that might indicate loads are present
  const selectors = [
    '.load-item', 
    '.opportunity-item', 
    'tr:not(:first-child)', 
    '[data-test-id="load-item"]', 
    '[data-test-id="opportunity"]'
  ];
  
  for (const selector of selectors) {
    try {
      await waitForElement(selector, 10000); // Wait up to 10 seconds
      console.log(`Found loads with selector: ${selector}`);
      return;
    } catch (error) {
      console.log(`No loads found with selector: ${selector}`);
    }
  }
  
  // If no loads found with selectors, wait a bit more and assume they might be loaded
  console.log('No loads found with known selectors, waiting additional time...');
  await new Promise(resolve => setTimeout(resolve, 3000));
}

/**
 * Detect available loads on the page
 * @returns {Promise<Array>} - Array of load objects
 */
async function detectLoads() {
  console.log('Detecting loads on the page...');
  
  // Try different methods to extract loads
  const methods = [
    extractLoadsMethod1, 
    extractLoadsMethod2, 
    extractLoadsMethod3
  ];
  
  for (const method of methods) {
    try {
      const loads = await method();
      if (loads && loads.length > 0) {
        console.log(`Detected ${loads.length} loads using ${method.name}`);
        return loads;
      }
    } catch (error) {
      console.error(`Error using ${method.name}:`, error);
    }
  }
  
  console.log('No loads detected with any method');
  return [];
}

/**
 * First method to extract loads from the DOM
 * @returns {Promise<Array>} - Array of load objects
 */
async function extractLoadsMethod1() {
  const loadItems = document.querySelectorAll('.load-item, .opportunity-item');
  const loads = [];
  
  for (const item of loadItems) {
    try {
      const id = item.getAttribute('data-load-id') || item.id || generateRandomId();
      
      const load = {
        id,
        origin: extractText(item, '.origin, [data-test-id="origin"]'),
        destination: extractText(item, '.destination, [data-test-id="destination"]'),
        distance: extractNumber(item, '.distance, [data-test-id="distance"]'),
        payout: extractCurrency(item, '.payout, [data-test-id="payout"]'),
        stops: extractNumber(item, '.stops, [data-test-id="stops"]'),
        deadhead: extractNumber(item, '.deadhead, [data-test-id="deadhead"]'),
        equipment: extractText(item, '.equipment, [data-test-id="equipment"]'),
        pickupTime: extractText(item, '.pickup-time, [data-test-id="pickup-time"]'),
        deliveryTime: extractText(item, '.delivery-time, [data-test-id="delivery-time"]'),
        element: item
      };
      
      loads.push(load);
    } catch (error) {
      console.error('Error extracting load:', error);
    }
  }
  
  return loads;
}

/**
 * Second method to extract loads from the DOM
 * @returns {Promise<Array>} - Array of load objects
 */
async function extractLoadsMethod2() {
  const loadRows = document.querySelectorAll('tr:not(:first-child)');
  const loads = [];
  
  for (const row of loadRows) {
    try {
      const cells = row.querySelectorAll('td');
      if (cells.length < 5) continue; // Skip rows with too few cells
      
      const id = row.getAttribute('data-id') || row.id || generateRandomId();
      
      const load = {
        id,
        origin: cells[0]?.textContent.trim() || '',
        destination: cells[1]?.textContent.trim() || '',
        distance: parseFloat(cells[2]?.textContent.trim().replace(/[^0-9.]/g, '')) || 0,
        payout: parseCurrency(cells[3]?.textContent.trim() || '0'),
        stops: parseInt(cells[4]?.textContent.trim().replace(/[^0-9]/g, '') || '0', 10),
        deadhead: parseFloat(cells[5]?.textContent.trim().replace(/[^0-9.]/g, '')) || 0,
        equipment: cells[6]?.textContent.trim() || '',
        pickupTime: cells[7]?.textContent.trim() || '',
        deliveryTime: cells[8]?.textContent.trim() || '',
        element: row
      };
      
      loads.push(load);
    } catch (error) {
      console.error('Error extracting load from row:', error);
    }
  }
  
  return loads;
}

/**
 * Third method to extract loads using a more general approach
 * @returns {Promise<Array>} - Array of load objects
 */
async function extractLoadsMethod3() {
  // This is a more generic approach searching for common patterns
  const originElements = document.querySelectorAll('[data-test*="origin"], [class*="origin"], [id*="origin"]');
  const loads = [];
  
  for (const originElement of originElements) {
    try {
      // Find the container element that holds all load info
      const container = originElement.closest('.load-container, .opportunity, tr, .card, .item, div[role="row"]');
      if (!container) continue;
      
      const id = container.getAttribute('data-id') || container.id || generateRandomId();
      
      // Look for specific data within this container
      const load = {
        id,
        origin: originElement.textContent.trim(),
        destination: '',
        distance: 0,
        payout: 0,
        stops: 0,
        deadhead: 0,
        equipment: '',
        pickupTime: '',
        deliveryTime: '',
        element: container
      };
      
      // Find siblings or related elements
      const destinationElement = container.querySelector('[data-test*="destination"], [class*="destination"], [id*="destination"]');
      if (destinationElement) {
        load.destination = destinationElement.textContent.trim();
      }
      
      const distanceElement = container.querySelector('[data-test*="distance"], [class*="distance"], [id*="distance"]');
      if (distanceElement) {
        load.distance = parseFloat(distanceElement.textContent.trim().replace(/[^0-9.]/g, '')) || 0;
      }
      
      const payoutElement = container.querySelector('[data-test*="payout"], [data-test*="price"], [class*="payout"], [class*="price"], [id*="payout"], [id*="price"]');
      if (payoutElement) {
        load.payout = parseCurrency(payoutElement.textContent.trim() || '0');
      }
      
      loads.push(load);
    } catch (error) {
      console.error('Error with general extraction approach:', error);
    }
  }
  
  return loads;
}

/**
 * Check if a load matches the filter criteria
 * @param {Object} load - The load to check
 * @param {Object} filter - The filter criteria
 * @returns {boolean} - Whether the load matches
 */
function matchesFilter(load, filter) {
  // Distance checks
  if (load.distance < filter.distanceMin || load.distance > filter.distanceMax) {
    return false;
  }
  
  // Payout check
  if (load.payout < filter.payoutMin) {
    return false;
  }
  
  // Stops check
  if (load.stops > filter.stopsMax) {
    return false;
  }
  
  // Deadhead percentage check
  if (load.deadhead > filter.maxDeadhead) {
    return false;
  }
  
  // Duration check (if not "any")
  if (filter.maxDuration !== 'any') {
    // This is a simple implementation - would need to be adapted to actual data
    const pickupDate = new Date(load.pickupTime);
    const deliveryDate = new Date(load.deliveryTime);
    
    if (filter.maxDuration === 'sameday') {
      if (pickupDate.getDate() !== deliveryDate.getDate() || 
          pickupDate.getMonth() !== deliveryDate.getMonth() ||
          pickupDate.getFullYear() !== deliveryDate.getFullYear()) {
        return false;
      }
    } else if (filter.maxDuration === 'overnight') {
      // Overnight means delivery is the next day
      const nextDay = new Date(pickupDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      if (deliveryDate.getDate() !== nextDay.getDate() || 
          deliveryDate.getMonth() !== nextDay.getMonth() ||
          deliveryDate.getFullYear() !== nextDay.getFullYear()) {
        return false;
      }
    } else if (filter.maxDuration === 'multiday') {
      // Multi-day means more than one day difference
      const nextDay = new Date(pickupDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      if (deliveryDate <= nextDay) {
        return false;
      }
    }
  }
  
  // Filter by specific field (if not "no filter")
  if (filter.filterBy !== 'no filter' && filter.filterText) {
    const text = filter.filterText.toLowerCase();
    
    switch (filter.filterBy) {
      case 'origin':
        if (!load.origin.toLowerCase().includes(text)) {
          return false;
        }
        break;
        
      case 'destination':
        if (!load.destination.toLowerCase().includes(text)) {
          return false;
        }
        break;
        
      case 'equipment':
        if (!load.equipment.toLowerCase().includes(text)) {
          return false;
        }
        break;
    }
  }
  
  // Stem time check (if present)
  if (filter.stemTime > 0) {
    // This would need knowledge of the user's location relative to the origin
    // As a placeholder, we'll assume this is already calculated and stored in the load object
    if (load.stemTime && load.stemTime > filter.stemTime) {
      return false;
    }
  }
  
  // If all checks pass, the load matches the filter
  return true;
}

/**
 * Find the book button for a specific load
 * @param {string} loadId - ID of the load
 * @returns {Promise<Element|null>} - The book button element or null
 */
async function findBookButtonForLoad(loadId) {
  try {
    console.log(`Finding book button for load: ${loadId}`);
    
    // First try to find the load element
    const loadToBook = lastFoundLoads.find(load => load.id === loadId);
    
    if (loadToBook && loadToBook.element) {
      // Try to find the book button within the load element
      const bookButton = loadToBook.element.querySelector('button[contains(text(), "Book")], button[class*="book"], [data-test-id="book-button"]');
      
      if (bookButton) {
        console.log('Found book button in load element');
        return bookButton;
      }
    }
    
    // If not found within the load element, try a broader search
    console.log('Trying broader search for book button');
    
    // Look for buttons that may be associated with this load
    const allBookButtons = document.querySelectorAll('button:contains("Book"), button[class*="book"], [data-test-id="book-button"]');
    
    for (const button of allBookButtons) {
      // Try to find a connection to the load ID
      const container = button.closest('[data-load-id], [id*="load"], [class*="load-item"], tr');
      
      if (container) {
        const containerId = container.getAttribute('data-load-id') || container.id;
        if (containerId && containerId.includes(loadId)) {
          console.log('Found book button with matching container ID');
          return button;
        }
      }
    }
    
    // If still not found, fall back to any book button (risky, but last resort)
    if (allBookButtons.length > 0) {
      console.warn('Could not find specific book button for this load, using first available book button');
      return allBookButtons[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error finding book button:', error);
    return null;
  }
}

/**
 * Fill out the booking form
 * @returns {Promise<void>}
 */
async function fillBookingForm() {
  try {
    console.log('Filling booking form...');
    
    // Wait a moment for the form to be fully loaded
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // This is a placeholder - actual form filling would depend on the website's structure
    // and potentially user-supplied values in settings
    
    // Example: Check for checkboxes that might need to be selected
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    for (const checkbox of checkboxes) {
      // Look for terms & conditions checkboxes which are often required
      if (checkbox.id?.toLowerCase().includes('terms') || 
          checkbox.name?.toLowerCase().includes('terms') ||
          checkbox.parentElement?.textContent.toLowerCase().includes('agree')) {
        console.log('Found terms checkbox, checking it');
        if (!checkbox.checked) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
    
    // Example: Fill required text inputs if they're empty
    const requiredInputs = document.querySelectorAll('input[required]');
    for (const input of requiredInputs) {
      if (input.value === '') {
        if (input.type === 'text' || input.type === 'tel' || input.type === 'email') {
          // This would preferably come from user settings
          if (input.id?.toLowerCase().includes('phone') || input.name?.toLowerCase().includes('phone')) {
            input.value = '5555555555'; // Placeholder
          } else if (input.id?.toLowerCase().includes('email') || input.name?.toLowerCase().includes('email')) {
            input.value = 'example@example.com'; // Placeholder
          }
          
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
    
    console.log('Booking form filled');
  } catch (error) {
    console.error('Error filling booking form:', error);
  }
}

/**
 * Wait for booking confirmation
 * @returns {Promise<boolean>} - Whether booking was confirmed
 */
async function waitForBookingConfirmation() {
  try {
    console.log('Waiting for booking confirmation...');
    
    // Wait for confirmation indicators
    const confirmationSelectors = [
      '.booking-confirmed', 
      '.confirmation', 
      '.success-message',
      'div:contains("Booking Successful")',
      'div:contains("Booking Confirmed")'
    ];
    
    for (const selector of confirmationSelectors) {
      try {
        await waitForElement(selector, 10000); // Wait up to 10 seconds
        console.log(`Booking confirmation found with selector: ${selector}`);
        return true;
      } catch (error) {
        // Continue to next selector
      }
    }
    
    // If no confirmation found with selectors, check for URL changes that might indicate success
    const currentUrl = window.location.href;
    if (currentUrl.includes('confirmation') || currentUrl.includes('success') || currentUrl.includes('booked')) {
      console.log('Booking confirmation detected via URL change');
      return true;
    }
    
    console.log('No booking confirmation detected');
    return false;
  } catch (error) {
    console.error('Error waiting for booking confirmation:', error);
    return false;
  }
}

/**
 * Wait for an element to appear in the DOM
 * @param {string} selector - CSS selector to wait for
 * @param {number} timeout - Maximum time to wait in ms (default: 5000)
 * @returns {Promise<Element>} - The found element
 */
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    // Check if element already exists
    const element = document.querySelector(selector);
    if (element) {
      return resolve(element);
    }
    
    // Set a timeout
    const timeoutId = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);
    
    // Set up mutation observer
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        clearTimeout(timeoutId);
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

/**
 * Extract text from an element
 * @param {Element} parent - Parent element
 * @param {string} selector - CSS selector
 * @returns {string} - Extracted text or empty string
 */
function extractText(parent, selector) {
  const element = parent.querySelector(selector);
  return element ? element.textContent.trim() : '';
}

/**
 * Extract and parse a number from an element
 * @param {Element} parent - Parent element
 * @param {string} selector - CSS selector
 * @returns {number} - Parsed number or 0
 */
function extractNumber(parent, selector) {
  const text = extractText(parent, selector);
  return parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
}

/**
 * Extract and parse currency from an element
 * @param {Element} parent - Parent element
 * @param {string} selector - CSS selector
 * @returns {number} - Parsed currency amount or 0
 */
function extractCurrency(parent, selector) {
  const text = extractText(parent, selector);
  return parseCurrency(text);
}

/**
 * Parse currency value from text
 * @param {string} text - Text containing currency
 * @returns {number} - Parsed currency amount or 0
 */
function parseCurrency(text) {
  // Remove currency symbols, commas, etc. and parse as float
  const numericValue = text.replace(/[^0-9.]/g, '');
  return parseFloat(numericValue) || 0;
}

/**
 * Generate a random ID for loads that don't have one
 * @returns {string} - Random ID
 */
function generateRandomId() {
  return 'load_' + Math.random().toString(36).substring(2, 10);
}