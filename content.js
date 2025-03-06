// Cache for pod users URLs
let podUsers = [];

// Initialize pod users from storage
chrome.storage.local.get(['podUsers'], (result) => {
  if (result.podUsers) {
    podUsers = result.podUsers;
    console.log('Pod users loaded:', podUsers.length, 'entries');
    processPodUsers();
  } else {
    console.log('No pod users found in storage');
  }
});

// Listen for updates from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'refreshPodUsers') {
    chrome.storage.local.get(['podUsers'], (result) => {
      podUsers = result.podUsers || [];
      console.log('Pod users refreshed:', podUsers.length, 'entries');
      processPodUsers();
    });
  }
});

// Process DOM mutations to catch dynamically loaded content
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    // Only process if nodes were added
    if (mutation.addedNodes.length > 0) {
      console.log('DOM mutation detected, processing new nodes');
      processPodUsers();
      break;
    }
  }
});

// Start observing with a more specific configuration
observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: false,
  attributes: false
});

// Main function to process and label pod users
function processPodUsers() {
  // Process profile pages
  const profileSection = document.querySelector('.pv-top-card');
  if (profileSection) {
    console.log('Found profile section');
    const profileUrl = window.location.href.split('?')[0];
    console.log('Profile URL:', profileUrl);
    if (isPodUser(profileUrl)) {
      console.log('Profile is a pod user');
      const headlineElement = profileSection.querySelector('.text-body-medium.break-words');
      if (headlineElement && !headlineElement.querySelector('.pod-user-label')) {
        console.log('Adding pod user label to profile headline');
        addPodUserLabel(headlineElement, 'profile');
      }
    }
  }

  // Process feed posts and search results
  const feedPosts = document.querySelectorAll('.feed-shared-update-v2, .update-components-actor');
  console.log('Found feed posts:', feedPosts.length);
  feedPosts.forEach(post => {
    const actorElement = post.querySelector('.feed-shared-actor, .update-components-actor__container');
    if (actorElement) {
      const linkElement = actorElement.querySelector('a');
      if (linkElement) {
        const profileUrl = linkElement.href.split('?')[0];
        console.log('Feed post URL:', profileUrl);
        if (isPodUser(profileUrl) && !actorElement.querySelector('.pod-user-label')) {
          console.log('Feed post is from a pod user');
          const headlineElement = actorElement.querySelector('.update-components-actor__description');
          if (headlineElement) {
            console.log('Adding pod user label to search result headline');
            addPodUserLabel(headlineElement, 'profile');
          } else {
            const nameElement = actorElement.querySelector('.feed-shared-actor__name, .update-components-actor__name, .update-components-actor__title .t-bold');
            if (nameElement) {
              console.log('Adding pod user label to feed post');
              addPodUserLabel(nameElement, 'feed');
            }
          }
        }
      }
    }
  });
}

function isPodUser(url) {
  const matches = podUsers.some(podUrl => url.includes(podUrl));
  console.log('URL check:', url, matches ? 'is' : 'is not', 'a pod user');
  return matches;
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
    // For profiles and search results, insert before the text
    element.insertBefore(label, element.firstChild);
  } else {
    // For feed posts, append after the name
    element.appendChild(label);
  }
  console.log('Added pod user label:', context, 'context');
}