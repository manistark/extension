/**
 * Settings page for the Relay Auto Booker extension
 */

document.addEventListener('DOMContentLoaded', function() {
  // Load current settings
  loadSettings();
  
  // Set up event listeners
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('reset-settings').addEventListener('click', resetSettings);
  
  // Set up sliders
  setupSliders();
});

// Load settings from storage
function loadSettings() {
  chrome.storage.local.get(['settings'], function(result) {
    const settings = result.settings || getDefaultSettings();
    
    // Update UI with settings values
    document.getElementById('price-change').value = settings.priceChangeThreshold || 20;
    document.getElementById('randomizer').value = settings.randomizer || 500;
    
    // Set toggle states
    setToggleState('fast-book', settings.fastBook !== false);
    setToggleState('show-trip-details', settings.showTripDetails !== false);
    setToggleState('hide-refresh-results', settings.hideRefreshResults === true);
    setToggleState('only-amazon-locations', settings.onlyAmazonLocations === true);
    setToggleState('hide-autobook-mode', settings.hideAutobookMode === true);
    setToggleState('skip-current-trips', settings.skipCurrentTrips === true);
    setToggleState('hide-similar-trips', settings.hideSimilarTrips !== false);
    setToggleState('start-stop-hotkey', settings.startStopHotkey === true);
    
    updateSliderValues();
  });
}

// Save settings to storage
function saveSettings() {
  const settings = {
    priceChangeThreshold: parseInt(document.getElementById('price-change').value, 10),
    randomizer: parseInt(document.getElementById('randomizer').value, 10),
    
    // Toggle options
    fastBook: document.getElementById('fast-book').checked,
    showTripDetails: document.getElementById('show-trip-details').checked,
    hideRefreshResults: document.getElementById('hide-refresh-results').checked,
    onlyAmazonLocations: document.getElementById('only-amazon-locations').checked,
    hideAutobookMode: document.getElementById('hide-autobook-mode').checked,
    skipCurrentTrips: document.getElementById('skip-current-trips').checked,
    hideSimilarTrips: document.getElementById('hide-similar-trips').checked,
    startStopHotkey: document.getElementById('start-stop-hotkey').checked
  };
  
  chrome.storage.local.get(['settings'], function(result) {
    // Merge with existing settings to keep values we didn't modify
    const existingSettings = result.settings || getDefaultSettings();
    const mergedSettings = { ...existingSettings, ...settings };
    
    chrome.storage.local.set({ settings: mergedSettings }, function() {
      showSaveConfirmation();
    });
  });
}

// Reset settings to defaults
function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    const defaultSettings = getDefaultSettings();
    chrome.storage.local.set({ settings: defaultSettings }, function() {
      loadSettings();
      showSaveConfirmation('Settings reset to defaults.');
    });
  }
}

// Set up sliders
function setupSliders() {
  // Price change slider
  const priceChangeSlider = document.getElementById('price-change');
  const priceChangeValue = document.getElementById('price-change-value');
  
  priceChangeSlider.addEventListener('input', function() {
    priceChangeValue.textContent = this.value;
  });
  
  // Randomizer slider
  const randomizerSlider = document.getElementById('randomizer');
  const randomizerValue = document.getElementById('randomizer-value');
  
  randomizerSlider.addEventListener('input', function() {
    randomizerValue.textContent = this.value + 'ms';
  });
}

// Update slider values
function updateSliderValues() {
  // Price change slider
  const priceChangeSlider = document.getElementById('price-change');
  const priceChangeValue = document.getElementById('price-change-value');
  priceChangeValue.textContent = priceChangeSlider.value;
  
  // Randomizer slider
  const randomizerSlider = document.getElementById('randomizer');
  const randomizerValue = document.getElementById('randomizer-value');
  randomizerValue.textContent = randomizerSlider.value + 'ms';
}

// Set toggle state
function setToggleState(id, checked) {
  const checkbox = document.getElementById(id);
  if (checkbox) {
    checkbox.checked = checked;
  }
}

// Show save confirmation
function showSaveConfirmation(message = 'Settings saved successfully.') {
  const confirmation = document.getElementById('save-confirmation');
  confirmation.textContent = message;
  confirmation.style.opacity = '1';
  
  setTimeout(() => {
    confirmation.style.opacity = '0';
  }, 3000);
}

// Get default settings
function getDefaultSettings() {
  return {
    activeMode: 'search',
    refreshSpeed: 30,
    priceChangeThreshold: 20,
    randomizer: 500,
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
      stemTime: 0,
      maxDeadhead: 50,
      stopsMax: 10,
      payoutMin: 0,
      filterBy: 'No filter'
    }
  };
}
