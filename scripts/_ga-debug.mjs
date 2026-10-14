import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const [name, url] of [['bordle (WORKS)', 'https://bordle.roow.us/'], ['polystats (MISSING)', 'https://polystats.roow.us/']]) {
  const page = await browser.newPage();
  const hits = [];
  page.on('request', r => { if (r.url().includes('/g/collect')) hits.push(r.url()); });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(7000);
  const pv = hits.map(h => new URL(h)).filter(q => q.searchParams.get('en') === 'page_view');
  console.log(`\n=== ${name} ===`);
  for (const q of pv) {
    console.log(`  tid=${q.searchParams.get('tid')} seg=${q.searchParams.get('seg')} dt=${q.searchParams.get('dt')} dl=${q.searchParams.get('dl')}`);
  }
  if (!pv.length) console.log('  (no page_view hit observed)');
  await page.close();
}
await browser.close();
