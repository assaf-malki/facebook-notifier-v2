function stripUrlArguments(url: string): string {
  const cleanUrl = url.split('?')[0];
  return cleanUrl.endsWith('/') ? cleanUrl : cleanUrl + '/';
}

function getMarketplaceItems(): HTMLAnchorElement[] {
  return Array.from(
    document.querySelectorAll<HTMLAnchorElement>(
      'a[href*="/marketplace/item/"]'
    )
  ).filter((a) => {
    const match = a.href.match(/\/marketplace\/item\/[\w\d-]+\/?/);
    return match !== null;
  });
}

function scanForItems(): void {
  const itemLinks = getMarketplaceItems();
  const itemData = new Map<string, { title: string; image?: string }>();

  itemLinks.forEach((link) => {
    const cleanedUrl = stripUrlArguments(link.href);
    const title = link.textContent?.trim() || '(no title)';
    const img = link.querySelector('img') as HTMLImageElement;
    const imageSrc = img?.src;
    itemData.set(cleanedUrl, { title, image: imageSrc });
  });

  chrome.storage.local.get('seenItems', (result) => {
    const seenItems: string[] = result.seenItems || [];
    const newItems = [...itemData.keys()].filter(
      (url) => !seenItems.includes(url)
    );

    if (newItems.length > 0) {
      const introText = `היי, מה שלומך? רציתי לשאול אם זה רלוונטי — אני משתף פעולה עם עמותה נהדרת בגבעת שמואל שתומכת בנזקקים ובחיילים בודדים. נשמח מאוד לעזרתך 🙂`;
      const introHtml = `<p>${introText}</p><br/>`;

      const htmlItems = newItems.map((url) => {
        const { title, image } = itemData.get(url)!;
        return `
          <div style="margin-bottom: 20px;">
            <strong>${title}</strong><br/>
            <a href="${url}">${url}</a><br/>
            ${image ? `<img src="${image}" alt="${title}" style="max-width: 200px; border:1px solid #ccc; margin-top: 5px;" />` : ''}
          </div>
        `;
      });

      const htmlBody = introHtml + htmlItems.join('\n');
      const subject = `🛍️ Found ${newItems.length} NEW Facebook Marketplace item(s)`;

      chrome.runtime.sendMessage({
        type: 'SEND_EMAIL',
        payload: {
          subject,
          body: introText + '\n\n' + newItems.join('\n'), // plain text fallback
          html: htmlBody,
        },
      });

      console.log(`Sent email with ${newItems.length} new item(s).`);

      const updatedSeenItems = [...seenItems, ...newItems];
      chrome.storage.local.set({ seenItems: updatedSeenItems });
    } else {
      console.log('No new items found.');
    }
  });
}

scanForItems();
