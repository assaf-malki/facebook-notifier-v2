const intervalInput = document.getElementById('interval') as HTMLInputElement;

// Load saved interval on popup open
chrome.storage.local.get(['reloadInterval'], (res) => {
  intervalInput.value = res.reloadInterval?.toString() || '60';
});

document.getElementById('start')?.addEventListener('click', () => {
  const seconds = parseInt(intervalInput.value, 10) || 60;
  chrome.storage.local.set({
    notifierEnabled: true,
    reloadInterval: seconds,
  });
});

document.getElementById('stop')?.addEventListener('click', () => {
  chrome.storage.local.set({ notifierEnabled: false });
});

const seenItemsKey = 'seenItems';
const notifItemsKey = 'seenNotificationIds';

document.getElementById('saveData')?.addEventListener('click', () => {
  chrome.storage.local.get([seenItemsKey, notifItemsKey], (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
      url,
      filename: 'facebook_seen_data.json',
      saveAs: true,
    });
  });
});

document.getElementById('loadData')?.addEventListener('click', () => {
  const fileInput = document.getElementById('loadFile') as HTMLInputElement;
  fileInput.click();

  fileInput.onchange = () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (data[seenItemsKey] || data[notifItemsKey]) {
          chrome.storage.local.set(data, () => {
            alert('Data loaded successfully!');
          });
        } else {
          alert('Invalid file format.');
        }
      } catch (e) {
        alert('Failed to parse file.');
        console.error(e);
      }
    };
    reader.readAsText(file);
  };
});
