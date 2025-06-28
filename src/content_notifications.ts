import html2canvas from 'html2canvas';

const TARGET_URLS = [];

const STORAGE_KEY = 'seenPostIds';

function waitForFirstDiv(): Promise<void> {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const divs = document.querySelectorAll('div[aria-posinset]');
      console.log(`[DEBUG] Found ${divs.length} div[aria-posinset] so far...`);

      if (divs.length > 0) {
        console.log(
          '[DEBUG] ✅ Found at least one div[aria-posinset]. Proceeding...'
        );
        clearInterval(checkInterval);
        resolve();
      }
    }, 1000);
  });
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function extractImageName(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split('/').pop(); // get the last part of the path
    if (!lastSegment) return null;
    return lastSegment.split('?')[0]; // remove query string if present
  } catch {
    return null;
  }
}

async function waitForImagesToLoad(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) =>
            img.addEventListener('load', resolve, { once: true })
          )
    )
  );
}

type PostResult = {
  canonicalUrl: string;
  imageUrl?: string;
};

async function getUniqueTargetGroupPosts(): Promise<PostResult[]> {
  console.log('[DEBUG] Loading previously seen post IDs from storage...');
  const seenPostIds: string[] = await new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      resolve(res[STORAGE_KEY] || []);
    });
  });

  const seenSet = new Set(seenPostIds);
  console.log(`[DEBUG] Loaded ${seenSet.size} seen post IDs.`);

  const newResults: PostResult[] = [];
  const newlyFoundPostIds: string[] = [];

  console.log('[DEBUG] Scanning page for new posts...');

  const divs = Array.from(document.querySelectorAll('div[aria-posinset]'));
  for (const div of divs) {
    const posinset = div.getAttribute('aria-posinset') || '?';
    console.log(`[DEBUG] 🔍 Scanning post with aria-posinset="${posinset}"...`);

    const profileNameDiv = div.querySelector(
      'div[data-ad-rendering-role="profile_name"]'
    );
    if (!profileNameDiv) {
      console.log(`[DEBUG] ❌ Post #${posinset} skipped: no profile_name div`);
      continue;
    }

    const groupLink = profileNameDiv.querySelector(
      'a[href*="/groups/"]'
    ) as HTMLAnchorElement | null;
    if (!groupLink || !groupLink.href) {
      console.log(`[DEBUG] ❌ Post #${posinset} skipped: no valid group link`);
      continue;
    }

    const canonicalUrl = TARGET_URLS.find((target) => {
      const targetPath = new URL(target).pathname;
      return groupLink.href.includes(targetPath);
    });
    if (!canonicalUrl) {
      console.log(
        `[DEBUG] ❌ Post #${posinset} skipped: group link not in TARGET_URLS`
      );
      continue;
    }
    console.log(`[DEBUG] ✅ Matched group: ${canonicalUrl}`);

    const img = div.querySelector(
      'div[style] > img[referrerpolicy="origin-when-cross-origin"]'
    ) as HTMLImageElement | null;
    if (!img || !img.src) {
      console.log(
        `[DEBUG] ❌ Post #${posinset} skipped: no matching <img> tag found`
      );
      continue;
    }
    console.log(`[DEBUG] 🖼️ Found image src: ${img.src}`);

    const imageName = extractImageName(img.src);
    if (!imageName) {
      console.log(
        `[DEBUG] ❌ Post #${posinset} skipped: failed to extract image name`
      );
      continue;
    }

    if (!seenSet.has(imageName)) {
      console.log(`[DEBUG] ✅ New image name: ${imageName} (not seen before)`);

      if (!newResults.some((r) => r.canonicalUrl === canonicalUrl)) {
        // Check for "See more" button inside the current post
        const seeMoreButtons = Array.from(
          div.querySelectorAll('div[role="button"][tabindex="0"]')
        );

        for (const btn of seeMoreButtons) {
          const text = btn.textContent?.trim();
          if (text === 'See more') {
            console.log(
              `[DEBUG] ⬇️ Clicking "See more" button in post #${posinset}`
            );
            (btn as HTMLElement).click();
            await new Promise((resolve) => setTimeout(resolve, 1000));
            break; // only click the first "See more"
          }
        }

        if (div instanceof HTMLElement) {
          await waitForImagesToLoad(div);
          const base64Image = (
            await html2canvas(div, { useCORS: true, allowTaint: false })
          ).toDataURL('image/png');

          try {
            const response = await new Promise<{
              success: boolean;
              url?: string;
            }>((resolve) => {
              chrome.runtime.sendMessage(
                {
                  type: 'UPLOAD_IMAGE',
                  payload: { base64Image },
                },
                (res) => resolve(res)
              );
            });

            if (response.success && response.url) {
              newResults.push({ canonicalUrl, imageUrl: response.url });
              console.log(
                `[DEBUG] 🖼️ Uploaded and added ${canonicalUrl} with image: ${response.url}`
              );
            } else {
              newResults.push({ canonicalUrl });
              console.log(
                `[DEBUG] ⚠️ Upload failed. Added ${canonicalUrl} without image.`
              );
            }
          } catch (err) {
            newResults.push({ canonicalUrl });
            console.log(
              `[DEBUG] ❌ Upload error. Added ${canonicalUrl} without image.`,
              err
            );
          }
        } else {
          newResults.push({ canonicalUrl });
          console.log(
            `[DEBUG] ➕ Added ${canonicalUrl} to results (not HTMLElement)`
          );
        }
      } else {
        console.log(
          `[DEBUG] 🔁 Skipped duplicate canonicalUrl in results: ${canonicalUrl}`
        );
      }

      seenSet.add(imageName);
      newlyFoundPostIds.push(imageName);
    } else {
      console.log(`[DEBUG] ⏭️ Skipping duplicate image name: ${imageName}`);
    }
  }

  if (newlyFoundPostIds.length > 0) {
    const updatedPostIds = [...seenSet];
    chrome.storage.local.set({ [STORAGE_KEY]: updatedPostIds }, () => {
      console.log(
        `[DEBUG] 🔄 Updated post IDs saved to storage. Total: ${updatedPostIds.length}`
      );
    });
  } else {
    console.log('[DEBUG] No new post IDs to store.');
  }

  return newResults;
}

async function processPosts() {
  console.log('[DEBUG] Waiting for enough content to load...');
  await waitForFirstDiv();

  console.log('[DEBUG] Waiting 3 seconds after enough divs are found...');
  await sleep(3000);

  const scrollIterations = 3;
  let results: PostResult[] = [];

  for (let i = 0; i < scrollIterations; i++) {
    results.push(...(await getUniqueTargetGroupPosts()));

    if (i < scrollIterations - 1) {
      window.scrollBy(0, 2000);
      await sleep(3000);
    }
  }

  results = Array.from(new Set(results)); // remove duplicates if needed

  console.log(`[DEBUG] Total unique group URLs found: ${results.length}`);
  if (results.length === 0) {
    console.log('[DEBUG] No new posts found. Exiting.');
    return;
  }

  const textBody =
    `New Facebook posts were found from the following groups:\n\n` +
    results
      .map((r) => {
        let out = `• ${r.canonicalUrl}`;
        if (r.imageUrl) out += `\n  Image: ${r.imageUrl}`;
        return out;
      })
      .join('\n\n');

  const htmlBody = `
  <p><strong>New Facebook posts were found from the following groups:</strong></p>
  <ul>
    ${results
      .map(
        (r) =>
          `<li>
            <a href="${r.canonicalUrl}">${r.canonicalUrl}</a>${
              r.imageUrl
                ? `<br><img src="${r.imageUrl}" alt="Image" style="margin-top:5px;" />`
                : ''
            }
          </li>`
      )
      .join('')}
  </ul>
`;

  console.log('[DEBUG] 🚀 Sending email notification...');
  chrome.runtime.sendMessage({
    type: 'SEND_EMAIL',
    payload: {
      subject: `🔔 New Facebook Posts Found (${results.length})`,
      body: textBody,
      html: htmlBody,
    },
  });
}

processPosts();
