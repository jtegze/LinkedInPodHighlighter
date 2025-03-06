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
    console.log('Received refresh request from background');
    chrome.storage.local.get(['podUsers'], (result) => {
      if (result.podUsers) {
        console.log('Refreshing pod users list with', result.podUsers.length, 'entries');
        podUsers = result.podUsers;
        processPodUsers();
        // Acknowledge receipt of the update
        sendResponse({ success: true });
      } else {
        console.log('No pod users found in storage after refresh request');
        sendResponse({ success: false, error: 'No pod users data found' });
      }
    });
    return true; // Required for async response
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
  cleanUrl = cleanUrl.replace(/\/overlay\/.*$/, '');

  // Remove trailing slash
  cleanUrl = cleanUrl.replace(/\/$/, '');

  return cleanUrl;
}

function isPodUser(url) {
  if (!url || !podUsers.length) return false;

  const cleanUrl = normalizeProfileUrl(url);
  return podUsers.some(podUrl => {
    const cleanPodUrl = normalizeProfileUrl(podUrl);
    return cleanUrl.includes(cleanPodUrl);
  });
}

function addPodUserLabel(element, context = 'feed') {
  if (!element || element.querySelector('.pod-user-label')) return;

  const label = document.createElement('span');
  label.className = `pod-user-label${context === 'feed' ? ' pod-user-label--feed' : ''}`;
  label.textContent = 'Pod User';

  // Find the actual text node containing the name
  const textNodes = Array.from(element.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());

  if (textNodes.length > 0) {
    // Insert after the first text node containing the name
    const nameNode = textNodes[0];
    element.insertBefore(label, nameNode.nextSibling);
  } else {
    // Fallback: insert at the beginning
    element.insertBefore(label, element.firstChild);
  }
}

function processPodUsers() {
  try {
    // Handle profile pages
    const profileUrl = window.location.href;
    if (isPodUser(profileUrl)) {
      const headlineSelectors = [
        '.text-body-medium.break-words',
        '.pv-text-details__left-panel .text-body-medium',
        'div[data-generated-suggestion-target] .text-body-medium'
      ];

      for (const selector of headlineSelectors) {
        const headlineElement = document.querySelector(selector);
        if (headlineElement && !headlineElement.hasAttribute('data-pod-processed')) {
          addPodUserLabel(headlineElement, 'profile');
          headlineElement.setAttribute('data-pod-processed', 'true');
          break;
        }
      }
    }

    // Process inline post mentions and links
    const nameSelectors = [
      'a[href*="/in/"].xrRzshziQfYBvuVMpfGnTyyiKZZqmaRxghNaNJtQ span:not([data-pod-processed])',
      'a[href*="/in/"][data-test-app-aware-link] span:not([data-pod-processed])',
      '.ember-view a[href*="/in/"] span:not([data-pod-processed])'
    ];

    document.querySelectorAll(nameSelectors.join(',')).forEach(nameSpan => {
      try {
        const link = nameSpan.closest('a[href*="/in/"]');
        if (!link || !link.href || !isPodUser(link.href)) return;

        addPodUserLabel(nameSpan, 'feed');
        nameSpan.setAttribute('data-pod-processed', 'true');
      } catch (error) {
        console.log('Error processing name span:', error);
      }
    });

    // Process feed posts and search results
    const items = document.querySelectorAll([
      '.feed-shared-update-v2:not([data-pod-processed])',
      '.update-components-actor:not([data-pod-processed])',
      '.search-results__list-item:not([data-pod-processed])'
    ].join(','));

    items.forEach(item => {
      try {
        const linkElement = item.querySelector('a[href*="/in/"]');
        if (!linkElement || !isPodUser(linkElement.href)) return;

        const nameElement = item.querySelector([
          '.feed-shared-actor__name',
          '.update-components-actor__name',
          '.update-components-actor__title .t-bold'
        ].join(','));

        if (nameElement && !nameElement.hasAttribute('data-pod-processed')) {
          addPodUserLabel(nameElement, 'feed');
          nameElement.setAttribute('data-pod-processed', 'true');
          item.setAttribute('data-pod-processed', 'true');
        }
      } catch (error) {
        console.log('Error processing feed item:', error);
      }
    });
  } catch (error) {
    console.log('Error in processPodUsers:', error);
  }
}