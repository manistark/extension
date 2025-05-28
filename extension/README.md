# Web Automation Assistant Chrome Extension

A Chrome extension that automates webpage refreshing and form submission with configurable settings and auto-fill capabilities.

## Features

- Automate page refreshing at configurable intervals
- Automatically fill in form fields with pre-defined values
- Submit forms automatically
- Set maximum refresh counts
- Save configurations for different websites
- Visual indicator for active automation

## Installation

Since this extension is not published to the Chrome Web Store, you'll need to install it in developer mode:

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the `extension` folder from this repository
5. The extension should now appear in your extensions list and toolbar

## Usage

1. Navigate to the webpage you want to automate
2. Click the Web Automation Assistant icon in your browser toolbar
3. Configure the settings:
   - **Refresh Interval**: How often to refresh the page (in seconds)
   - **Max Refreshes**: Maximum number of refreshes (0 for unlimited)
   - **Form Selector**: CSS selector for the form element
   - **Form Fields**: CSS selectors and values for form fields to auto-fill
   - **Submit Button Selector**: CSS selector for the form submit button
   - **Submission Delay**: Delay before submitting the form (in seconds)
4. Click "Start Automation" to begin
5. To stop the automation, click "Stop Automation" in the popup

## Saving and Loading Configurations

You can save configurations for different websites:

1. Configure the settings for a specific website
2. Click "Save Current" to save the configuration
3. Enter a name for the configuration
4. To load a saved configuration, select it from the dropdown and click "Load"
5. To delete a configuration, select it and click "Delete"

## Notes

- The extension will show a small overlay in the top-right corner of automated pages
- Click the overlay to see more details about the current automation
- Closing or navigating away from the page will stop the automation for that tab

## Privacy and Security

This extension:
- Only operates on tabs where you explicitly start automation
- Stores configurations in your browser's local storage
- Does not send any data to external servers
- Only requires permissions for the specific features it provides
