// Constants
const URL_LIST_ENDPOINT = 'https://jantegze.b-cdn.net/linkedin.txt';
const UPDATE_INTERVAL_DAYS = 3;

// Initialize alarm for periodic updates
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed - setting up alarm and initial update');
  chrome.alarms.create('updatePodUsers', {
    periodInMinutes: UPDATE_INTERVAL_DAYS * 24 * 60
  });
  updatePodUsersList();
});

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updatePodUsers') {
    console.log('Alarm triggered - updating pod users list');
    updatePodUsersList();
  }
});

// Listen for manual update requests from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateList') {
    console.log('Manual update requested');
    updatePodUsersList()
      .then(() => {
        console.log('Manual update completed successfully');
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Manual update failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async response
  }
});

// Function to safely send message to a tab
async function sendMessageToTab(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch (error) {
    console.log(`Failed to send message to tab ${tabId}:`, error.message);
    return false;
  }
}

// Function to update pod users list
async function updatePodUsersList() {
  try {
    console.log('Fetching pod users list from:', URL_LIST_ENDPOINT);
    const response = await fetch(URL_LIST_ENDPOINT);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();
    const urls = text.split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    console.log('Retrieved', urls.length, 'pod user URLs');

    // Store URLs and timestamp
    await chrome.storage.local.set({
      podUsers: urls,
      lastUpdate: Date.now()
    });
    console.log('Stored pod users list in local storage');

    // Verify storage
    const stored = await chrome.storage.local.get(['podUsers']);
    console.log('Verified storage - found', stored.podUsers.length, 'URLs');

    // Notify content scripts of update
    try {
      const tabs = await chrome.tabs.query({
        url: [
          '*://*.linkedin.com/*',
          '*://linkedin.com/*'
        ]
      });
      console.log('Found', tabs.length, 'LinkedIn tabs to notify');

      // Use Promise.allSettled to handle both successful and failed notifications
      const results = await Promise.allSettled(
        tabs.map(tab => sendMessageToTab(tab.id, { action: 'refreshPodUsers' }))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
      console.log(`Successfully notified ${succeeded} of ${tabs.length} tabs`);
    } catch (error) {
      console.log('Error while querying tabs:', error.message);
      // Don't throw error since the main update was successful
    }

    return true;
  } catch (error) {
    console.error('Failed to update pod users list:', error);
    throw error;
  }
}