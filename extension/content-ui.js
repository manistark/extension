/**
 * Content UI script for the Amazon Relay Auto Booker extension
 * Creates and manages the UI elements injected into the Amazon Relay loadboard
 */

// Keep track of created UI elements
let uiElements = {
  container: null,
  controlPanel: null,
  filterPanel: null,
  refreshCounter: null
};

// Initialize UI when content script signals ready
document.addEventListener('relay-autobooker-ready', function() {
  createUI();
});

/**
 * Create the main UI elements
 */
function createUI() {
  // Only create once
  if (uiElements.container) return;
  
  // Add custom styles for UI elements
  addCustomStyles();
  
  // Create main UI components
  createControlPanel();
  createFilterPanel();
  createRefreshCounter();
  
  // Add event listeners for UI interactions
  setupEventListeners();
  
  // Get current settings and update UI
  chrome.runtime.sendMessage({ action: 'getSettings' }, function(settings) {
    if (settings) {
      updateUIFromSettings(settings);
    }
  });
  
  // Check automation status
  chrome.runtime.sendMessage({ action: 'getStatus' }, function(status) {
    if (status && status.isActive) {
      updateControlsForActiveState(true);
    }
  });
}

/**
 * Add custom styles for UI elements
 */
function addCustomStyles() {
  if (document.getElementById('relay-autobooker-ui-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'relay-autobooker-ui-styles';
  styles.textContent = `
    .relay-autobooker-container {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
    }
    
    .relay-autobooker-control-panel {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      padding: 8px;
      background-color: #f5f7fa;
      border-radius: 4px;
    }
    
    .relay-autobooker-button {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      font-weight: 500;
      font-size: 14px;
      cursor: pointer;
    }
    
    .relay-autobooker-button.start {
      background-color: #f0f7fa;
      color: #333;
      border: 1px solid #ccc;
    }
    
    .relay-autobooker-button.stop {
      background-color: #2F6EB5;
      color: white;
    }
    
    .relay-autobooker-button.settings {
      background-color: #f0f0f0;
      color: #333;
      width: 32px;
      height: 32px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .relay-autobooker-mode-tabs {
      display: flex;
      gap: 4px;
    }
    
    .relay-autobooker-mode-tab {
      padding: 6px 12px;
      background-color: #f0f0f0;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    
    .relay-autobooker-mode-tab.active {
      background-color: #2F6EB5;
      color: white;
      border-color: #2F6EB5;
    }
    
    .relay-autobooker-refresh-speed {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: 16px;
    }
    
    .relay-autobooker-refresh-speed label {
      font-size: 13px;
      color: #666;
    }
    
    .relay-autobooker-slider {
      width: 100px;
      height: 4px;
      -webkit-appearance: none;
      appearance: none;
      background-color: #ddd;
      outline: none;
      border-radius: 2px;
    }
    
    .relay-autobooker-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #2F6EB5;
      cursor: pointer;
    }
    
    .relay-autobooker-filter-panel {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
      padding: 8px;
      background-color: #f5f7fa;
      border-radius: 4px;
    }
    
    .relay-autobooker-filter-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .relay-autobooker-filter-field label {
      font-size: 12px;
      color: #666;
    }
    
    .relay-autobooker-filter-field input,
    .relay-autobooker-filter-field select {
      width: 120px;
      padding: 6px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .relay-autobooker-filter-actions {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }
    
    .relay-autobooker-filter-button {
      padding: 4px 8px;
      font-size: 12px;
      background-color: #f0f0f0;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .relay-autobooker-refresh-counter {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 8px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .relay-autobooker-icon-refresh {
      width: 16px;
      height: 16px;
      background-color: #2F6EB5;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 10px;
    }
    
    .relay-autobooker-refresh-toggle {
      position: relative;
      display: inline-block;
      width: 30px;
      height: 16px;
    }
    
    .relay-autobooker-refresh-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .relay-autobooker-refresh-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .4s;
      border-radius: 34px;
    }
    
    .relay-autobooker-refresh-slider:before {
      position: absolute;
      content: "";
      height: 12px;
      width: 12px;
      left: 2px;
      bottom: 2px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    
    input:checked + .relay-autobooker-refresh-slider {
      background-color: #2F6EB5;
    }
    
    input:checked + .relay-autobooker-refresh-slider:before {
      transform: translateX(14px);
    }
    
    .relay-autobooker-fast-book {
      background-color: #2F6EB5;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      position: absolute;
      right: 10px;
      top: 10px;
    }
    
    .relay-autobooker-highlight {
      background-color: #fff8e1 !important;
      position: relative;
      border: 1px solid #ffd54f;
    }
    
    .relay-autobooker-highlight-price-change {
      color: #4CAF50;
      font-weight: bold;
    }
  `;
  
  document.head.appendChild(styles);
}

/**
 * Create the control panel with buttons and mode tabs
 */
function createControlPanel() {
  // Find a good insertion point
  const insertPoint = findInsertionPoint();
  if (!insertPoint) return;
  
  // Create container
  const container = document.createElement('div');
  container.className = 'relay-autobooker-container';
  
  // Create control panel
  const controlPanel = document.createElement('div');
  controlPanel.className = 'relay-autobooker-control-panel';
  
  // Create start/stop buttons
  const startButton = document.createElement('button');
  startButton.className = 'relay-autobooker-button start';
  startButton.id = 'relay-autobooker-start';
  startButton.textContent = 'Start';
  
  const stopButton = document.createElement('button');
  stopButton.className = 'relay-autobooker-button stop';
  stopButton.id = 'relay-autobooker-stop';
  stopButton.textContent = 'Stop';
  stopButton.style.display = 'none';
  
  // Create settings button
  const settingsButton = document.createElement('button');
  settingsButton.className = 'relay-autobooker-button settings';
  settingsButton.id = 'relay-autobooker-settings';
  settingsButton.innerHTML = '⚙️';
  
  // Create mode tabs
  const modeTabs = document.createElement('div');
  modeTabs.className = 'relay-autobooker-mode-tabs';
  
  const modes = ['Alert', 'Search', 'Autobook'];
  modes.forEach(mode => {
    const tab = document.createElement('div');
    tab.className = `relay-autobooker-mode-tab ${mode.toLowerCase()}`;
    tab.dataset.mode = mode.toLowerCase();
    tab.textContent = mode;
    
    if (mode === 'Search') {
      tab.classList.add('active');
    }
    
    modeTabs.appendChild(tab);
  });
  
  // Create refresh speed control
  const refreshSpeed = document.createElement('div');
  refreshSpeed.className = 'relay-autobooker-refresh-speed';
  
  const refreshSpeedLabel = document.createElement('label');
  refreshSpeedLabel.textContent = 'Refresh speed';
  
  const refreshSpeedSlider = document.createElement('input');
  refreshSpeedSlider.type = 'range';
  refreshSpeedSlider.className = 'relay-autobooker-slider';
  refreshSpeedSlider.id = 'relay-autobooker-refresh-speed';
  refreshSpeedSlider.min = '5';
  refreshSpeedSlider.max = '60';
  refreshSpeedSlider.step = '5';
  refreshSpeedSlider.value = '30';
  
  refreshSpeed.appendChild(refreshSpeedLabel);
  refreshSpeed.appendChild(refreshSpeedSlider);
  
  // Add all elements to control panel
  controlPanel.appendChild(startButton);
  controlPanel.appendChild(stopButton);
  controlPanel.appendChild(settingsButton);
  controlPanel.appendChild(modeTabs);
  controlPanel.appendChild(refreshSpeed);
  
  // Add control panel to container
  container.appendChild(controlPanel);
  
  // Insert before the target element
  insertPoint.parentNode.insertBefore(container, insertPoint);
  
  // Save references
  uiElements.container = container;
  uiElements.controlPanel = controlPanel;
}

/**
 * Create the filter panel with input fields
 */
function createFilterPanel() {
  if (!uiElements.container) return;
  
  // Create filter panel
  const filterPanel = document.createElement('div');
  filterPanel.className = 'relay-autobooker-filter-panel';
  filterPanel.id = 'relay-autobooker-filter-panel';
  filterPanel.style.display = 'none'; // Hidden by default

  // Save reference before updating fields
  uiElements.filterPanel = filterPanel;

  // Add filter fields based on the active mode
  updateFilterPanelForMode('search');
  
  // Add filter panel to container
  uiElements.container.appendChild(filterPanel);
}

/**
 * Update filter panel fields based on the active mode
 * @param {string} mode - The active mode (alert, search, autobook)
 */
function updateFilterPanelForMode(mode) {
  const filterPanel = uiElements.filterPanel;
  if (!filterPanel) return;
  
  // Clear existing fields
  filterPanel.innerHTML = '';
  
  if (mode === 'alert') {
    // Alert mode has minimal fields
    createFilterField(filterPanel, 'price-threshold', 'Price change', 'number', 20);
  } else {
    // Search and autobook modes have similar fields
    if (mode === 'autobook') {
      createFilterField(filterPanel, 'quantity', 'Quantity', 'number', 1);
    }
    
    createFilterField(filterPanel, 'max-departure', 'Max Departure', 'time');
    createFilterField(filterPanel, 'start-within', 'Start Within', 'select', null, [
      { value: '', text: '∞' },
      { value: '1', text: '1 hour' },
      { value: '2', text: '2 hours' },
      { value: '4', text: '4 hours' },
      { value: '8', text: '8 hours' },
      { value: '12', text: '12 hours' },
      { value: '24', text: '24 hours' }
    ]);
    
    createFilterField(filterPanel, 'max-duration', 'Max Duration', 'select', null, [
      { value: '', text: '∞' },
      { value: '4', text: '4 hours' },
      { value: '8', text: '8 hours' },
      { value: '12', text: '12 hours' },
      { value: '24', text: '24 hours' },
      { value: '48', text: '48 hours' }
    ]);
    
    createFilterField(filterPanel, 'distance-min', 'Distance Min', 'number', 0);
    createFilterField(filterPanel, 'distance-max', 'Distance Max', 'number', 9999);
    createFilterField(filterPanel, 'stops-min', 'Stops min', 'number', 0);
    createFilterField(filterPanel, 'stops-max', 'Stops Max', 'number', 10);
    createFilterField(filterPanel, 'payout-min', 'Payout, Min', 'number', 0);
    
    // Filter selection
    createFilterField(filterPanel, 'filter-by', 'Filter by', 'select', null, [
      { value: 'no-filter', text: 'No filter' },
      { value: 'exclude', text: 'Exclude' },
      { value: 'whitelist', text: 'Whitelist' }
    ]);
    
    // Add row button
    const addRowButton = document.createElement('button');
    addRowButton.className = 'relay-autobooker-button';
    addRowButton.textContent = '+ Add Row';
    addRowButton.style.marginTop = '16px';
    filterPanel.appendChild(addRowButton);
    
    // Saved filter actions
    const filterActions = document.createElement('div');
    filterActions.className = 'relay-autobooker-filter-actions';
    
    const savedFiltersButton = document.createElement('button');
    savedFiltersButton.className = 'relay-autobooker-filter-button';
    savedFiltersButton.textContent = 'Saved filters';
    
    const saveThisFilterButton = document.createElement('button');
    saveThisFilterButton.className = 'relay-autobooker-filter-button';
    saveThisFilterButton.textContent = 'Save this filter';
    
    filterActions.appendChild(savedFiltersButton);
    filterActions.appendChild(saveThisFilterButton);
    
    filterPanel.appendChild(filterActions);
  }
}

/**
 * Create a filter field with label and input/select
 * @param {HTMLElement} parent - Parent element to append to
 * @param {string} id - Field ID
 * @param {string} label - Field label
 * @param {string} type - Input type (number, text, time, select)
 * @param {any} defaultValue - Default value
 * @param {Array} options - Options for select fields
 * @returns {HTMLElement} Created field
 */
function createFilterField(parent, id, label, type, defaultValue = null, options = null) {
  const field = document.createElement('div');
  field.className = 'relay-autobooker-filter-field';
  
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  labelEl.htmlFor = `relay-autobooker-${id}`;
  
  let inputEl;
  
  if (type === 'select') {
    inputEl = document.createElement('select');
    
    if (options) {
      options.forEach(option => {
        const optEl = document.createElement('option');
        optEl.value = option.value;
        optEl.textContent = option.text;
        inputEl.appendChild(optEl);
      });
    }
  } else {
    inputEl = document.createElement('input');
    inputEl.type = type;
    
    if (type === 'number') {
      inputEl.min = 0;
    }
  }
  
  inputEl.id = `relay-autobooker-${id}`;
  inputEl.className = 'relay-autobooker-input';
  
  if (defaultValue !== null) {
    inputEl.value = defaultValue;
  }
  
  field.appendChild(labelEl);
  field.appendChild(inputEl);
  parent.appendChild(field);
  
  return field;
}

/**
 * Create the refresh counter in the bottom right corner
 */
function createRefreshCounter() {
  const refreshCounter = document.createElement('div');
  refreshCounter.className = 'relay-autobooker-refresh-counter';
  refreshCounter.id = 'relay-autobooker-refresh-counter';
  refreshCounter.style.display = 'none'; // Hidden by default
  
  const counterText = document.createElement('span');
  counterText.textContent = 'Next Refresh: ';
  
  const counterValue = document.createElement('span');
  counterValue.id = 'relay-autobooker-refresh-countdown';
  counterValue.textContent = '30s';
  
  const refreshIcon = document.createElement('div');
  refreshIcon.className = 'relay-autobooker-icon-refresh';
  refreshIcon.innerHTML = '↻';
  
  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'relay-autobooker-refresh-toggle';
  
  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.id = 'relay-autobooker-auto-refresh-toggle';
  
  const toggleSlider = document.createElement('span');
  toggleSlider.className = 'relay-autobooker-refresh-slider';
  
  toggleLabel.appendChild(toggleInput);
  toggleLabel.appendChild(toggleSlider);
  
  refreshCounter.appendChild(counterText);
  refreshCounter.appendChild(counterValue);
  refreshCounter.appendChild(refreshIcon);
  refreshCounter.appendChild(toggleLabel);
  
  document.body.appendChild(refreshCounter);
  
  // Save reference
  uiElements.refreshCounter = refreshCounter;
}

/**
 * Find a good insertion point in the DOM
 * @returns {HTMLElement} Element to insert before
 */
function findInsertionPoint() {
  // Try to find the search area or filters section
  const searchArea = document.querySelector('.search-area, .filters, [data-testid*="filter"]');
  if (searchArea) return searchArea;
  
  // Try to find the load board heading
  const loadBoardHeading = document.querySelector('h1, h2, h3, [data-testid*="heading"]');
  if (loadBoardHeading) return loadBoardHeading.nextElementSibling || loadBoardHeading;
  
  // Fallback to inserting after the header or at the top
  const header = document.querySelector('header');
  return header ? header.nextElementSibling : document.body.firstChild;
}

/**
 * Setup event listeners for UI interactions
 */
function setupEventListeners() {
  // Start button
  const startButton = document.getElementById('relay-autobooker-start');
  if (startButton) {
    startButton.addEventListener('click', function() {
      // Get current settings
      const activeMode = document.querySelector('.relay-autobooker-mode-tab.active')?.dataset.mode || 'search';
      const refreshSpeed = document.getElementById('relay-autobooker-refresh-speed')?.value || 30;
      
      // Gather filter settings
      const filterSettings = gatherFilterSettings(activeMode);
      
      // Start automation
      chrome.runtime.sendMessage({
        action: 'startAutomation',
        tabId: null, // Background script will get the active tab
        settings: {
          activeTab: activeMode,
          refreshSpeed: parseInt(refreshSpeed, 10),
          ...filterSettings
        }
      }, function(response) {
        if (response && response.success) {
          updateControlsForActiveState(true);
        }
      });
    });
  }
  
  // Stop button
  const stopButton = document.getElementById('relay-autobooker-stop');
  if (stopButton) {
    stopButton.addEventListener('click', function() {
      chrome.runtime.sendMessage({ action: 'stopAutomation' }, function(response) {
        if (response && response.success) {
          updateControlsForActiveState(false);
        }
      });
    });
  }
  
  // Mode tabs
  const modeTabs = document.querySelectorAll('.relay-autobooker-mode-tab');
  modeTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      // Update active tab
      modeTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // Show/hide filter panel based on mode
      const mode = this.dataset.mode;
      updateFilterPanelForMode(mode);
      
      // Show filter panel (initially hidden)
      if (uiElements.filterPanel) {
        uiElements.filterPanel.style.display = 'flex';
      }
      
      // Update settings with new mode
      chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: { activeTab: mode }
      });
    });
  });
  
  // Refresh speed slider
  const refreshSpeedSlider = document.getElementById('relay-autobooker-refresh-speed');
  if (refreshSpeedSlider) {
    refreshSpeedSlider.addEventListener('change', function() {
      chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: { refreshSpeed: parseInt(this.value, 10) }
      });
    });
  }
  
  // Settings button
  const settingsButton = document.getElementById('relay-autobooker-settings');
  if (settingsButton) {
    settingsButton.addEventListener('click', function() {
      chrome.runtime.openOptionsPage();
    });
  }
  
  // Auto refresh toggle
  const autoRefreshToggle = document.getElementById('relay-autobooker-auto-refresh-toggle');
  if (autoRefreshToggle) {
    autoRefreshToggle.addEventListener('change', function() {
      const isChecked = this.checked;
      chrome.runtime.sendMessage({
        action: isChecked ? 'startAutomation' : 'stopAutomation',
        tabId: null,
        settings: getCurrentSettings()
      });
    });
  }
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(function(message) {
    if (message.action === 'updateRefreshCount') {
      // Update countdown display
      updateRefreshCountdown(message.nextRefresh);
    }
  });
}

/**
 * Gather current filter settings based on active mode
 * @param {string} mode - Active mode (alert, search, autobook)
 * @returns {object} Filter settings
 */
function gatherFilterSettings(mode) {
  const settings = {};
  
  if (mode === 'alert') {
    settings.priceChangeThreshold = parseFloat(document.getElementById('relay-autobooker-price-threshold')?.value || 20);
  } else {
    // Common fields for search and autobook
    const fields = [
      'max-departure',
      'distance-min',
      'distance-max',
      'stops-min',
      'stops-max',
      'payout-min',
      'filter-by'
    ];
    
    fields.forEach(field => {
      const element = document.getElementById(`relay-autobooker-${field}`);
      if (element) {
        let value = element.value;
        
        // Convert to appropriate type
        if (element.type === 'number') {
          value = parseFloat(value);
        }
        
        // Map to appropriate setting name
        const settingName = field.replace(/-([a-z])/g, g => g[1].toUpperCase());
        const prefixedName = mode === 'autobook' ? `${settingName}Autobook` : settingName;
        
        settings[prefixedName] = value;
      }
    });
    
    // Mode-specific fields
    if (mode === 'autobook') {
      settings.quantity = parseInt(document.getElementById('relay-autobooker-quantity')?.value || 1, 10);
    }
  }
  
  return settings;
}

/**
 * Get current settings from UI
 * @returns {object} Current settings
 */
function getCurrentSettings() {
  const activeMode = document.querySelector('.relay-autobooker-mode-tab.active')?.dataset.mode || 'search';
  const refreshSpeed = document.getElementById('relay-autobooker-refresh-speed')?.value || 30;
  
  return {
    activeTab: activeMode,
    refreshSpeed: parseInt(refreshSpeed, 10),
    ...gatherFilterSettings(activeMode)
  };
}

/**
 * Update UI controls for active/inactive state
 * @param {boolean} isActive - Whether automation is active
 */
function updateControlsForActiveState(isActive) {
  const startButton = document.getElementById('relay-autobooker-start');
  const stopButton = document.getElementById('relay-autobooker-stop');
  const refreshCounter = document.getElementById('relay-autobooker-refresh-counter');
  const autoRefreshToggle = document.getElementById('relay-autobooker-auto-refresh-toggle');
  
  if (startButton) startButton.style.display = isActive ? 'none' : 'block';
  if (stopButton) stopButton.style.display = isActive ? 'block' : 'none';
  if (refreshCounter) refreshCounter.style.display = isActive ? 'flex' : 'none';
  if (autoRefreshToggle) autoRefreshToggle.checked = isActive;
}

/**
 * Update refresh countdown display
 * @param {number} secondsRemaining - Seconds until next refresh
 */
function updateRefreshCountdown(secondsRemaining) {
  const countdownElement = document.getElementById('relay-autobooker-refresh-countdown');
  if (countdownElement) {
    countdownElement.textContent = `${secondsRemaining}s`;
  }
}

/**
 * Update UI elements from settings
 * @param {object} settings - Current settings
 */
function updateUIFromSettings(settings) {
  // Update active mode tab
  const activeTab = settings.activeTab || 'search';
  const modeTabs = document.querySelectorAll('.relay-autobooker-mode-tab');
  modeTabs.forEach(tab => {
    if (tab.dataset.mode === activeTab) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Update refresh speed
  const refreshSpeedSlider = document.getElementById('relay-autobooker-refresh-speed');
  if (refreshSpeedSlider) {
    refreshSpeedSlider.value = settings.refreshSpeed || 30;
  }
  
  // Show filter panel
  if (uiElements.filterPanel) {
    uiElements.filterPanel.style.display = 'flex';
    updateFilterPanelForMode(activeTab);
  }
  
  // Set filter values based on mode
  if (activeTab === 'alert') {
    setValue('relay-autobooker-price-threshold', settings.priceChangeThreshold || 20);
  } else {
    // Common fields for search and autobook
    setValue('relay-autobooker-max-departure', settings.maxDeparture || '');
    setValue('relay-autobooker-distance-min', settings.distanceMin || 0);
    setValue('relay-autobooker-distance-max', settings.distanceMax || 9999);
    setValue('relay-autobooker-stops-min', settings.stopsMin || 0);
    setValue('relay-autobooker-stops-max', settings.stopsMax || 10);
    setValue('relay-autobooker-payout-min', settings.payoutMin || 0);
    setValue('relay-autobooker-filter-by', settings.filterBy || 'no-filter');
    
    // Mode-specific fields
    if (activeTab === 'autobook') {
      setValue('relay-autobooker-quantity', settings.quantity || 1);
    }
  }
}

/**
 * Set value for an input element
 * @param {string} id - Element ID
 * @param {any} value - Value to set
 */
function setValue(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  
  if (element.type === 'checkbox') {
    element.checked = Boolean(value);
  } else {
    element.value = value;
  }
}

// Listen for content script ready event
document.addEventListener('relay-autobooker-init', function(event) {
  const settings = event.detail;
  if (settings) {
    updateUIFromSettings(settings);
  }
});