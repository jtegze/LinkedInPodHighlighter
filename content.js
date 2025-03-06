// Cache for pod users URLs
let podUsers = [];

// Initialize pod users from storage
chrome.storage.local.get(['podUsers'], (result) => {
  if (result.podUsers) {
    podUsers = result.podUsers;
    processPodUsers();
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

// Process DOM mutations to catch dynamically loaded content
const observer = new MutationObserver((mutations) => {
  processPodUsers();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Main function to process and label pod users
function processPodUsers() {
  // Process profile pages
  const profileSection = document.querySelector('.pv-top-card');
  if (profileSection) {
    const profileUrl = window.location.href.split('?')[0];
    if (isPodUser(profileUrl)) {
      const nameElement = profileSection.querySelector('h1');
      if (nameElement && !nameElement.querySelector('.pod-user-label')) {
        addPodUserLabel(nameElement);
      }
    }
  }

  // Process feed posts
  const feedPosts = document.querySelectorAll('.feed-shared-update-v2');
  feedPosts.forEach(post => {
    const actorElement = post.querySelector('.feed-shared-actor');
    if (actorElement) {
      const linkElement = actorElement.querySelector('a');
      if (linkElement) {
        const profileUrl = linkElement.href.split('?')[0];
        if (isPodUser(profileUrl) && !actorElement.querySelector('.pod-user-label')) {
          addPodUserLabel(actorElement.querySelector('span'));
        }
      }
    }
  });
}

function isPodUser(url) {
  return podUsers.some(podUrl => url.includes(podUrl));
}

function addPodUserLabel(element) {
  if (!element) return;
  
  const label = document.createElement('span');
  label.className = 'pod-user-label';
  label.textContent = 'Pod User';
  element.appendChild(label);
}
