# Facebook Notifier V2

A Chrome extension that reloads the **Facebook Free Marketplace** and **Facebook Groups Notifications** pages and scans them for specific items of interest.

## 🚀 Features

- Automatically reloads the Facebook Marketplace Free category.
- Scans for new, unseen items and optionally notifies the user.
- Allows saving/loading of seen items list.
- Works with Facebook Groups notification filters.
- Lightweight popup UI with interval control.

## 📁 File Structure

```

facebook-notifier-v2/
├── background.ts             # Background service worker logic
├── content\_marketplace.ts    # Script injected into the Marketplace page
├── content\_notifications.ts  # Script injected into the Groups Notifications page
├── popup.ts                  # Popup script logic
├── popup.html                # Popup UI
├── manifest.json             # Chrome extension manifest (v3)
├── .prettierrc               # Formatting config

````

## 🧩 Installation (Development)

1. Clone this repository:
```bash
   git clone https://github.com/assaf-malki/facebook-notifier-v2.git
```

2. Build or transpile TypeScript if needed:

```bash
   tsc
```

3. Open Chrome and navigate to:

```
chrome://extensions/
```

4. Enable **Developer Mode** (top right toggle).

5. Click **"Load unpacked"** and select the project directory.

6. The extension should now appear in your toolbar. Click it to open the popup and configure your settings.

## ⚙️ Usage

* Set your desired reload interval (default: 60 seconds).
* Click **Start** to begin scanning.
* Use **Save Seen Items** to download your history of viewed items.
* Use **Load Seen Items** to resume from a saved file.

## 🛡️ Permissions

This extension requires the following Chrome permissions:

* `scripting`, `tabs`, `storage`, `downloads`, `alarms` – For DOM interaction, saving/loading state, and timed reloads.
* `host_permissions` for `https://www.facebook.com/marketplace/category/free` – To access and scan the Marketplace.

## 🔐 Security

No API keys, tokens, or private user data are stored or transmitted. All scanning occurs locally on the user's machine.

## 📝 License

MIT License. Feel free to fork and adapt to your own needs.

---

**Note:** This project is not affiliated with or endorsed by Facebook.
