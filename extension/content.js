/**
 * Content script for Relay Auto Booker
 * Injects controls into Amazon Relay pages and handles automation
 */

// State variables
let isActive = false;
let settings = {
  activeMode: 'search',  // 'alert', 'search', or 'autobook'
  refreshSpeed: 30,      // seconds
  priceChangeThreshold: 20,
  randomizer: 500,       // ms
  fastBook: true,
  showTripDetails: true,
  hideRefreshResults: false,
  onlyAmazonLocations: false,
  hideAutobookMode: false,
  skipCurrentTrips: false,
  hideSimilarTrips: true,
  startStopHotkey: false,
  filters: {
    quantity: 1,
    maxDeparture: '',
    startWithin: '∞',
    maxDuration: '∞',
    distanceMin: 0,
    distanceMax: 9999,
    stopsMin: 0,
    stopsMax: 50,
    stemTime: 0,
    maxDeadhead: 50,
    payoutMin: 0,
    filterBy: 'No filter'
  }
};

// Runtime variables
let refreshCountdown = null;
let refreshInterval = null;
let controlsContainer = null;
let refreshCountdownContainer = null;
let observer = null;
let originalTrips = [];
let matchedTrips = [];
let startTime = null;
let refreshCount = 0;
let matchesCount = 0;
let refreshCountdownValue = null;
let fastBookButtons = [];

// Wait for page to load and initialize
window.addEventListener('load', init);

function init() {
  console.log('Relay Auto Booker initializing...');
  
  // Check if this is a Relay loadboard page
  if (!isRelayLoadboardPage()) {
    console.log('Not a Relay loadboard page, skipping initialization');
    return;
  }
  
  console.log('Relay loadboard detected, initializing UI...');
  
  // Load settings from storage
  loadStoredSettings().then(() => {
    // Create UI
    createControls();
    createRefreshCountdown();
    
    // Set up observer for load items
    setupLoadObserver();
    
    // Add communication with background script
    setupEventListeners();
    
    // Check if we should auto-start (if was active before refresh)
    checkAutoStart();
  });
}

// Check if this is a Relay loadboard page
function isRelayLoadboardPage() {
  return window.location.hostname.includes('relay.amazon') && 
         (window.location.pathname.includes('loadboard') || 
          window.location.pathname.includes('search') ||
          document.title.includes('Load Board') || 
          document.querySelector('.loadboard, .search-results') || 
          document.querySelector('h1, h2')?.textContent.includes('Load Board'));
}

// Load settings from storage
async function loadStoredSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings', 'automationState'], (result) => {
      if (result.settings) {
        settings = { ...settings, ...result.settings };
      }
      
      // Check if automation was active
      if (result.automationState && result.automationState.isActive) {
        isActive = result.automationState.isActive;
        startTime = result.automationState.startTime;
        refreshCount = result.automationState.refreshCount || 0;
        matchesCount = result.automationState.matchesCount || 0;
      }
      
      resolve();
    });
  });
}

// Find insertion point for our controls
function findInsertionPoint() {
  // Look for common elements on the loadboard page
  const insertPoints = [
    // Top filter area - common in most layouts
    document.querySelector('.loadboard-filters, .search-filters, .filter-bar, [class*="filter"]'),
    // Alternative locations
    document.querySelector('.loadboard-header, .search-header, header'),
    document.querySelector('.loadboard-controls, .controls'),
    document.querySelector('.loadboard-results, .search-results, .results'),
    // Fallback to any main content area
    document.querySelector('main, .main-content, [role="main"]'),
    document.body.firstElementChild
  ];
  
  return insertPoints.find(el => el !== null);
}

// Create the UI controls
function createControls() {
  // Find a good place to insert our controls
  const insertPoint = findInsertionPoint();
  if (!insertPoint) {
    console.error('Could not find insertion point for controls');
    return;
  }
  
  // Create container
  controlsContainer = document.createElement('div');
  controlsContainer.className = 'rab-controls';
  
  // Create main control row
  const controlRow = document.createElement('div');
  controlRow.className = 'rab-control-row';
  
  // Start/Stop buttons
  const startBtn = document.createElement('button');
  startBtn.id = 'rab-start';
  startBtn.className = 'rab-button start';
  startBtn.textContent = 'Start';
  
  const stopBtn = document.createElement('button');
  stopBtn.id = 'rab-stop';
  stopBtn.className = 'rab-button stop';
  stopBtn.textContent = 'Stop';
  stopBtn.style.display = 'none';
  
  // Settings button
  const settingsBtn = document.createElement('button');
  settingsBtn.id = 'rab-settings';
  settingsBtn.className = 'rab-button settings';
  settingsBtn.innerHTML = '⚙';
  settingsBtn.title = 'Settings';
  
  // Mode tabs
  const modeTabs = document.createElement('div');
  modeTabs.className = 'rab-mode-tabs';
  
  const modes = ['Alert', 'Search', 'Autobook'];
  modes.forEach(mode => {
    const tab = document.createElement('div');
    tab.textContent = mode;
    tab.dataset.mode = mode.toLowerCase();
    tab.className = `rab-mode-tab ${mode.toLowerCase() === settings.activeMode ? 'active' : ''}`;
    modeTabs.appendChild(tab);
  });
  
  // Refresh speed control
  const refreshControl = document.createElement('div');
  refreshControl.className = 'rab-refresh-speed';
  
  const refreshLabel = document.createElement('label');
  refreshLabel.textContent = 'Refresh speed';
  refreshLabel.htmlFor = 'rab-refresh-slider';
  
  const refreshSlider = document.createElement('input');
  refreshSlider.id = 'rab-refresh-slider';
  refreshSlider.className = 'rab-slider';
  refreshSlider.type = 'range';
  refreshSlider.min = '1';
  refreshSlider.max = '60';
  refreshSlider.step = '1';
  refreshSlider.value = settings.refreshSpeed.toString();
  
  refreshControl.appendChild(refreshLabel);
  refreshControl.appendChild(refreshSlider);
  
  // Add main controls to row
  controlRow.appendChild(startBtn);
  controlRow.appendChild(stopBtn);
  controlRow.appendChild(settingsBtn);
  controlRow.appendChild(modeTabs);
  controlRow.appendChild(refreshControl);
  
  // Create filter area
  const filterContainer = document.createElement('div');
  filterContainer.id = 'rab-filter-container';
  filterContainer.className = 'rab-filters';
  
  // Add controls to container
  controlsContainer.appendChild(controlRow);
  controlsContainer.appendChild(filterContainer);
  
  // Insert before the target element
  insertPoint.parentNode.insertBefore(controlsContainer, insertPoint);
  
  // Add event listeners
  startBtn.addEventListener('click', handleStartClick);
  stopBtn.addEventListener('click', handleStopClick);
  settingsBtn.addEventListener('click', handleSettingsClick);
  
  refreshSlider.addEventListener('change', (e) => {
    settings.refreshSpeed = parseInt(e.target.value, 10);
    saveSettings();
    if (isActive && refreshInterval) {
      resetRefreshInterval();
    }
  });
  
  // Mode tab click listeners
  document.querySelectorAll('.rab-mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab
      document.querySelectorAll('.rab-mode-tab').forEach(t => {
        t.classList.remove('active');
      });
      tab.classList.add('active');
      
      // Update settings
      settings.activeMode = tab.dataset.mode;
      saveSettings();
      
      // Update filters
      updateFiltersForMode(settings.activeMode);
    });
  });
  
  // Create initial filters based on mode
  updateFiltersForMode(settings.activeMode);
}

// Create the refresh countdown
function createRefreshCountdown() {
  refreshCountdownContainer = document.createElement('div');
  refreshCountdownContainer.id = 'rab-refresh-counter';
  refreshCountdownContainer.className = 'rab-refresh-counter';
  refreshCountdownContainer.style.display = 'none';
  
  // Create a more streamlined refresh counter based on the screenshot
  const nextRefreshLabel = document.createElement('span');
  nextRefreshLabel.textContent = 'Next refresh: ';
  
  refreshCountdownValue = document.createElement('span');
  refreshCountdownValue.id = 'rab-countdown-value';
  refreshCountdownValue.textContent = settings.refreshSpeed + 's';
  
  const separator1 = document.createElement('span');
  separator1.textContent = ' | ';
  
  const refreshesLabel = document.createElement('span');
  refreshesLabel.textContent = 'Refreshes: ';
  
  const refreshCountEl = document.createElement('span');
  refreshCountEl.id = 'rab-refresh-count';
  refreshCountEl.textContent = refreshCount.toString();
  
  const separator2 = document.createElement('span');
  separator2.textContent = ' | ';
  
  const matchesLabel = document.createElement('span');
  matchesLabel.textContent = 'Matches: ';
  
  const matchesCountEl = document.createElement('span');
  matchesCountEl.id = 'rab-matches-count';
  matchesCountEl.textContent = matchesCount.toString();
  
  // Auto-refresh toggle
  const toggleContainer = document.createElement('div');
  toggleContainer.style.marginLeft = '15px';
  toggleContainer.style.display = 'flex';
  toggleContainer.style.alignItems = 'center';
  
  const toggleLabel = document.createElement('span');
  toggleLabel.textContent = 'Turn on auto refresh';
  toggleLabel.style.marginRight = '10px';
  
  const toggleSwitch = document.createElement('label');
  toggleSwitch.className = 'rab-toggle';
  
  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.id = 'rab-auto-refresh-toggle';
  toggleInput.checked = isActive;
  
  const toggleSlider = document.createElement('span');
  toggleSlider.className = 'rab-toggle-slider';
  
  toggleSwitch.appendChild(toggleInput);
  toggleSwitch.appendChild(toggleSlider);
  
  toggleContainer.appendChild(toggleLabel);
  toggleContainer.appendChild(toggleSwitch);
  
  // Add toggle event listener
  toggleInput.addEventListener('change', (e) => {
    if (e.target.checked) {
      handleStartClick();
    } else {
      handleStopClick();
    }
  });
  
  // Add a manual refresh button that's more subtle
  const refreshButton = document.createElement('span');
  refreshButton.innerHTML = '↻';
  refreshButton.style.cursor = 'pointer';
  refreshButton.style.marginLeft = '5px';
  refreshButton.title = 'Refresh now';
  refreshButton.addEventListener('click', manualRefresh);
  
  // Create the custom refresh button that matches the circular icon in the screenshot
  window.createCustomRefreshButton = function() {
    const refreshIconContainer = document.createElement('div');
    refreshIconContainer.className = 'rab-refresh-icon';
    refreshIconContainer.title = 'Refresh now';
    
    // SVG for refresh icon
    refreshIconContainer.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
      </svg>
    `;
    
    // Add click event
    refreshIconContainer.addEventListener('click', () => {
      // Add spinning animation
      refreshIconContainer.classList.add('spinning');
      
      // Call refresh function
      manualRefresh();
      
      // Remove spinning after 1 second
      setTimeout(() => {
        refreshIconContainer.classList.remove('spinning');
      }, 1000);
    });
    
    return refreshIconContainer;
  };
  
  // Add function to find the "Next Refresh" button specifically shown in the Amazon Relay screenshot
  window.findNextRefreshButton = function() {
    // First check for the circular refresh icon from the screenshot
    const circularRefreshIcon = document.querySelector('.refresh-circle, .refresh-icon, [title="Refresh now"]');
    if (circularRefreshIcon) {
      return circularRefreshIcon;
    }
    
    // Look for text containing "Next refresh" with a number
    const refreshTextElements = Array.from(document.querySelectorAll('*')).filter(el => 
      el.textContent && /Next refresh:?\s*\d+s?/.test(el.textContent)
    );
    
    if (refreshTextElements.length > 0) {
      // Get closest clickable element
      const clickable = refreshTextElements[0].closest('button, a, [role="button"]') || refreshTextElements[0];
      return clickable;
    }
    
    // Look for any refresh button in the bottom-right area (matching screenshot)
    const allElements = document.querySelectorAll('button, [role="button"], a');
    for (const el of allElements) {
      const rect = el.getBoundingClientRect();
      const isBottomRight = rect.bottom > (window.innerHeight * 0.7) && 
                            rect.right > (window.innerWidth * 0.5);
      
      // Check if it's a refresh button
      if (isBottomRight && (
          el.innerHTML.includes('refresh') || 
          el.innerHTML.includes('↻') ||
          el.classList.contains('refresh') ||
          el.title?.includes('refresh')
      )) {
        return el;
      }
    }
    
    // Fall back to standard refresh button
    return document.querySelector('button[aria-label="Refresh"], [title="Refresh"], .refresh-button');
  };
  
  // Create custom refresh button
  const customRefreshBtn = createCustomRefreshButton();
  
  // Add elements to container in the order shown in the screenshot
  refreshCountdownContainer.appendChild(nextRefreshLabel);
  refreshCountdownContainer.appendChild(refreshCountdownValue);
  refreshCountdownContainer.appendChild(customRefreshBtn); // Use our custom refresh button that matches the screenshot
  refreshCountdownContainer.appendChild(separator1);
  refreshCountdownContainer.appendChild(refreshesLabel);
  refreshCountdownContainer.appendChild(refreshCountEl);
  refreshCountdownContainer.appendChild(separator2);
  refreshCountdownContainer.appendChild(matchesLabel);
  refreshCountdownContainer.appendChild(matchesCountEl);
  refreshCountdownContainer.appendChild(toggleContainer);
  
  document.body.appendChild(refreshCountdownContainer);
}

// Update filters based on active mode
function updateFiltersForMode(mode) {
  const filterContainer = document.getElementById('rab-filter-container');
  if (!filterContainer) return;
  
  // Clear existing filters
  filterContainer.innerHTML = '';
  
  // Common filters for all modes - adding all filters shown in screenshots
  const commonFilters = [
    createFilterInput('Quantity', 'quantity', settings.filters.quantity || 1, 'number'),
    createFilterInput('Max Departure', 'maxDeparture', settings.filters.maxDeparture || '', 'time'),
    createFilterInput('Start Within', 'startWithin', settings.filters.startWithin || '∞', 'text', 'hr'),
    createFilterInput('Max Duration', 'maxDuration', settings.filters.maxDuration || '∞', 'text', 'hr'),
    createFilterInput('Distance Min', 'distanceMin', settings.filters.distanceMin || 0, 'number', 'km'),
    createFilterInput('Distance Max', 'distanceMax', settings.filters.distanceMax || 9999, 'number', 'km'),
    createFilterInput('Stem Time', 'stemTime', settings.filters.stemTime || 0, 'number', 'hr'),
    createFilterInput('Max Deadhead', 'maxDeadhead', settings.filters.maxDeadhead || 50, 'number', 'km'),
    createFilterInput('Stops Max', 'stopsMax', settings.filters.stopsMax || 10, 'number'),
    createFilterInput('Payout Min', 'payoutMin', settings.filters.payoutMin || 0, 'number', '₹'),
    createFilterInput('Price Change %', 'priceChangeThreshold', settings.priceChangeThreshold || 20, 'number', '%')
  ];
  
  commonFilters.forEach(filter => {
    filterContainer.appendChild(filter);
  });
  
  // Add filter by dropdown
  const filterByContainer = document.createElement('div');
  filterByContainer.className = 'rab-filter';
  
  const filterByLabel = document.createElement('label');
  filterByLabel.textContent = 'Filter by';
  filterByLabel.htmlFor = 'rab-filter-by';
  
  const filterBySelect = document.createElement('select');
  filterBySelect.id = 'rab-filter-by';
  filterBySelect.className = 'rab-filter-input';
  
  // Options from screenshots
  const filterOptions = [
    { value: 'no-filter', text: 'No filter' },
    { value: 'states', text: 'States (US)' },
    { value: 'postal-codes', text: 'Postal codes' },
    { value: 'facility-codes', text: 'Facility codes' },
    { value: 'countries', text: 'Countries' }
  ];
  
  filterOptions.forEach(option => {
    const optionEl = document.createElement('option');
    optionEl.value = option.value;
    optionEl.textContent = option.text;
    if (settings.filters.filterBy === option.text) {
      optionEl.selected = true;
    }
    filterBySelect.appendChild(optionEl);
  });
  
  filterByContainer.appendChild(filterByLabel);
  filterByContainer.appendChild(filterBySelect);
  filterContainer.appendChild(filterByContainer);
  
  // Add type dropdown (Exclude/Whitelist options)
  const typeContainer = document.createElement('div');
  typeContainer.className = 'rab-filter';
  
  const typeLabel = document.createElement('label');
  typeLabel.textContent = 'Type';
  typeLabel.htmlFor = 'rab-filter-type';
  
  const typeSelect = document.createElement('select');
  typeSelect.id = 'rab-filter-type';
  typeSelect.className = 'rab-filter-input';
  
  // Options from screenshots
  const typeOptions = [
    { value: 'exclude', text: 'Exclude' },
    { value: 'whitelist', text: 'Whitelist' }
  ];
  
  typeOptions.forEach(option => {
    const optionEl = document.createElement('option');
    optionEl.value = option.value;
    optionEl.textContent = option.text;
    if (settings.filters.filterType === option.text) {
      optionEl.selected = true;
    }
    typeSelect.appendChild(optionEl);
  });
  
  typeContainer.appendChild(typeLabel);
  typeContainer.appendChild(typeSelect);
  filterContainer.appendChild(typeContainer);
  
  // Add locations button
  const addLocationsBtn = document.createElement('button');
  addLocationsBtn.className = 'rab-button start';
  addLocationsBtn.textContent = 'Add locations';
  addLocationsBtn.style.marginLeft = '8px';
  filterContainer.appendChild(addLocationsBtn);
  
  // Fast Book toggle for all modes - now added to all modes as requested
  const fastBookToggle = createToggle('Fast Book', 'fastBook', settings.fastBook);
  filterContainer.appendChild(fastBookToggle);
  
  // Hide Similar toggle for all modes
  const hideSimilarToggle = createToggle('Hide Similar Trips', 'hideSimilarTrips', settings.hideSimilarTrips);
  filterContainer.appendChild(hideSimilarToggle);
  
  // Apply button
  const applyButton = document.createElement('button');
  applyButton.className = 'rab-button start';
  applyButton.textContent = 'Apply Filters';
  applyButton.style.marginLeft = 'auto';
  applyButton.addEventListener('click', saveFilters);
  
  filterContainer.appendChild(applyButton);
}

// Create a filter input
function createFilterInput(label, key, value, type = 'text', unit = '') {
  const filterEl = document.createElement('div');
  filterEl.className = 'rab-filter';
  
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  labelEl.htmlFor = `rab-filter-${key}`;
  
  const inputContainer = document.createElement('div');
  inputContainer.style.display = 'flex';
  inputContainer.style.alignItems = 'center';
  
  const inputEl = document.createElement('input');
  inputEl.id = `rab-filter-${key}`;
  inputEl.className = 'rab-filter-input';
  inputEl.type = type;
  inputEl.value = value;
  
  inputContainer.appendChild(inputEl);
  
  if (unit) {
    const unitEl = document.createElement('span');
    unitEl.textContent = unit;
    unitEl.style.marginLeft = '4px';
    inputContainer.appendChild(unitEl);
  }
  
  filterEl.appendChild(labelEl);
  filterEl.appendChild(inputContainer);
  
  return filterEl;
}

// Create a toggle switch
function createToggle(label, key, isChecked = false) {
  const toggleContainer = document.createElement('div');
  toggleContainer.className = 'rab-filter';
  toggleContainer.style.flexDirection = 'row';
  toggleContainer.style.alignItems = 'center';
  
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  labelEl.htmlFor = `rab-toggle-${key}`;
  labelEl.style.marginRight = '10px';
  
  const toggleEl = document.createElement('label');
  toggleEl.className = 'rab-toggle';
  
  const checkboxEl = document.createElement('input');
  checkboxEl.id = `rab-toggle-${key}`;
  checkboxEl.type = 'checkbox';
  checkboxEl.checked = isChecked;
  
  const sliderEl = document.createElement('span');
  sliderEl.className = 'rab-toggle-slider';
  
  toggleEl.appendChild(checkboxEl);
  toggleEl.appendChild(sliderEl);
  
  toggleContainer.appendChild(labelEl);
  toggleContainer.appendChild(toggleEl);
  
  return toggleContainer;
}

// Save filter settings
function saveFilters() {
  // Get all filter inputs
  const filterInputs = document.querySelectorAll('.rab-filter-input');
  filterInputs.forEach(input => {
    const key = input.id.replace('rab-filter-', '');
    let value = input.value;
    
    // Convert to appropriate type
    if (input.type === 'number') {
      value = parseFloat(value) || 0;
    }
    
    // Check if it's a filter or a main setting
    if (key === 'priceChangeThreshold') {
      settings[key] = value;
    } else {
      settings.filters[key] = value;
    }
  });
  
  // Get toggle values
  const toggles = document.querySelectorAll('.rab-toggle input');
  toggles.forEach(toggle => {
    const key = toggle.id.replace('rab-toggle-', '');
    const value = toggle.checked;
    
    settings[key] = value;
  });
  
  saveSettings();
  
  // If active, reset observer to apply new filters
  if (isActive) {
    setupLoadObserver();
  }
  
  // Show toast notification
  showToast('Filters applied', 'success');
}

// Setup MutationObserver to watch for loads
function setupLoadObserver() {
  // Disconnect existing observer if any
  if (observer) {
    observer.disconnect();
  }
  
  // Find the container where loads are displayed
  const loadContainer = findLoadContainer();
  if (!loadContainer) {
    console.error('Could not find load container');
    return;
  }
  
  console.log('Setting up load observer on', loadContainer);
  
  // Create observer config
  const config = { 
    childList: true, 
    subtree: true, 
    attributes: false 
  };
  
  // Create the observer
  observer = new MutationObserver(mutations => {
    // Look for added nodes that might be load items
    const relevantMutations = mutations.filter(mutation => 
      mutation.type === 'childList' && mutation.addedNodes.length > 0
    );
    
    if (relevantMutations.length > 0) {
      // Small delay to ensure DOM is fully updated
      setTimeout(() => {
        processLoads();
      }, 300);
    }
  });
  
  // Start observing
  observer.observe(loadContainer, config);
  
  // Process existing loads immediately
  processLoads();
}

// Find the container where loads are displayed
function findLoadContainer() {
  // Look for common load container selectors
  const containerSelectors = [
    // Search for table/list structures with specific classes
    '.loadboard-results, .search-results, .results, [class*="results"]',
    // Look for tables that might contain loads
    'table.loads, table.trips, [class*="loads"], [class*="trips"]',
    // Generic containers that might hold the list
    '.load-list, .trip-list, [class*="list"]',
    // Last resort - look for a main content area or specific sections
    'main, [role="main"], .main-content, section'
  ];
  
  for (const selector of containerSelectors) {
    const container = document.querySelector(selector);
    if (container) return container;
  }
  
  // If we couldn't find a specific container, return the body as fallback
  return document.body;
}

function findInsertionPoint() {
  // Look for search bar or search container
  const searchElements = [
    '.search-bar',
    '.search-container',
    '[data-test="search"]',
    '[data-ux="search"]',
    '[class*="search"]'
  ];

  for (const selector of searchElements) {
    const searchElement = document.querySelector(selector);
    if (searchElement) {
      // Try to find the parent container that contains both search and results
      let parent = searchElement.parentElement;
      while (parent && parent !== document.body) {
        // Check if this parent contains load results
        if (parent.querySelector('.loadboard, .search-results, .results')) {
          // Insert after the search element
          return searchElement;
        }
        parent = parent.parentElement;
      }
      
      // If no parent with results found, insert right after search
      return searchElement;
    }
  }

  // Fallback to loadboard if search not found
  const loadboard = document.querySelector('.loadboard, .search-results');
  if (loadboard) {
    return loadboard;
  }

  // Final fallback to body
  console.warn('Could not find search bar or loadboard, falling back to body');
  return document.body;
}

// Process load items on the page
function processLoads() {
  if (!isActive) return;
  
  // Get all load items on the page
  const loadItems = findLoadItems();
  console.log(`Found ${loadItems.length} loads on the page`);
  
  // Store original trips if we haven't yet
  if (originalTrips.length === 0) {
    originalTrips = loadItems.map(extractLoadData);
  }
  
  // Extract data and filter the loads
  const currentTrips = loadItems.map(extractLoadData);
  
  // Add timestamps to all trips to track new loads
  currentTrips.forEach(trip => {
    if (trip) {
      trip.timestamp = trip.timestamp || Date.now();
    }
  });
  
  // Filter the trips based on user criteria
  matchedTrips = filterTrips(currentTrips);
  
  // Sort matched trips so newest ones appear at the top
  matchedTrips.sort((a, b) => {
    // Sort by timestamp (most recent first)
    if (a.timestamp !== b.timestamp) {
      return b.timestamp - a.timestamp;
    }
    
    // If timestamps are the same, sort by price (highest first)
    if (a.price !== b.price) {
      return b.price - a.price;
    }
    
    return 0;
  });
  
  console.log(`Found ${matchedTrips.length} matching loads`);
  
  // Update match count
  matchesCount = Math.max(matchesCount, matchedTrips.length);
  updateMatchCount(matchesCount);
  
  // Apply UI updates based on matching loads
  applyUiUpdates(loadItems, matchedTrips);
  
  // Take action based on mode
  if (matchedTrips.length > 0) {
    handleMatchingTrips();
  }
}

// Find all load items on the page
function findLoadItems() {
  // Look for common patterns in the Relay UI
  const itemSelectors = [
    // Generic rows in tables/lists
    'tr:not(.header-row, .table-header), .load-item, .trip-item',
    // Classes that might indicate a load
    '[class*="load"], [class*="trip"], [class*="result-item"]',
    // Look for items with book buttons
    '[class*="book"], .has-book-button',
    // Last resort - look for divs with IDs or data attributes that might be loads
    'div[id*="load"], div[id*="trip"], div[data-load], div[data-trip]'
  ];
  
  for (const selector of itemSelectors) {
    const items = document.querySelectorAll(selector);
    if (items.length > 0) {
      return Array.from(items);
    }
  }
  
  return [];
}

// Extract load data from a DOM element
function extractLoadData(loadItem) {
  // Initialize default data structure
  const loadData = {
    element: loadItem,
    id: loadItem.id || `load-${Math.random().toString(36).substring(2, 9)}`,
    price: 0,
    distance: 0,
    stops: 0,
    originLocation: '',
    destinationLocation: '',
    departureTime: '',
    bookButton: null
  };
  
  try {
    // Look for common patterns in the Relay UI
    
    // Extract price - Look for currency symbols like $ or ₹
    const priceMatch = loadItem.textContent.match(/[₹$][\s]*([0-9,]+(\.[0-9]+)?)/);
    if (priceMatch) {
      loadData.price = parseFloat(priceMatch[1].replace(/,/g, ''));
    }
    
    // Extract distance - Look for km or numbers followed by km
    const distanceMatch = loadItem.textContent.match(/(\d+(\.\d+)?)\s*km/);
    if (distanceMatch) {
      loadData.distance = parseFloat(distanceMatch[1]);
    }
    
    // Extract stops information
    const stopsMatch = loadItem.textContent.match(/(\d+)\s*stops?/i) || 
                       loadItem.textContent.match(/stops?:?\s*(\d+)/i);
    if (stopsMatch) {
      loadData.stops = parseInt(stopsMatch[1], 10);
    }
    
    // Find origin and destination locations
    const locationElements = loadItem.querySelectorAll('[class*="location"], [class*="origin"], [class*="destination"]');
    if (locationElements.length >= 2) {
      loadData.originLocation = locationElements[0].textContent.trim();
      loadData.destinationLocation = locationElements[1].textContent.trim();
    }
    
    // Try to find departure time
    const timeElements = loadItem.querySelectorAll('[class*="time"], [class*="date"], [class*="departure"]');
    if (timeElements.length > 0) {
      loadData.departureTime = timeElements[0].textContent.trim();
    }
    
    // Find book button
    const bookButton = loadItem.querySelector('button, [role="button"], a[href*="book"]');
    if (bookButton && (bookButton.textContent.toLowerCase().includes('book') || 
                     bookButton.getAttribute('aria-label')?.toLowerCase().includes('book'))) {
      loadData.bookButton = bookButton;
    }
  } catch (error) {
    console.error('Error extracting load data:', error);
  }
  
  return loadData;
}

// Filter trips based on settings
function filterTrips(trips) {
  return trips.filter(trip => {
    // Basic filters for all modes
    if (trip.distance < settings.filters.distanceMin) return false;
    if (trip.distance > settings.filters.distanceMax) return false;
    if (trip.price < settings.filters.payoutMin) return false;
    if (trip.stops > settings.filters.stopsMax) return false;
    
    // Mode-specific filtering
    if (settings.activeMode === 'search' || settings.activeMode === 'autobook') {
      // Check max departure time if set
      if (settings.filters.maxDeparture && trip.departureTime) {
        // Simple string comparison for time format
        if (trip.departureTime > settings.filters.maxDeparture) return false;
      }
      
      // Location filtering
      if (settings.onlyAmazonLocations) {
        const isAmazonLocation = 
          trip.originLocation.toLowerCase().includes('amazon') ||
          trip.destinationLocation.toLowerCase().includes('amazon');
        
        if (!isAmazonLocation) return false;
      }
    } else if (settings.activeMode === 'alert') {
      // For alert mode, check price changes from original trips
      const originalTrip = originalTrips.find(original => 
        original.id === trip.id || 
        (original.originLocation === trip.originLocation && 
         original.destinationLocation === trip.destinationLocation)
      );
      
      if (originalTrip) {
        const priceChange = ((trip.price - originalTrip.price) / originalTrip.price) * 100;
        if (Math.abs(priceChange) < settings.priceChangeThreshold) return false;
      }
    }
    
    // Hide similar trips if enabled
    if (settings.hideSimilarTrips && trip.originLocation && trip.destinationLocation) {
      const similarTrip = matchedTrips.find(matched =>
        matched.originLocation === trip.originLocation &&
        matched.destinationLocation === trip.destinationLocation &&
        matched.id !== trip.id
      );
      
      if (similarTrip) return false;
    }
    
    return true;
  });
}

// Apply UI updates to highlight matching loads
function applyUiUpdates(loadItems, matchedTrips) {
  // Clear any existing fast book buttons
  fastBookButtons.forEach(btn => {
    if (btn.parentNode) {
      btn.parentNode.removeChild(btn);
    }
  });
  fastBookButtons = [];
  
  // Reset all load items first
  loadItems.forEach(item => {
    item.classList.remove('rab-highlight');
  });
  
  // Highlight matches and add fast book buttons
  matchedTrips.forEach(trip => {
    // Add highlight
    trip.element.classList.add('rab-highlight');
    
    // Add fast book button if in search mode and enabled
    if (settings.activeMode === 'search' && settings.fastBook && trip.bookButton) {
      const fastBookBtn = document.createElement('button');
      fastBookBtn.className = 'rab-fast-book';
      fastBookBtn.textContent = 'Fast Book';
      fastBookBtn.dataset.tripId = trip.id;
      
      // Position near the original book button
      trip.element.style.position = 'relative';
      trip.element.appendChild(fastBookBtn);
      
      // Add click handler
      fastBookBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        bookLoad(trip);
      });
      
      fastBookButtons.push(fastBookBtn);
    }
  });
  
  // Handle autobook mode
  if (settings.activeMode === 'autobook' && matchedTrips.length > 0) {
    // Sort by price (highest first) for autobook mode
    const sortedTrips = [...matchedTrips].sort((a, b) => b.price - a.price);
    if (sortedTrips[0] && sortedTrips[0].bookButton) {
      // Add small delay to avoid race conditions
      setTimeout(() => {
        bookLoad(sortedTrips[0]);
      }, settings.randomizer);
    }
  }
}

// Handle matching trips based on mode
function handleMatchingTrips() {
  // In alert mode, play notification sound
  if (settings.activeMode === 'alert' && matchedTrips.length > 0) {
    playNotificationSound('alert', 80);
    showToast(`Found ${matchedTrips.length} matching loads!`, 'success');
  }
}

// Book a load
function bookLoad(trip) {
  console.log('Booking load:', trip);
  
  if (!trip.bookButton) {
    console.error('No book button found for trip');
    showToast('No book button found', 'error');
    return;
  }
  
  // Click the book button
  trip.bookButton.click();
  
  // Increment match count
  matchesCount++;
  updateMatchCount(matchesCount);
  
  // Stop automation if in autobook mode
  if (settings.activeMode === 'autobook') {
    stopAutomation();
    showToast('Load booked successfully! Automation stopped.', 'success');
  } else {
    showToast('Load booked successfully!', 'success');
  }
  
  // Notify background script
  chrome.runtime.sendMessage({
    action: 'bookLoad',
    loadId: trip.id
  });
}

// Handle start button click
function handleStartClick() {
  if (isActive) return;
  
  console.log('Starting automation...');
  
  // UI updates
  const startBtn = document.getElementById('rab-start');
  const stopBtn = document.getElementById('rab-stop');
  const autoRefreshToggle = document.getElementById('rab-auto-refresh-toggle');
  
  if (startBtn) startBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'inline-block';
  if (autoRefreshToggle) autoRefreshToggle.checked = true;
  
  // Show refresh counter
  if (refreshCountdownContainer) {
    refreshCountdownContainer.style.display = 'flex';
  }
  
  // Set state
  isActive = true;
  startTime = Date.now();
  
  // Set up refresh interval
  startRefreshCountdown();
  
  // Set up load observer
  setupLoadObserver();
  
  // Save state
  saveAutomationState();
  
  // Notify background script
  chrome.runtime.sendMessage({
    action: 'startMonitoring',
    settings: settings
  });
  
  // Process loads immediately
  processLoads();
}

// Handle stop button click
function handleStopClick() {
  stopAutomation();
}

// Handle settings button click
function handleSettingsClick() {
  chrome.runtime.sendMessage({ action: 'openSettings' });
}

// Stop automation
function stopAutomation() {
  if (!isActive) return;
  
  console.log('Stopping automation...');
  
  // UI updates
  const startBtn = document.getElementById('rab-start');
  const stopBtn = document.getElementById('rab-stop');
  const autoRefreshToggle = document.getElementById('rab-auto-refresh-toggle');
  
  if (startBtn) startBtn.style.display = 'inline-block';
  if (stopBtn) stopBtn.style.display = 'none';
  if (autoRefreshToggle) autoRefreshToggle.checked = false;
  
  // Hide refresh counter
  if (refreshCountdownContainer) {
    refreshCountdownContainer.style.display = 'none';
  }
  
  // Clear intervals
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  
  if (refreshCountdown) {
    clearInterval(refreshCountdown);
    refreshCountdown = null;
  }
  
  // Disconnect observer
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  
  // Set state
  isActive = false;
  
  // Save state
  saveAutomationState();
  
  // Notify background script
  chrome.runtime.sendMessage({ action: 'stopMonitoring' });
  
  // Reset UI
  const loadItems = findLoadItems();
  loadItems.forEach(item => {
    item.classList.remove('rab-highlight');
  });
  
  // Clear fast book buttons
  fastBookButtons.forEach(btn => {
    if (btn.parentNode) {
      btn.parentNode.removeChild(btn);
    }
  });
  fastBookButtons = [];
}

// Start refresh countdown
function startRefreshCountdown() {
  // Clear existing interval
  if (refreshCountdown) {
    clearInterval(refreshCountdown);
  }
  
  // Initialize countdown value
  let countdown = settings.refreshSpeed;
  
  // Update display
  if (refreshCountdownValue) {
    refreshCountdownValue.textContent = countdown + 's';
  }
  
  // Start countdown
  refreshCountdown = setInterval(() => {
    countdown--;
    
    if (refreshCountdownValue) {
      refreshCountdownValue.textContent = countdown + 's';
    }
    
    if (countdown <= 0) {
      // Reset countdown
      countdown = settings.refreshSpeed;
      // Do refresh
      refreshPage();
    }
  }, 1000);
}

// Reset refresh interval
function resetRefreshInterval() {
  // Clear existing interval
  if (refreshCountdown) {
    clearInterval(refreshCountdown);
    refreshCountdown = null;
  }
  
  // Start new countdown
  startRefreshCountdown();
}

// Refresh the page
function refreshPage() {
  console.log('Refreshing page...');
  
  // Increment refresh count
  refreshCount++;
  
  // Update UI
  const refreshCountEl = document.getElementById('rab-refresh-count');
  if (refreshCountEl) {
    refreshCountEl.textContent = refreshCount.toString();
  }
  
  // Save state
  saveAutomationState();
  
  // Add spinning animation to our custom refresh button
  const customRefreshBtn = document.querySelector('.rab-refresh-icon');
  if (customRefreshBtn) {
    customRefreshBtn.classList.add('spinning');
    setTimeout(() => {
      customRefreshBtn.classList.remove('spinning');
    }, 1000);
  }
  
  // Look specifically for the circular refresh button in the bottom right (from screenshot)
  // This is the blue circle with the refresh icon inside it
  const buttons = document.querySelectorAll('button, [role="button"]');
  const refreshButtons = Array.from(buttons).filter(btn => {
    // Check position (bottom right of screen)
    const rect = btn.getBoundingClientRect();
    const isBottomRight = rect.bottom > (window.innerHeight * 0.7) && 
                          rect.right > (window.innerWidth * 0.5);
    
    // Check if it's near text saying "Next Refresh" or has a timer
    const nearbyText = btn.textContent || 
                       (btn.parentElement && btn.parentElement.textContent) || 
                       (btn.nextElementSibling && btn.nextElementSibling.textContent);
    
    const hasRefreshText = nearbyText && (
      nearbyText.includes('Next Refresh') || 
      nearbyText.includes('Next refresh') ||
      /\d+s/.test(nearbyText) // Timer like "30s"
    );
    
    // Check if it's circular or has the refresh icon
    const isCircular = btn.classList.contains('MuiButtonBase-root') || 
                       btn.style.borderRadius === '50%' ||
                       window.getComputedStyle(btn).borderRadius === '50%';
    
    const hasRefreshIcon = btn.innerHTML.includes('svg') || 
                         btn.textContent.includes('↻') || 
                         btn.querySelector('svg, img');
    
    return (isBottomRight && (hasRefreshText || isCircular || hasRefreshIcon));
  });
  
  // If we found candidate refresh buttons, click the first one
  if (refreshButtons.length > 0) {
    console.log('Found refresh button matching the screenshot, clicking...');
    refreshButtons[0].click();
    
    // Process loads after short delay
    setTimeout(() => {
      processLoads();
    }, 1500);
    
    return;
  }
  
  // Next try to find any refresh icon near the auto-refresh toggle shown in screenshot
  const refreshIcon = document.querySelector('.refresh-icon, [class*="refresh-icon"], [class*="refreshIcon"]');
  if (refreshIcon) {
    console.log('Found refresh icon, clicking');
    refreshIcon.click();
    
    // Process loads after short delay
    setTimeout(() => {
      processLoads();
    }, 1500);
    
    return;
  }
  
  // Try to use native reload button if available
  const reloadButton = document.querySelector('button[aria-label="Refresh"], [class*="refresh"], [id*="refresh"]');
  if (reloadButton) {
    console.log('Found generic refresh button, clicking');
    reloadButton.click();
    
    // Process loads after short delay
    setTimeout(() => {
      processLoads();
    }, 1500);
  } else {
    // Otherwise reload the page
    console.log('No refresh button found, reloading the page');
    window.location.reload();
  }
}

// Manual refresh triggered by user
function manualRefresh() {
  if (!isActive) return;
  
  // Restart the countdown
  resetRefreshInterval();
  
  // Refresh the page
  refreshPage();
}

// Update match count
function updateMatchCount(count) {
  const matchesCountEl = document.getElementById('rab-matches-count');
  if (matchesCountEl) {
    matchesCountEl.textContent = count.toString();
  }
  
  // Notify background script
  chrome.runtime.sendMessage({
    action: 'logMatches',
    count: count
  });
}

// Save settings to storage
function saveSettings() {
  chrome.storage.local.set({ settings });
}

// Save automation state
function saveAutomationState() {
  const automationState = {
    isActive,
    startTime,
    refreshCount,
    matchesCount,
    activeMode: settings.activeMode
  };
  
  chrome.storage.local.set({ automationState });
}

// Check if we should auto-start
function checkAutoStart() {
  chrome.storage.local.get(['automationState'], (result) => {
    if (result.automationState && result.automationState.isActive) {
      // Auto-start if was active before
      handleStartClick();
    }
  });
}

// Set up event listeners for communication
function setupEventListeners() {
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getStatus') {
      sendResponse({
        isActive,
        activeMode: settings.activeMode,
        refreshCount,
        matchesCount,
        startTime,
        currentTime: Date.now()
      });
    } else if (message.action === 'start') {
      handleStartClick();
      sendResponse({ success: true });
    } else if (message.action === 'stop') {
      handleStopClick();
      sendResponse({ success: true });
    } else if (message.action === 'updateSettings') {
      settings = { ...settings, ...message.settings };
      saveSettings();
      sendResponse({ success: true });
    } else if (message.action === 'startMonitoring') {
      if (!isActive) {
        handleStartClick();
      }
      sendResponse({ success: true });
    } else if (message.action === 'stopMonitoring') {
      if (isActive) {
        stopAutomation();
      }
      sendResponse({ success: true });
    } else if (message.action === 'refreshPage') {
      refreshPage();
      sendResponse({ success: true });
    } else if (message.action === 'bookLoad') {
      if (message.loadId) {
        const trip = matchedTrips.find(t => t.id === message.loadId);
        if (trip) {
          bookLoad(trip);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Trip not found' });
        }
      }
    }
    
    return true; // Keep the message channel open for async responses
  });
  
  // Listen for hotkey events from background script
  document.addEventListener('keydown', (e) => {
    // Check if hotkey is enabled and the key combination matches
    if (settings.startStopHotkey && e.ctrlKey && e.key === 's') {
      e.preventDefault();
      
      if (isActive) {
        handleStopClick();
      } else {
        handleStartClick();
      }
    }
  });
  
  // Listen for events from loadboardFastBook.js
  window.addEventListener('rab-load-booked', (event) => {
    // A load was booked, but we don't want to automatically stop
    // Just update the UI to show the booked load
    const loadData = event.detail;
    console.log('Load booked event received:', loadData);
    
    // Update match count if needed
    updateMatchCount(matchesCount + 1);
    
    // Show notification but DON'T stop automation
    showToast(`Load booked: ${loadData.origin} to ${loadData.destination}`, 'success');
  });
  
  // Listen for successful booking events
  window.addEventListener('rab-load-booked-success', (event) => {
    const { load, message } = event.detail;
    console.log('Load booked successfully:', load);
    
    // Play success sound
    playNotificationSound('success');
    
    // Show notification but DON'T stop automation
    showToast(message || 'Load booked successfully!', 'success', 5000);
  });
}

// Show a toast notification
function showToast(message, type = 'info', duration = 3000) {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('rab-toast-container');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'rab-toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '20px';
    toastContainer.style.right = '20px';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `rab-toast rab-toast-${type}`;
  toast.textContent = message;
  
  // Style the toast
  const backgroundColor = type === 'success' ? '#4CAF50' :
                          type === 'error' ? '#F44336' :
                          type === 'warning' ? '#FF9800' : '#2196F3';
  
  Object.assign(toast.style, {
    backgroundColor,
    color: 'white',
    padding: '12px 16px',
    borderRadius: '4px',
    marginBottom: '10px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    opacity: '0',
    transition: 'opacity 0.3s ease-in-out',
    maxWidth: '300px',
    wordWrap: 'break-word'
  });
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.style.opacity = '1';
  }, 10);
  
  // Remove after duration
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) {
        toastContainer.removeChild(toast);
      }
      
      // Remove container if empty
      if (toastContainer.children.length === 0 && toastContainer.parentNode) {
        document.body.removeChild(toastContainer);
      }
    }, 300);
  }, duration);
}

// Play a notification sound
function playNotificationSound(sound = 'alert', volume = 80) {
  try {
    // Create audio context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const audioContext = new AudioContext();
    
    // Convert volume to range 0-1
    const normalizedVolume = volume / 100;
    
    // Create oscillator
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Set volume
    gainNode.gain.value = normalizedVolume;
    
    // Configure sound based on type
    switch (sound) {
      case 'alert':
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
        
        // Start and stop with quick fade out
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.stop(audioContext.currentTime + 0.5);
        break;
        
      case 'chime':
        oscillator.type = 'sine';
        
        // Create a chime effect with multiple notes
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.2); // E5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.4); // G5
        
        // Start and stop with fade out
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
        oscillator.stop(audioContext.currentTime + 0.8);
        break;
        
      case 'bell':
        oscillator.type = 'sine';
        
        // Bell-like sound
        oscillator.frequency.setValueAtTime(987.77, audioContext.currentTime); // B5
        
        // Quick attack, longer decay
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(normalizedVolume, audioContext.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 1.5);
        break;
        
      default:
        // Default alert sound
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.stop(audioContext.currentTime + 0.3);
    }
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
}
