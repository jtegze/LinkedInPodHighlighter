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
  let cleanUrl = url.toLowerCase().split('?')[0].split('#')[0];
  cleanUrl = cleanUrl.replace(/\/overlay\/.*$/, '');
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

function addPodUserLabel(element) {
  // Skip if element or any ancestor already has a label
  let parent = element;
  while (parent) {
    if (parent.querySelector('.pod-user-label')) {
      return;
    }
    parent = parent.parentElement;
  }

  const label = document.createElement('span');
  label.className = 'pod-user-label pod-user-label--feed';
  label.textContent = 'Pod User';

  // Find the actual name text node
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const parentElement = node.parentElement;
        // Only accept text nodes that are directly inside the target element
        // and not inside any child elements
        return (parentElement === element && node.textContent.trim()) 
          ? NodeFilter.FILTER_ACCEPT 
          : NodeFilter.FILTER_REJECT;
      }
    }
  );

  let nameNode = null;
  while (walker.nextNode()) {
    nameNode = walker.currentNode;
    break; // Take only the first valid text node
  }

  if (nameNode) {
    element.insertBefore(label, nameNode.nextSibling);
    element.setAttribute('data-pod-processed', 'true');
  }
}

function processPodUsers() {
  try {
    // Handle profile pages
    const profileUrl = window.location.href;
    if (isPodUser(profileUrl)) {
      const headlineElement = document.querySelector('.text-body-medium.break-words');
      if (headlineElement && !headlineElement.closest('[data-pod-processed]')) {
        addPodUserLabel(headlineElement);
      }
    }

    // Process names in feed and search results
    const nameLinks = document.querySelectorAll([
      // Search results and profile links
      '.feed-shared-actor__name:not([data-pod-processed])',
      '.update-components-actor__name:not([data-pod-processed])',
      '.update-components-actor__title span.t-bold:not([data-pod-processed])',
      // Post mentions
      'a[href*="/in/"] span.ember-view:not([data-pod-processed])'
    ].join(','));

    nameLinks.forEach(nameElement => {
      try {
        // Skip if this is an avatar or part of one
        if (
          nameElement.classList.contains('update-components-actor__avatar-image') ||
          nameElement.closest('.update-components-actor__avatar') ||
          nameElement.querySelector('img')
        ) {
          return;
        }

        // Find the associated profile link
        const link = nameElement.closest('a[href*="/in/"]');
        if (!link || !isPodUser(link.href)) return;

        // Add label only to the innermost text container
        addPodUserLabel(nameElement);
      } catch (error) {
        console.log('Error processing name element:', error);
      }
    });
  } catch (error) {
    console.log('Error in processPodUsers:', error);
  }
}