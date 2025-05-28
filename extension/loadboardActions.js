/**
 * Loadboard Actions for the Relay Auto Booker extension
 * 
 * This script provides additional actions and UI enhancements 
 * for the Amazon Relay loadboard page
 */

// State
let isInitialized = false;
let settings = {};
let actionButtons = [];
let lastUpdated = Date.now();
let observingLoadboard = false;

/**
 * Initialize loadboard actions
 * @param {Object} currentSettings - Current extension settings
 */
function initializeLoadboardActions(currentSettings) {
  if (isInitialized) {
    return;
  }
  
  try {
    settings = currentSettings;
    console.log('Initializing loadboard actions with settings:', settings);
    
    // Start observing the loadboard
    startLoadboardObserver();
    
    // Add custom UI elements if needed
    addCustomUI();
    
    isInitialized = true;
    console.log('Loadboard actions initialized');
  } catch (error) {
    console.error('Error initializing loadboard actions:', error);
  }
}

/**
 * Start observing the loadboard for changes
 */
function startLoadboardObserver() {
  if (observingLoadboard) {
    return;
  }
  
  try {
    const observerConfig = { childList: true, subtree: true };
    const targetNode = document.body;
    
    const observer = new MutationObserver(() => {
      // Don't respond to mutations too frequently
      if (Date.now() - lastUpdated < 1000) {
        return;
      }
      
      lastUpdated = Date.now();
      
      // Check for and enhance load items
      enhanceLoadItems();
    });
    
    observer.observe(targetNode, observerConfig);
    observingLoadboard = true;
    console.log('Loadboard observer started');
    
    // Initial enhancement
    enhanceLoadItems();
  } catch (error) {
    console.error('Error starting loadboard observer:', error);
  }
}

/**
 * Add custom UI elements to the loadboard
 */
function addCustomUI() {
  try {
    // Add a button to quickly filter by different criteria
    addQuickFilterButtons();
    
    // Add a status indicator
    addStatusIndicator();
  } catch (error) {
    console.error('Error adding custom UI:', error);
  }
}

/**
 * Add quick filter buttons to the loadboard
 */
function addQuickFilterButtons() {
  try {
    // Find the filter container
    const filterContainer = document.querySelector('.filter-container, .filter-section, header');
    
    if (!filterContainer) {
      console.log('Filter container not found');
      return;
    }
    
    // Create a container for our buttons
    const quickFilterContainer = document.createElement('div');
    quickFilterContainer.className = 'relay-booker-quick-filters';
    quickFilterContainer.style.display = 'flex';
    quickFilterContainer.style.gap = '8px';
    quickFilterContainer.style.margin = '8px 0';
    
    // Add quick filter buttons
    const filters = [
      { name: 'Today', action: () => applyQuickFilter('today') },
      { name: 'High Pay', action: () => applyQuickFilter('high-pay') },
      { name: 'Short Distance', action: () => applyQuickFilter('short-distance') },
      { name: 'Long Distance', action: () => applyQuickFilter('long-distance') }
    ];
    
    filters.forEach(filter => {
      const button = document.createElement('button');
      button.textContent = filter.name;
      button.className = 'relay-booker-quick-filter-button';
      button.style.padding = '6px 12px';
      button.style.backgroundColor = '#f0f2f5';
      button.style.border = '1px solid #d0d5dd';
      button.style.borderRadius = '4px';
      button.style.cursor = 'pointer';
      button.addEventListener('click', filter.action);
      
      quickFilterContainer.appendChild(button);
      actionButtons.push(button);
    });
    
    // Insert the container
    filterContainer.parentNode.insertBefore(quickFilterContainer, filterContainer.nextSibling);
    console.log('Quick filter buttons added');
  } catch (error) {
    console.error('Error adding quick filter buttons:', error);
  }
}

/**
 * Apply a quick filter
 * @param {string} filterType - Type of filter to apply
 */
function applyQuickFilter(filterType) {
  try {
    console.log(`Applying quick filter: ${filterType}`);
    
    // TODO: Implement the filtering logic based on the filter type
    switch (filterType) {
      case 'today':
        // Filter for same-day loads
        console.log('Filtering for today/same-day loads');
        break;
        
      case 'high-pay':
        // Filter for high paying loads
        console.log('Filtering for high paying loads');
        break;
        
      case 'short-distance':
        // Filter for short distance loads
        console.log('Filtering for short distance loads');
        break;
        
      case 'long-distance':
        // Filter for long distance loads
        console.log('Filtering for long distance loads');
        break;
    }
    
    // Highlight the selected button
    highlightSelectedFilter(filterType);
  } catch (error) {
    console.error(`Error applying quick filter ${filterType}:`, error);
  }
}

/**
 * Highlight the selected filter button
 * @param {string} filterType - Type of filter that was selected
 */
function highlightSelectedFilter(filterType) {
  // Reset all buttons
  actionButtons.forEach(button => {
    button.style.backgroundColor = '#f0f2f5';
    button.style.borderColor = '#d0d5dd';
  });
  
  // Find and highlight the selected button
  const selectedButton = actionButtons.find(button => 
    button.textContent.toLowerCase().includes(filterType.split('-').join(' '))
  );
  
  if (selectedButton) {
    selectedButton.style.backgroundColor = '#e3f2fd';
    selectedButton.style.borderColor = '#2F6EB5';
  }
}

/**
 * Add a status indicator to show the extension is active
 */
function addStatusIndicator() {
  try {
    // Find a good spot for the indicator
    const header = document.querySelector('header, .header, nav');
    
    if (!header) {
      console.log('Header not found for status indicator');
      return;
    }
    
    // Create the indicator
    const indicator = document.createElement('div');
    indicator.className = 'relay-booker-status';
    indicator.textContent = 'Auto Booker Active';
    indicator.style.padding = '4px 8px';
    indicator.style.backgroundColor = '#4CAF50';
    indicator.style.color = 'white';
    indicator.style.borderRadius = '4px';
    indicator.style.fontSize = '12px';
    indicator.style.fontWeight = 'bold';
    indicator.style.margin = '0 12px';
    
    // Add it to the header
    header.appendChild(indicator);
    console.log('Status indicator added');
  } catch (error) {
    console.error('Error adding status indicator:', error);
  }
}

/**
 * Enhance load items with additional information and actions
 */
function enhanceLoadItems() {
  try {
    // Find all load items
    const loadItems = document.querySelectorAll('.load-item, .opportunity-item, tr:not(:first-child)');
    
    if (loadItems.length === 0) {
      console.log('No load items found to enhance');
      return;
    }
    
    console.log(`Enhancing ${loadItems.length} load items`);
    
    loadItems.forEach(loadItem => {
      // Check if already enhanced
      if (loadItem.hasAttribute('data-relay-booker-enhanced')) {
        return;
      }
      
      // Mark as enhanced
      loadItem.setAttribute('data-relay-booker-enhanced', 'true');
      
      // Add a quick book button
      addQuickBookButton(loadItem);
      
      // Highlight based on filter criteria if matching
      highlightIfMatching(loadItem);
    });
  } catch (error) {
    console.error('Error enhancing load items:', error);
  }
}

/**
 * Add a quick book button to a load item
 * @param {Element} loadItem - The load item element
 */
function addQuickBookButton(loadItem) {
  try {
    // Find the actions area or create one if not present
    let actionsArea = loadItem.querySelector('.actions, .action-buttons');
    
    if (!actionsArea) {
      // If no actions area, find a good spot to create one
      const lastCell = loadItem.querySelector('td:last-child, div:last-child');
      
      if (!lastCell) {
        console.log('No suitable area found for quick book button');
        return;
      }
      
      actionsArea = document.createElement('div');
      actionsArea.className = 'relay-booker-actions';
      actionsArea.style.display = 'flex';
      actionsArea.style.gap = '4px';
      actionsArea.style.marginTop = '4px';
      
      lastCell.appendChild(actionsArea);
    }
    
    // Create the quick book button
    const quickBookBtn = document.createElement('button');
    quickBookBtn.textContent = 'Quick Book';
    quickBookBtn.className = 'relay-booker-quick-book';
    quickBookBtn.style.padding = '4px 8px';
    quickBookBtn.style.backgroundColor = '#2F6EB5';
    quickBookBtn.style.color = 'white';
    quickBookBtn.style.border = 'none';
    quickBookBtn.style.borderRadius = '4px';
    quickBookBtn.style.cursor = 'pointer';
    quickBookBtn.style.fontSize = '12px';
    
    // Get load ID
    const loadId = getLoadIdFromElement(loadItem);
    if (loadId) {
      quickBookBtn.setAttribute('data-load-id', loadId);
    }
    
    // Add click handler
    quickBookBtn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      
      const loadId = quickBookBtn.getAttribute('data-load-id');
      if (loadId) {
        console.log(`Quick booking load: ${loadId}`);
        // Message to the content script to trigger booking
        chrome.runtime.sendMessage({
          action: 'bookLoad',
          loadId: loadId,
          settings: settings
        });
      } else {
        console.error('No load ID found for quick booking');
      }
    });
    
    actionsArea.appendChild(quickBookBtn);
  } catch (error) {
    console.error('Error adding quick book button:', error);
  }
}

/**
 * Get the load ID from a load item element
 * @param {Element} loadItem - The load item element
 * @returns {string|null} - The load ID or null if not found
 */
function getLoadIdFromElement(loadItem) {
  try {
    // Check for a data attribute first
    if (loadItem.hasAttribute('data-load-id')) {
      return loadItem.getAttribute('data-load-id');
    }
    
    // Look for an ID in a data attribute or in the element's ID
    if (loadItem.id && loadItem.id.includes('load-')) {
      return loadItem.id.split('load-')[1];
    }
    
    // Look for a link that might contain the ID
    const detailLink = loadItem.querySelector('a[href*="load/"], a[href*="opportunity/"]');
    if (detailLink) {
      const href = detailLink.getAttribute('href');
      const match = href.match(/load\/([^\/]+)|opportunity\/([^\/]+)/);
      if (match) {
        return match[1] || match[2];
      }
    }
    
    // If we still don't have an ID, generate one based on content
    // This is a fallback and not ideal because it's not stable across page reloads
    const loadDetails = extractLoadDetailsFromElement(loadItem);
    if (loadDetails) {
      return generateIdFromLoadDetails(loadDetails);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting load ID:', error);
    return null;
  }
}

/**
 * Extract load details from a load item element
 * @param {Element} loadItem - The load item element
 * @returns {Object|null} - The load details or null if not extractable
 */
function extractLoadDetailsFromElement(loadItem) {
  try {
    // This is a simplified version - would need to be adapted to the actual page structure
    const origin = loadItem.querySelector('.origin, [data-test-id="origin"]')?.textContent.trim();
    const destination = loadItem.querySelector('.destination, [data-test-id="destination"]')?.textContent.trim();
    const date = loadItem.querySelector('.date, [data-test-id="date"]')?.textContent.trim();
    
    if (origin && destination) {
      return { origin, destination, date };
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting load details:', error);
    return null;
  }
}

/**
 * Generate a pseudo-ID from load details
 * @param {Object} details - The load details
 * @returns {string} - A generated ID
 */
function generateIdFromLoadDetails(details) {
  return `${details.origin}-${details.destination}-${details.date}`.replace(/[^a-z0-9]/gi, '-');
}

/**
 * Highlight a load item if it matches the current filter criteria
 * @param {Element} loadItem - The load item element
 */
function highlightIfMatching(loadItem) {
  try {
    // TODO: Implement logic to check if this load matches the current filter
    // For now, we'll just apply a subtle highlight to show the enhancement is working
    loadItem.style.borderLeft = '3px solid #2F6EB5';
    loadItem.style.transition = 'background-color 0.3s';
    
    // On hover, make it more noticeable
    loadItem.addEventListener('mouseenter', () => {
      loadItem.style.backgroundColor = '#f0f4f9';
    });
    
    loadItem.addEventListener('mouseleave', () => {
      loadItem.style.backgroundColor = '';
    });
  } catch (error) {
    console.error('Error highlighting load item:', error);
  }
}

// Export functions to be used by content script
if (typeof module !== 'undefined') {
  module.exports = {
    initializeLoadboardActions,
    startLoadboardObserver,
    enhanceLoadItems
  };
}

// Add this function to your script
function showToast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.right = '24px';
  toast.style.background = '#323232';
  toast.style.color = '#fff';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '6px';
  toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  toast.style.zIndex = 9999;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// Example usage after booking:
showToast('Load booked successfully!');