/**
 * Utility functions for the Relay Auto Booker extension
 */

/**
 * Format a number with commas for thousands separators
 * @param {number} num - The number to format
 * @returns {string} The formatted number
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format a price as currency
 * @param {number} price - The price to format
 * @param {string} currency - The currency symbol ($ or ₹)
 * @returns {string} The formatted price
 */
function formatPrice(price, currency = '$') {
  return `${currency}${formatNumber(price.toFixed(2))}`;
}

/**
 * Format a date object as a readable string
 * @param {Date} date - The date to format
 * @returns {string} The formatted date
 */
function formatDate(date) {
  const options = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  return date.toLocaleDateString('en-US', options);
}

/**
 * Format a time duration in seconds to a readable string
 * @param {number} seconds - The duration in seconds
 * @returns {string} The formatted duration
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${remainingMinutes}m`;
  }
}

/**
 * Format a time duration in milliseconds to HH:MM:SS
 * @param {number} ms - The duration in milliseconds
 * @returns {string} The formatted duration
 */
function formatRuntime(ms) {
  if (!ms) return "00:00:00";
  
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Create a debounced function
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce wait time in milliseconds
 * @returns {Function} The debounced function
 */
function debounce(func, wait) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Generate a random interval within a given range
 * @param {number} base - The base value in milliseconds
 * @param {number} variance - The maximum variance in milliseconds
 * @returns {number} A random interval
 */
function randomInterval(base, variance) {
  const randomFactor = Math.random() * variance * 2 - variance;
  return Math.max(0, base + randomFactor);
}

/**
 * Calculate the time difference between two dates
 * @param {Date} startDate - The start date
 * @param {Date} endDate - The end date
 * @returns {Object} The time difference in days, hours, minutes, seconds
 */
function getTimeDifference(startDate, endDate) {
  const diff = Math.abs(endDate - startDate) / 1000; // in seconds
  
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = Math.floor(diff % 60);
  
  return { days, hours, minutes, seconds };
}

/**
 * Parse a time string (HH:MM, HH:MM AM/PM) to a Date object
 * @param {string} timeStr - The time string to parse
 * @param {Date} [baseDate=new Date()] - The base date to use
 * @returns {Date} The parsed date
 */
function parseTimeString(timeStr, baseDate = new Date()) {
  const result = new Date(baseDate);
  
  // Try different formats
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    // HH:MM format
    const [hours, minutes] = timeStr.split(':').map(Number);
    result.setHours(hours, minutes, 0, 0);
  } else if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(timeStr)) {
    // HH:MM AM/PM format
    const isPM = /PM$/i.test(timeStr);
    let [hoursMinutes] = timeStr.split(/\s+/);
    const [hours, minutes] = hoursMinutes.split(':').map(Number);
    
    result.setHours(
      isPM ? (hours === 12 ? 12 : hours + 12) : (hours === 12 ? 0 : hours),
      minutes,
      0,
      0
    );
  }
  
  return result;
}

/**
 * Extract values from text using regex patterns
 * @param {string} text - The text to search
 * @param {Object} patterns - Object with field names and regex patterns
 * @returns {Object} Extracted values
 */
function extractValues(text, patterns) {
  const result = {};
  
  for (const [field, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Try to convert to number if it looks like one
      const value = match[1].trim();
      if (/^-?\d+(\.\d+)?$/.test(value)) {
        result[field] = parseFloat(value);
      } else {
        result[field] = value;
      }
    }
  }
  
  return result;
}

/**
 * Check if element is visible in viewport
 * @param {HTMLElement} element - The element to check
 * @returns {boolean} Whether element is visible
 */
function isElementInViewport(element) {
  const rect = element.getBoundingClientRect();
  
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Scroll element into view if not already visible
 * @param {HTMLElement} element - The element to scroll to
 * @param {Object} options - Scroll options
 */
function scrollIntoViewIfNeeded(element, options = { behavior: 'smooth', block: 'center' }) {
  if (!isElementInViewport(element)) {
    element.scrollIntoView(options);
  }
}

/**
 * Wait for an element to appear in the DOM
 * @param {string} selector - CSS selector for the element
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @returns {Promise<HTMLElement>} The found element
 */
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    // Check if element already exists
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
    
    // Set up observer
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        clearTimeout(timeoutId);
        resolve(element);
      }
    });
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

/**
 * Simulate a click with random delay
 * @param {HTMLElement} element - Element to click
 * @param {number} delay - Base delay before clicking
 * @param {number} variance - Maximum variance in delay
 * @returns {Promise<void>}
 */
function simulateClick(element, delay = 100, variance = 50) {
  return new Promise(resolve => {
    const randomDelay = randomInterval(delay, variance);
    
    setTimeout(() => {
      // Make sure element is in view
      scrollIntoViewIfNeeded(element);
      
      // Simulate click events
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      
      resolve();
    }, randomDelay);
  });
}

// Export utilities
window.RelayAutoBooker = window.RelayAutoBooker || {};
window.RelayAutoBooker.utils = {
  formatNumber,
  formatPrice,
  formatDate,
  formatDuration,
  formatRuntime,
  debounce,
  randomInterval,
  getTimeDifference,
  parseTimeString,
  extractValues,
  isElementInViewport,
  scrollIntoViewIfNeeded,
  waitForElement,
  simulateClick
};
