/**
 * Loadboard Fast Book functionality for the Relay Auto Booker extension
 * 
 * This script enhances the content script with fast booking capabilities
 */

// State for fast booking
let fastBookingEnabled = false;
let autoBookingEnabled = false;
let bookingQueue = [];
let isBookingInProgress = false;
let lastFoundLoads = [];

/**
 * Initialize fast booking functionality
 * @param {Object} settings - Current extension settings
 */
function initializeFastBooking(settings) {
  fastBookingEnabled = settings?.fastBook || false;
  autoBookingEnabled = settings?.autoBook || false;
  
  // Set up mutation observer to watch for new loads appearing
  const observerConfig = { childList: true, subtree: true };
  const targetNode = document.body;
  
  const observer = new MutationObserver(() => {
    if (fastBookingEnabled || autoBookingEnabled) {
      checkForNewLoads();
    }
  });
  
  observer.observe(targetNode, observerConfig);
  
  // Also check immediately when enabled
  if (fastBookingEnabled || autoBookingEnabled) {
    checkForNewLoads();
  }
  
  console.log(`Fast booking ${fastBookingEnabled ? 'enabled' : 'disabled'}`);
  console.log(`Auto booking ${autoBookingEnabled ? 'enabled' : 'disabled'}`);
}

/**
 * Check for new loads that match booking criteria
 */
async function checkForNewLoads() {
  if (isBookingInProgress) {
    return;
  }
  
  try {
    // Get all load items on the page
    const loadItems = findLoadItems();
    if (!loadItems || loadItems.length === 0) {
      return;
    }
    
    console.log(`Found ${loadItems.length} loads for potential booking`);
    
    // Extract data from each load item
    const currentLoads = [];
    
    for (const item of loadItems) {
      const loadData = extractLoadData(item);
      if (loadData) {
        loadData.element = item; // Store reference to DOM element
        currentLoads.push(loadData);
      }
    }
    
    // Check if loads match criteria
    const matchingLoads = currentLoads.filter(load => matchesFilters(load));
    
    // Check for new or price-changed loads
    const newOrChangedLoads = findNewOrChangedLoads(matchingLoads, lastFoundLoads);
    
    // Update our list of found loads - make a deep copy to avoid reference issues
    lastFoundLoads = JSON.parse(JSON.stringify(matchingLoads.map(load => {
      // Create a clean copy without the element reference
      const cleanLoad = {...load};
      delete cleanLoad.element;
      return cleanLoad;
    })));
    
    if (matchingLoads.length === 0) {
      return;
    }
    
    console.log(`Found ${matchingLoads.length} matching loads for booking`);
    if (newOrChangedLoads.length > 0) {
      console.log(`Found ${newOrChangedLoads.length} new or changed loads`);
    }
    
    // Always prioritize new or changed loads by adding them to the beginning of the queue
    if (autoBookingEnabled && newOrChangedLoads.length > 0) {
      // Sort new/changed loads by price (highest first)
      const sortedNewLoads = [...newOrChangedLoads].sort((a, b) => b.price - a.price);
      
      // Add new/changed loads to the BEGINNING of the queue
      for (const load of sortedNewLoads.reverse()) { // reverse to maintain price order at beginning
        // Remove if already in queue (to avoid duplicates)
        bookingQueue = bookingQueue.filter(queued => queued.id !== load.id);
        // Add to beginning of queue
        bookingQueue.unshift(load);
      }
      
      // Play notification for new/changed loads
      playNotificationSound('alert');
      showToast(`${newOrChangedLoads.length} new or updated loads found!`, 'success');
    } else if (autoBookingEnabled) {
      // For existing loads, add to end of queue if not already there
      const sortedLoads = [...matchingLoads].sort((a, b) => b.price - a.price);
      
      for (const load of sortedLoads) {
        if (!bookingQueue.some(queued => queued.id === load.id)) {
          bookingQueue.push(load);
        }
      }
    }
    
    // Start processing the queue if not already in progress
    if (autoBookingEnabled && !isBookingInProgress && bookingQueue.length > 0) {
      processBookingQueue();
    }
    
    // Add Fast Book buttons if enabled - prioritize new/changed loads
    if (fastBookingEnabled) {
      // Add Fast Book buttons to new/changed loads first
      for (const load of newOrChangedLoads) {
        if (load.element) {
          addFastBookButton(load.element, load, true); // true indicates it's a new/changed load
        }
      }
      
      // Then add to remaining loads
      for (const load of matchingLoads) {
        // Skip if it's a new/changed load (already processed)
        if (newOrChangedLoads.some(newLoad => newLoad.id === load.id)) {
          continue;
        }
        addFastBookButton(load.element, load, false);
      }
    }
  } catch (error) {
    console.error('Error checking for new loads:', error);
  }
}

/**
 * Find new loads or loads with changed prices
 * @param {Array} currentLoads - Current loads on the page
 * @param {Array} previousLoads - Previously found loads
 * @returns {Array} - New or changed loads
 */
function findNewOrChangedLoads(currentLoads, previousLoads) {
  const newOrChanged = [];
  
  for (const currentLoad of currentLoads) {
    // Find matching load in previous loads
    const previousLoad = previousLoads.find(prev => prev.id === currentLoad.id);
    
    // If not found, it's a new load
    if (!previousLoad) {
      currentLoad.isNew = true;
      newOrChanged.push(currentLoad);
      continue;
    }
    
    // If price changed, it's a changed load
    if (previousLoad.price !== currentLoad.price) {
      currentLoad.priceChanged = true;
      currentLoad.previousPrice = previousLoad.price;
      newOrChanged.push(currentLoad);
      continue;
    }
  }
  
  return newOrChanged;
}

/**
 * Add Fast Book button to a load item
 * @param {Element} item - The load item element
 * @param {Object} loadData - Data for the load
 * @param {boolean} isNewOrChanged - Whether this is a new or changed load
 */
function addFastBookButton(item, loadData, isNewOrChanged = false) {
  // Check if button already exists
  const existingButton = item.querySelector('.rab-fast-book');
  if (existingButton) {
    // If it's a new or changed load, update the existing button to highlight it
    if (isNewOrChanged) {
      existingButton.classList.add('rab-new-load');
      existingButton.style.background = '#FF5722'; // Orange for new/changed loads
      existingButton.style.animation = 'pulse 1.5s infinite';
      
      // Add a price change indicator if applicable
      if (loadData.priceChanged) {
        const priceChange = document.createElement('span');
        const priceDiff = loadData.price - loadData.previousPrice;
        const sign = priceDiff > 0 ? '+' : '';
        priceChange.textContent = `${sign}$${priceDiff.toFixed(2)}`;
        priceChange.style.cssText = `
          position: absolute;
          top: -15px;
          right: 0;
          font-size: 11px;
          font-weight: bold;
          color: ${priceDiff >= 0 ? '#4CAF50' : '#F44336'};
          background: white;
          padding: 2px 4px;
          border-radius: 2px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        `;
        existingButton.appendChild(priceChange);
      }
    }
    return;
  }
  
  // Create the Fast Book button to match the video
  const fastBookBtn = document.createElement('button');
  fastBookBtn.textContent = isNewOrChanged ? 'New! Fast Book' : 'Fast Book';
  fastBookBtn.className = 'rab-fast-book';
  
  // Add special class for new/changed loads
  if (isNewOrChanged) {
    fastBookBtn.classList.add('rab-new-load');
  }
  
  fastBookBtn.style.cssText = `
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: ${isNewOrChanged ? '#FF5722' : '#3869D4'}; /* Orange for new loads, blue for regular */
    color: white;
    border: none;
    border-radius: 3px;
    padding: 6px 12px;
    font-weight: 500;
    font-size: 13px;
    cursor: pointer;
    z-index: 100;
    ${isNewOrChanged ? 'animation: pulse 1.5s infinite;' : ''}
  `;
  fastBookBtn.dataset.id = loadData.id;
  
  // Add a price change indicator if applicable
  if (isNewOrChanged && loadData.priceChanged) {
    const priceChange = document.createElement('span');
    const priceDiff = loadData.price - loadData.previousPrice;
    const sign = priceDiff > 0 ? '+' : '';
    priceChange.textContent = `${sign}$${priceDiff.toFixed(2)}`;
    priceChange.style.cssText = `
      position: absolute;
      top: -15px;
      right: 0;
      font-size: 11px;
      font-weight: bold;
      color: ${priceDiff >= 0 ? '#4CAF50' : '#F44336'};
      background: white;
      padding: 2px 4px;
      border-radius: 2px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    `;
    fastBookBtn.appendChild(priceChange);
  }
  
  // Add click handler that initiates booking immediately
  fastBookBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Visual feedback - show loading state
    const originalText = fastBookBtn.textContent;
    fastBookBtn.textContent = 'Booking...';
    fastBookBtn.style.opacity = '0.7';
    
    // Initiate booking
    bookLoad(loadData.id).then(result => {
      if (result.success) {
        // Success visual feedback
        fastBookBtn.textContent = 'Booked!';
        fastBookBtn.style.backgroundColor = '#4caf50';
        
        // Reset after 2 seconds
        setTimeout(() => {
          fastBookBtn.textContent = originalText;
          fastBookBtn.style.backgroundColor = isNewOrChanged ? '#FF5722' : '#3869D4';
          fastBookBtn.style.opacity = '1';
        }, 2000);
        
        // Play success sound (if available)
        playNotificationSound('success');
      } else {
        // Error visual feedback
        fastBookBtn.textContent = 'Failed!';
        fastBookBtn.style.backgroundColor = '#f44336';
        
        // Reset after 2 seconds
        setTimeout(() => {
          fastBookBtn.textContent = originalText;
          fastBookBtn.style.backgroundColor = isNewOrChanged ? '#FF5722' : '#3869D4';
          fastBookBtn.style.opacity = '1';
        }, 2000);
        
        // Play error sound (if available)
        playNotificationSound('error');
      }
    });
  });
  
  // Append to item
  item.appendChild(fastBookBtn);
}

/**
 * Process the booking queue
 */
async function processBookingQueue() {
  if (isBookingInProgress || bookingQueue.length === 0) {
    return;
  }
  
  isBookingInProgress = true;
  
  try {
    // Get the next load to book (from the beginning of the queue)
    const loadToBook = bookingQueue.shift();
    console.log('Processing booking for load:', loadToBook);
    
    // Attempt to book the load
    const result = await bookLoad(loadToBook.id);
    
    if (result.success) {
      console.log('Successfully booked load:', loadToBook.id);
      playNotificationSound('success');
      showToast(`Successfully booked load: ${loadToBook.origin} to ${loadToBook.destination}`, 'success');
      
      // Clear the queue - we've booked one successfully
      bookingQueue = [];
      
      // Notify the main content script that we've booked a load
      window.dispatchEvent(new CustomEvent('rab-load-booked', { detail: loadToBook }));
      
      // IMPORTANT: Don't automatically stop automation after booking
      // This was causing the issue where the Stop button was automatically pressed
      // Instead, let the user decide when to stop
      
      // Just notify that a load was booked
      window.dispatchEvent(new CustomEvent('rab-load-booked-success', { 
        detail: { load: loadToBook, message: 'Load booked successfully!' } 
      }));
    } else {
      console.log('Failed to book load:', loadToBook.id, result.error);
      showToast(`Failed to book load: ${result.error}`, 'error');
      
      // Continue with the next load in the queue
      if (bookingQueue.length > 0) {
        setTimeout(() => {
          isBookingInProgress = false;
          processBookingQueue();
        }, 1000); // Wait a second before trying the next one
      } else {
        isBookingInProgress = false;
      }
    }
  } catch (error) {
    console.error('Error processing booking queue:', error);
    isBookingInProgress = false;
  }
}

/**
 * Book a load by ID
 * @param {string} loadId - The ID of the load to book
 * @returns {Promise<Object>} - Result of booking attempt
 */
async function bookLoad(loadId) {
  if (isBookingInProgress) {
    return { success: false, error: 'Already processing a booking' };
  }
  
  try {
    isBookingInProgress = true;
    console.log(`Attempting to book load: ${loadId}`);
    
    // Find the load in the last found loads
    const loadToBook = lastFoundLoads.find(load => load.id === loadId);
    
    if (!loadToBook) {
      throw new Error('Load not found in the list of matching loads');
    }
    
    // Find the element with the load
    const loadElement = loadToBook.element;
    if (!loadElement) {
      throw new Error('Load element not found');
    }
    
    // Find the Book button in the load element
    const bookButton = findBookButton(loadElement);
    
    if (!bookButton) {
      throw new Error('Book button not found for this load');
    }
    
    // Click the book button
    bookButton.click();
    
    // Wait for the booking form/modal to appear (timeout after 5 seconds)
    await new Promise((resolve, reject) => {
      const maxAttempts = 50; // 5 seconds total (100ms intervals)
      let attempts = 0;
      
      const checkForForm = () => {
        const formElement = document.querySelector('.booking-form, .booking-modal, form[action*="book"], [role="dialog"]');
        
        if (formElement) {
          resolve(formElement);
        } else if (++attempts >= maxAttempts) {
          reject(new Error('Booking form did not appear after waiting'));
        } else {
          setTimeout(checkForForm, 100);
        }
      };
      
      checkForForm();
    });
    
    // Wait a moment for form to be fully interactive
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Find and click the submit/confirm button
    const submitButton = document.querySelector(
      '.confirm-booking, .submit-booking, button[type="submit"], button:contains("Confirm"), button:contains("Book")'
    );
    
    if (!submitButton) {
      throw new Error('Submit/confirm button not found');
    }
    
    // Click the submit button
    submitButton.click();
    
    // Wait for confirmation (timeout after 5 seconds)
    const bookingConfirmed = await new Promise((resolve) => {
      const maxAttempts = 50; // 5 seconds total
      let attempts = 0;
      
      const checkForConfirmation = () => {
        // Look for success messages or redirects
        const successMessage = document.querySelector(
          '.booking-success, .success-message, .confirmation, [class*="success"]'
        );
        
        // Also check if we've been redirected away from the booking form
        const formGone = !document.querySelector(
          '.booking-form, .booking-modal, form[action*="book"], [role="dialog"]'
        );
        
        if (successMessage || formGone) {
          resolve(true);
        } else if (++attempts >= maxAttempts) {
          resolve(false); // Timed out but don't throw error
        } else {
          setTimeout(checkForConfirmation, 100);
        }
      };
      
      checkForConfirmation();
    });
    
    if (bookingConfirmed) {
      console.log('Booking confirmed successfully');
      return { success: true, load: loadToBook };
    } else {
      console.log('Booking may have failed or is still processing');
      return { success: false, error: 'Booking confirmation not detected' };
    }
  } catch (error) {
    console.error('Error booking load:', error);
    return { success: false, error: error.message };
  } finally {
    isBookingInProgress = false;
  }
}

/**
 * Find the book button for a load element
 * @param {Element} loadElement - The load element
 * @returns {Element|null} - The book button or null if not found
 */
function findBookButton(loadElement) {
  // First check for any button with "Book" text
  const bookButtonByText = Array.from(loadElement.querySelectorAll('button')).find(btn => 
    btn.textContent.trim().toLowerCase() === 'book'
  );
  
  if (bookButtonByText) {
    return bookButtonByText;
  }
  
  // Try more general selectors
  return loadElement.querySelector(
    'button.book-button, button[class*="book"], a.book-button, a[class*="book"], [role="button"][class*="book"]'
  );
}

/**
 * Check if a load matches the current filters
 * @param {Object} load - The load data
 * @returns {boolean} - Whether the load matches the filters
 */
function matchesFilters(load) {
  // Get settings from main content script
  const settings = window.getSettings ? window.getSettings() : {};
  const filters = settings?.filters || {};
  const activeMode = settings?.activeMode || 'search';
  
  // For alerts, we don't filter
  if (activeMode === 'alert') {
    return true;
  }
  
  // Check distance
  if (load.distance < (filters.distanceMin || 0)) {
    return false;
  }
  
  if (filters.distanceMax && load.distance > filters.distanceMax) {
    return false;
  }
  
  // Check price/payout
  if (filters.payoutMin && load.price < filters.payoutMin) {
    return false;
  }
  
  // Check departure time if set
  if (filters.maxDeparture && load.departureTime) {
    // Convert strings to Date objects for comparison
    const maxDeparture = new Date(filters.maxDeparture);
    const loadDeparture = new Date(load.departureTime);
    
    if (loadDeparture > maxDeparture) {
      return false;
    }
  }
  
  // Check number of stops
  if (filters.stopsMax !== undefined && load.stops > filters.stopsMax) {
    return false;
  }
  
  // Add more filter checks as needed
  
  return true;
}

/**
 * Play notification sound based on type
 * @param {string} type - Sound type ('success', 'alert', 'error')
 */
function playNotificationSound(type = 'alert') {
  try {
    let soundUrl;
    
    switch (type) {
      case 'success':
        soundUrl = chrome.runtime.getURL('sounds/success.mp3');
        break;
      case 'error':
        soundUrl = chrome.runtime.getURL('sounds/error.mp3');
        break;
      case 'alert':
      default:
        soundUrl = chrome.runtime.getURL('sounds/alert.mp3');
        break;
    }
    
    const audio = new Audio(soundUrl);
    audio.volume = 0.8; // 80% volume
    audio.play().catch(err => console.error('Error playing sound:', err));
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Notification type ('info', 'success', 'error')
 * @param {number} duration - Duration in milliseconds
 */
function showToast(message, type = 'info', duration = 3000) {
  // Check if toast container exists, create if not
  let toastContainer = document.querySelector('.rab-toast-container');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'rab-toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    `;
    document.body.appendChild(toastContainer);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `rab-toast rab-toast-${type}`;
  toast.style.cssText = `
    background-color: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
    color: white;
    padding: 12px 16px;
    border-radius: 4px;
    margin-bottom: 10px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    font-size: 14px;
    max-width: 300px;
    opacity: 0;
    transform: translateY(-20px);
    transition: opacity 0.3s, transform 0.3s;
  `;
  toast.textContent = message;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);
  
  // Remove after duration
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    
    // Remove from DOM after animation
    setTimeout(() => {
      toastContainer.removeChild(toast);
    }, 300);
  }, duration);
}