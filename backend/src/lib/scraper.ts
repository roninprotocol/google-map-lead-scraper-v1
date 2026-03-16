import { chromium, type Page } from 'playwright';
import { createSearchUrl } from './searchBuilder';

export interface RawBusiness {
  name: string;
  category: string;
  address: string;
  phone: string;
  website: string;
  rating: string;
  reviews: string;
  matchConfidence: 'high' | 'medium' | 'low';
}

export type ScraperEvent =
  | {
      type: 'progress';
      message: string;
    }
  | {
      type: 'result';
      data: RawBusiness;
    };

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value).split(' ').filter((token) => token.length > 2);
}

function isLoosePartialMatch(source: string, candidate: string): boolean {
  const normalizedSource = normalizeText(source);
  const normalizedCandidate = normalizeText(candidate);

  if (!normalizedSource || !normalizedCandidate) {
    return false;
  }

  return normalizedSource.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedSource);
}

function inferMatchConfidence(
  keyword: string,
  record: Pick<RawBusiness, 'name' | 'category'>
): 'high' | 'medium' | 'low' {
  const normalizedKeyword = normalizeText(keyword);
  const normalizedCategory = normalizeText(record.category || '');
  const normalizedName = normalizeText(record.name || '');

  if (!normalizedKeyword) {
    return 'high';
  }

  if (isLoosePartialMatch(normalizedCategory, normalizedKeyword)) {
    return 'high';
  }

  if (isLoosePartialMatch(normalizedName, normalizedKeyword)) {
    return 'medium';
  }

  const keywordTokens = tokenize(normalizedKeyword);
  const categoryTokens = tokenize(normalizedCategory);
  const nameTokens = tokenize(normalizedName);
  const categoryOverlap = keywordTokens.filter((token) =>
    categoryTokens.some((categoryToken) => categoryToken.includes(token) || token.includes(categoryToken))
  ).length;

  if (categoryOverlap > 0) {
    return 'medium';
  }

  const nameOverlap = keywordTokens.filter((token) =>
    nameTokens.some((nameToken) => nameToken.includes(token) || token.includes(nameToken))
  ).length;

  if (nameOverlap > 0) {
    return 'medium';
  }

  return 'low';
}

function normalizeBusinessLink(link: string): string | null {
  if (!link) {
    return null;
  }

  try {
    const url = new URL(link);
    const isGoogleMapsHost = /(^|\.)google\./i.test(url.hostname);
    const isPlaceDetailPath = url.pathname.includes('/maps/place/');
    const isJunkPath = ['/maps/search/', '/maps/dir/', '/maps/preview/'].some((fragment) =>
      url.pathname.includes(fragment)
    );

    if (!isGoogleMapsHost || !isPlaceDetailPath || isJunkPath) {
      return null;
    }

    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function shouldCaptureDebugArtifacts() {
  return process.env.SCRAPER_DEBUG_ARTIFACTS === 'true';
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const reason = signal.reason;
    const message =
      reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'Scrape request was aborted.';
    throw new Error(message);
  }
}

async function waitForBusinessHeader(page: Page, timeout = 15000): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        const primaryHeader = document.querySelector('h1.DUwDvf') as HTMLElement | null;
        const fallbackHeader = document.querySelector('h1') as HTMLElement | null;
        const headerText = primaryHeader?.innerText?.trim() || fallbackHeader?.innerText?.trim() || '';
        return headerText.length > 0;
      },
      { timeout }
    );

    return true;
  } catch (error) {
    console.warn(`Business header did not become ready for ${page.url()}:`, error);
    return false;
  }
}

async function getPageDebugSnapshot(page: Page): Promise<{ title: string; firstH1: string }> {
  try {
    return await page.evaluate(() => {
      const firstHeading = document.querySelector('h1') as HTMLElement | null;
      return {
        title: document.title,
        firstH1: firstHeading?.innerText?.trim() || '',
      };
    });
  } catch (error) {
    console.warn(`Failed to capture page debug snapshot for ${page.url()}:`, error);
    return {
      title: '',
      firstH1: '',
    };
  }
}

async function extractBusiness(page: Page): Promise<RawBusiness> {
  return page.evaluate(() => {
    const extractedName =
      document.querySelector('h1.DUwDvf')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      '';

    let category = '';
    for (const selector of [
      'button[jsaction*="pane.rating.category"]',
      'button[jsaction*="category"]',
      '.DkEaL',
      '[role="main"] button[jsaction*="category"]',
    ]) {
      const element = document.querySelector(selector) as HTMLElement | null;
      const text = element?.innerText?.trim() || element?.textContent?.trim() || '';
      if (text) {
        category = text;
        break;
      }
    }

    let address = '';
    for (const selector of [
      'button[data-item-id="address"]',
      '[data-item-id="address"]',
      '[aria-label^="Address:"]',
    ]) {
      const element = document.querySelector(selector) as HTMLElement | null;
      const text = element?.innerText?.trim() || element?.textContent?.trim() || '';
      if (text) {
        address = text;
        break;
      }
    }

    let phone = '';
    for (const selector of [
      'button[data-item-id^="phone:tel:"]',
      '[data-item-id*="phone"]',
      '[aria-label^="Phone:"]',
    ]) {
      const element = document.querySelector(selector) as HTMLElement | null;
      const text = element?.innerText?.trim() || element?.textContent?.trim() || '';
      if (text) {
        phone = text;
        break;
      }
    }

    let website = '';
    for (const selector of [
      'a[data-item-id="authority"]',
      '[data-item-id="authority"] a',
      '[data-item-id="authority"]',
    ]) {
      const element = document.querySelector(selector) as HTMLAnchorElement | HTMLElement | null;
      const href = element instanceof HTMLAnchorElement ? element.href?.trim() || '' : '';
      const text = element?.textContent?.trim() || '';
      if (href) {
        website = href;
        break;
      }
      if (text) {
        website = text;
        break;
      }
    }

    let rating = '';
    for (const selector of ['[role="img"][aria-label*="stars"]', '[aria-label*="stars"]']) {
      const element = document.querySelector(selector) as HTMLElement | null;
      const label = element?.getAttribute('aria-label')?.trim() || element?.textContent?.trim() || '';
      if (!label) {
        continue;
      }

      const match = label.match(/[0-9.]+/);
      if (match?.[0]) {
        rating = match[0];
        break;
      }
    }

    let reviews = '';
    for (const selector of ['button[jsaction*="pane.reviewChart.moreReviews"]', '[aria-label*="reviews"]']) {
      const element = document.querySelector(selector) as HTMLElement | null;
      const label = element?.getAttribute('aria-label')?.trim() || element?.textContent?.trim() || '';
      if (!label) {
        continue;
      }

      const match = label.match(/[0-9,]+/);
      if (match?.[0]) {
        reviews = match[0].replace(/,/g, '');
        break;
      }
    }

    return {
      name: extractedName,
      category,
      address,
      phone,
      website,
      rating,
      reviews,
      matchConfidence: 'low',
    };
  });
}

async function logSkipDebugState(
  page: Page,
  index: number,
  link: string,
  reason: string,
  partialRecord?: Partial<RawBusiness>
): Promise<void> {
  const pageState = await getPageDebugSnapshot(page);

  if (shouldCaptureDebugArtifacts()) {
    const screenshotPath = `debug-no-name-${index + 1}.png`;

    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.warn(`Debug screenshot saved to: ${screenshotPath}`);
    } catch (error) {
      console.error(`Failed to save debug screenshot for ${link}:`, error);
    }
  }

  console.warn(`Skipping result for missing name: ${link}`);
  console.warn(`Skip reason: ${reason}`);
  console.warn(`Partial record: ${JSON.stringify(partialRecord || {})}`);
  console.warn(`Document title: ${pageState.title}`);
  console.warn(`First h1 text: ${pageState.firstH1 || '(empty)'}`);
}

export async function scrape(
  keyword: string,
  location: string,
  emit: (event: ScraperEvent) => void = () => {},
  signal?: AbortSignal
): Promise<RawBusiness[]> {
  throwIfAborted(signal);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const abortListener = () => {
    void browser.close().catch(() => {
      // Browser may already be closed after an abort or terminal error.
    });
  };

  if (signal) {
    signal.addEventListener('abort', abortListener, { once: true });
  }

  emit({ type: 'progress', message: 'Browser launched.' });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    const searchUrl = createSearchUrl(keyword, location);

    throwIfAborted(signal);
    console.log(`Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1200);
    emit({ type: 'progress', message: `Searching Google Maps for ${keyword} in ${location}...` });

    const feed = page.locator('[role="feed"]');

    try {
      await feed.waitFor({ state: 'visible', timeout: 10000 });
      for (let index = 0; index < 5; index += 1) {
        throwIfAborted(signal);
        await feed.evaluate((element) => element.scrollBy(0, 1000));
        await page.waitForTimeout(1000);
      }
    } catch {
      console.log('Could not find or scroll the results feed. Proceeding with visible links.');
    }

    throwIfAborted(signal);
    const rawLinks = await page.$$eval('a[href]', (elements) =>
      elements.map((anchor) => (anchor as HTMLAnchorElement).href)
    );
    const links = [...new Set(rawLinks.map(normalizeBusinessLink).filter((link): link is string => Boolean(link)))];
    const targetLinks = links.slice(0, 20);

    console.log(`Found ${links.length} unique business links.`);
    emit({ type: 'progress', message: `Found ${links.length} business listings.` });

    const results: RawBusiness[] = [];

    for (let index = 0; index < targetLinks.length; index += 1) {
      throwIfAborted(signal);

      const link = targetLinks[index];
      console.log(`Scraping ${index + 1}/${targetLinks.length}...`);
      emit({ type: 'progress', message: `Extracting result ${index + 1} of ${targetLinks.length}...` });

      let record: RawBusiness | undefined;
      let pageLoadFailed = false;

      try {
        await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const headerReady = await waitForBusinessHeader(page);
        record = await extractBusiness(page);

        if (!record.name && !headerReady) {
          await page.waitForTimeout(1000);
          record = await extractBusiness(page);
        }

        console.log('Extracted:', JSON.stringify(record));
      } catch (error) {
        pageLoadFailed = true;
        console.error(`Failed to scrape link: ${link}`, error);
        const pageState = await getPageDebugSnapshot(page);
        console.warn(`Skip URL: ${link}`);
        console.warn(`Skip error: ${error instanceof Error ? error.message : String(error)}`);
        console.warn(`Partial record: ${JSON.stringify(record || {})}`);
        console.warn(`Document title: ${pageState.title}`);
        console.warn(`First h1 text: ${pageState.firstH1 || '(empty)'}`);
      }

      if (pageLoadFailed) {
        emit({ type: 'progress', message: `Skipped because the detail page failed to load.` });
        continue;
      }

      if (!record?.name?.trim()) {
        await logSkipDebugState(page, index, link, 'name missing after wait and extraction fallback logic', record);
        emit({ type: 'progress', message: `Skipped because the listing did not expose a business name.` });
        continue;
      }

      record.matchConfidence = inferMatchConfidence(keyword, record);

      if (record.matchConfidence === 'low') {
        console.warn(
          `Loose keyword mismatch for ${record.name || 'unknown'} (${record.category || 'unknown category'}) vs "${keyword}" - keeping result`
        );
      }

      results.push(record);
      emit({ type: 'result', data: record });
      emit({ type: 'progress', message: `Captured ${record.name}.` });
      await page.waitForTimeout(800 + Math.random() * 500);
    }

    console.log(`SCRAPER_RAW_COUNT ${results.length}`);
    console.log(`SCRAPER_RAW_NAMES ${JSON.stringify(results.map((record) => record.name || ''))}`);
    emit({ type: 'progress', message: `Scrape complete. ${results.length} results collected.` });
    return results;
  } finally {
    if (signal) {
      signal.removeEventListener('abort', abortListener);
    }

    await browser.close().catch(() => {
      // Ignore close errors during abort/teardown.
    });
  }
}
