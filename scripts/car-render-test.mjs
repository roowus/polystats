import { chromium } from 'playwright';

/**
 * Experiment: can we get PolyTrack to render a car PNG by driving its UI?
 * Strategy: boot the game, reach a leaderboard list (which renders car
 * thumbnails via the native generator), and harvest the resulting data URLs.
 */
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

await page.goto('https://app-polytrack.kodub.com/0.6.3/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(10000);

// Any car-thumbnail <img> with a data: URL means the native generator ran.
const thumbs = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img.car-thumbnail, img')];
  const dataUrls = imgs.map((i) => i.src).filter((s) => s.startsWith('data:image'));
  return {
    totalImgs: imgs.length,
    dataUrlCount: dataUrls.length,
    sample: dataUrls.slice(0, 2).map((s) => s.slice(0, 60) + '... (' + s.length + ' chars)'),
    classes: [...new Set(imgs.map((i) => i.className).filter(Boolean))].slice(0, 10),
  };
});

console.log(JSON.stringify(thumbs, null, 2));
console.log('errors:', errors.slice(0, 3));
await browser.close();
