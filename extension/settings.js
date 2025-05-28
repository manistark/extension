/**
 * Settings page for the Relay Auto Booker extension
 * Based on the Rocket Relay screenshot
 */

document.addEventListener('DOMContentLoaded', function() {
  // Load current settings
  loadSettings();
  
  // Set up event listeners
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('reset-settings').addEventListener('click', resetSettings);
  
  // Set up toggle switches
  setupToggles();
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
    priceChangeThreshold: parseFloat(document.getElementById('price-change').value),
    randomizer: parseInt(document.getElementById('randomizer').value),
    
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
    const mergedSettings = { ...result.settings, ...settings };
    
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
      stopsMin: 0,
      stopsMax: 50,
      stemTime: 0,
      maxDeadhead: 50,
      payoutMin: 0,
      filterBy: 'No filter'
    }
  };
}

// Set up toggle switches
function setupToggles() {
  const toggles = document.querySelectorAll('.toggle-switch');
  toggles.forEach(toggle => {
    toggle.addEventListener('click', function() {
      const checkbox = this.querySelector('input[type="checkbox"]');
      checkbox.checked = !checkbox.checked;
      
      // Update the toggle appearance
      updateToggleAppearance(checkbox);
    });
  });
}

// Set toggle state
function setToggleState(id, checked) {
  const checkbox = document.getElementById(id);
  if (checkbox) {
    checkbox.checked = checked;
    updateToggleAppearance(checkbox);
  }
}

// Update toggle appearance
function updateToggleAppearance(checkbox) {
  const toggle = checkbox.closest('.toggle-switch');
  const toggleDot = toggle.querySelector('.toggle-dot');
  
  if (checkbox.checked) {
    toggle.classList.add('active');
    toggleDot.style.transform = 'translateX(16px)';
  } else {
    toggle.classList.remove('active');
    toggleDot.style.transform = 'translateX(0)';
  }
}

// Update slider value displays
function updateSliderValues() {
  // Price change slider
  const priceChangeSlider = document.getElementById('price-change');
  const priceChangeValue = document.getElementById('price-change-value');
  priceChangeValue.textContent = priceChangeSlider.value;
  
  priceChangeSlider.addEventListener('input', function() {
    priceChangeValue.textContent = this.value;
  });
  
  // Randomizer slider
  const randomizerSlider = document.getElementById('randomizer');
  const randomizerValue = document.getElementById('randomizer-value');
  randomizerValue.textContent = randomizerSlider.value + 'ms';
  
  randomizerSlider.addEventListener('input', function() {
    randomizerValue.textContent = this.value + 'ms';
  });
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