document.addEventListener('DOMContentLoaded', () => {
  const updateButton = document.getElementById('updateButton');
  const lastUpdateElement = document.getElementById('lastUpdate');
  const statusElement = document.getElementById('status');

  // Show last update time
  chrome.storage.local.get(['lastUpdate'], (result) => {
    if (result.lastUpdate) {
      const date = new Date(result.lastUpdate);
      lastUpdateElement.textContent = `Last updated: ${date.toLocaleString()}`;
    } else {
      lastUpdateElement.textContent = 'Not updated yet';
    }
  });

  updateButton.addEventListener('click', async () => {
    updateButton.disabled = true;
    statusElement.textContent = 'Updating...';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'updateList' });
      
      if (response.success) {
        statusElement.textContent = 'Update successful!';
        const date = new Date();
        lastUpdateElement.textContent = `Last updated: ${date.toLocaleString()}`;
      } else {
        statusElement.textContent = `Update failed: ${response.error}`;
      }
    } catch (error) {
      statusElement.textContent = 'Update failed: ' + error.message;
    } finally {
      updateButton.disabled = false;
      setTimeout(() => {
        statusElement.textContent = '';
      }, 3000);
    }
  });
});
