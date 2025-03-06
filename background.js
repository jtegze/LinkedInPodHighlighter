// Constants
const URL_LIST_ENDPOINT = 'https://jantegze.b-cdn.net/linkedin.txt';
const UPDATE_INTERVAL_DAYS = 3;

// Initialize alarm for periodic updates
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('updatePodUsers', {
    periodInMinutes: UPDATE_INTERVAL_DAYS * 24 * 60
  });
  updatePodUsersList();
});

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updatePodUsers') {
    updatePodUsersList();
  }
});

// Listen for manual update requests from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateList') {
    updatePodUsersList()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Required for async response
  }
});

// Function to update pod users list
async function updatePodUsersList() {
  try {
    const response = await fetch(URL_LIST_ENDPOINT);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    const urls = text.split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    // Store URLs and timestamp
    await chrome.storage.local.set({
      podUsers: urls,
      lastUpdate: Date.now()
    });

    // Notify content scripts of update
    const tabs = await chrome.tabs.query({url: '*://*.linkedin.com/*'});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'refreshPodUsers' });
    });

    return true;
  } catch (error) {
    console.error('Failed to update pod users list:', error);
    throw error;
  }
}
