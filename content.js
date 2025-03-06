// Cache for pod users URLs
let podUsers = [];

// Initialize pod users from storage
chrome.storage.local.get(['podUsers'], (result) => {
  if (result.podUsers) {
    podUsers = result.podUsers;
    console.log('Pod users loaded from storage:', podUsers.length, 'entries');
    processPodUsers();
  } else {
    console.log('No pod users found in storage - requesting update');
    chrome.runtime.sendMessage({ action: 'updateList' });
  }
});

// Listen for updates from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'refreshPodUsers') {
    chrome.storage.local.get(['podUsers'], (result) => {
      podUsers = result.podUsers || [];
      processPodUsers();
    });
  }
});

// Process DOM mutations
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      processPodUsers();
      break;
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

function normalizeProfileUrl(url) {
  if (!url) return '';

  // Convert to lowercase and remove query parameters and hash
  let cleanUrl = url.toLowerCase().split('?')[0].split('#')[0];

  // Remove overlay segments (e.g., /overlay/about-this-profile/)
  cleanUrl = cleanUrl.replace(/\/overlay\/[^/]+\/?/, '/');

  // Remove trailing slash
  cleanUrl = cleanUrl.replace(/\/$/, '');

  console.log('Normalized URL:', cleanUrl);
  return cleanUrl;
}

function processPodUsers() {
  // First check if this is a profile page URL
  const profileUrl = window.location.href;
  console.log('Current page URL:', profileUrl);

  if (isPodUser(profileUrl)) {
    console.log('Current profile is a pod user');

    // Handle profile pages - look for the headline in multiple possible locations
    const headlineSelectors = [
      '.text-body-medium.break-words',
      '.pv-text-details__left-panel .text-body-medium',
      'div[data-generated-suggestion-target] .text-body-medium',
      'h1.break-words + div.text-body-medium',
      'div[data-generated-suggestion-target="urn:li:fsu_profileActionDelegate"]'
    ];

    for (const selector of headlineSelectors) {
      const headlineElement = document.querySelector(selector);
      if (headlineElement && !headlineElement.querySelector('.pod-user-label')) {
        console.log('Found headline element:', headlineElement.textContent);
        addPodUserLabel(headlineElement, 'profile');
        break;
      }
    }
  }

  // Process feed posts and search results
  const items = document.querySelectorAll([
    '.feed-shared-update-v2',
    '.update-components-actor',
    '.search-results__list-item',
    '.ember-view[data-test-search-result]'
  ].join(','));

  items.forEach(item => {
    const linkElement = item.querySelector('a[href*="/in/"]');
    if (!linkElement) return;

    const itemUrl = linkElement.href;
    if (!isPodUser(itemUrl)) return;

    // First try to find the headline element
    const headlineElement = item.querySelector([
      '.update-components-actor__description',
      '.text-body-small.break-words',
      '.ember-view .text-body-medium'
    ].join(','));

    if (headlineElement && !headlineElement.querySelector('.pod-user-label')) {
      addPodUserLabel(headlineElement, 'profile');
    }

    // Also label the name if available
    const nameElement = item.querySelector([
      '.feed-shared-actor__name',
      '.update-components-actor__name',
      '.update-components-actor__title .t-bold',
      '.ember-view .t-bold'
    ].join(','));

    if (nameElement && !nameElement.querySelector('.pod-user-label')) {
      addPodUserLabel(nameElement, 'feed');
    }
  });
}

function isPodUser(url) {
  if (!url || !podUsers.length) return false;

  const cleanUrl = normalizeProfileUrl(url);

  return podUsers.some(podUrl => {
    const cleanPodUrl = normalizeProfileUrl(podUrl);
    const match = cleanUrl.includes(cleanPodUrl);
    console.log('Comparing URLs:', {
      cleanUrl,
      cleanPodUrl,
      match
    });
    return match;
  });
}

function addPodUserLabel(element, context = 'feed') {
  if (!element) return;

  const label = document.createElement('span');
  label.className = 'pod-user-label';
  if (context === 'feed') {
    label.className += ' pod-user-label--feed';
  }
  label.textContent = 'Pod User';

  if (context === 'profile') {
    // For profiles and search results headlines, insert before the text
    element.insertBefore(label, element.firstChild);
  } else {
    // For feed posts and search results names, append after
    element.appendChild(label);
  }
}