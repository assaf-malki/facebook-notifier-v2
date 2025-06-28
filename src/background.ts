import { sendEmail } from './sendEmail';
import { uploadImageToS3 } from './uploadToS3';

const manifest = chrome.runtime.getManifest();
const MONITORED_URLS = (manifest.content_scripts ?? []).flatMap(
  (script) => script.matches || []
);

const ALARM_NAME = 'postsNotifierAlarm';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SEND_EMAIL') {
    const { subject, body, html } = message.payload;

    sendEmail(subject, body, html)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err }));

    return true; // keep sendResponse async
  } else if (message.type === 'UPLOAD_IMAGE') {
    const { base64Image } = message.payload;

    uploadImageToS3(base64Image)
      .then((url) => sendResponse({ success: true, url }))
      .catch((err) => sendResponse({ success: false, error: err }));

    return true; // keeps sendResponse async
  }
});

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function urlMatchesPattern(url: string, pattern: string): boolean {
  // Example: pattern = "https://www.facebook.com/marketplace/category/free"
  if (pattern.includes('*')) {
    const regexPattern =
      '^' + pattern.split('*').map(escapeRegex).join('.*') + '$';
    const regex = new RegExp(regexPattern);
    return regex.test(url);
  } else {
    return url.startsWith(pattern);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('[DEBUG] Alarm triggered. Checking tabs to reload...');

    chrome.tabs.query({ url: ['https://www.facebook.com/*'] }, (tabs) => {
      for (const tab of tabs) {
        if (!tab.url) continue;

        if (
          MONITORED_URLS.some((pattern) => urlMatchesPattern(tab.url!, pattern))
        ) {
          console.log(`[DEBUG] Reloading tab ID ${tab.id} with URL ${tab.url}`);
          if (tab.id !== undefined) {
            chrome.tabs.reload(tab.id);
          }
        }
      }
    });
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.notifierEnabled) {
    console.log('[DEBUG] Storage changed: notifierEnabled updated.');
    if (changes.notifierEnabled.newValue === true) {
      console.log('[DEBUG] Enabling alarm...');
      setupAlarm();
    } else {
      console.log('[DEBUG] Disabling alarm...');
      chrome.alarms.clearAll(() => {
        console.log('[DEBUG] ✅ All alarms cleared.');
      });
    }
  }
});

// Set up the posts notifier alarm
function setupAlarm() {
  chrome.storage.local.get('reloadInterval', (result) => {
    const reloadSeconds = result.reloadInterval || 60;
    chrome.alarms.clearAll(() => {
      chrome.alarms.create('postsNotifierAlarm', {
        periodInMinutes: reloadSeconds / 60,
      });
      console.log(`[DEBUG] ⏰ Alarm set for every ${reloadSeconds} seconds.`);
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[DEBUG] Extension installed. Clearing alarms...');
  chrome.alarms.clearAll(() => {
    console.log('[DEBUG] ✅ All alarms cleared.');
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[DEBUG] Browser started. Clearing alarms...');
  chrome.alarms.clearAll(() => {
    console.log('[DEBUG] ✅ All alarms cleared.');
  });
});
