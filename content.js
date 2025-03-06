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
  // Skip if element or its ancestors already have a label
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

  // Find the actual text node containing the name
  const textNodes = Array.from(element.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());

  if (textNodes.length > 0) {
    // Insert after the first text node containing the name
    element.insertBefore(label, textNodes[0].nextSibling);
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

    // Process feed posts and search results
    document.querySelectorAll('a[href*="/in/"]:not([data-pod-processed])').forEach(link => {
      try {
        if (!isPodUser(link.href)) return;

        // Find the innermost span that contains only the name text
        const nameSpan = link.querySelector('span:not(.pod-user-label)');
        if (nameSpan && !nameSpan.closest('[data-pod-processed]')) {
          // Skip if this is part of an avatar container
          if (
            nameSpan.classList.contains('update-components-actor__avatar-image') ||
            nameSpan.closest('.update-components-actor__avatar') ||
            nameSpan.querySelector('img')
          ) {
            return;
          }

          addPodUserLabel(nameSpan);
        }
      } catch (error) {
        console.log('Error processing link:', error);
      }
    });

  } catch (error) {
    console.log('Error in processPodUsers:', error);
  }
}