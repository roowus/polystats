import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

// Boot the production preview server, then verify against it.
const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 2500));

const BASE = 'http://localhost:4173';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/ERR_NAME_NOT_RESOLVED/.test(t)) errors.push(t); });
page.on('pageerror', (e) => errors.push(String(e)));

// 1. Home loads, dark background everywhere (no white flash zones)
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
check('body is navy (no white)', bodyBg === 'rgb(16, 16, 42)', bodyBg);

// overscroll area behind the page is dark
const htmlBg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
check('html is navy (overscroll fixed)', htmlBg === 'rgb(16, 16, 42)', htmlBg);

// 2. Blocky font applied site-wide
const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
check('body uses ForcedSquare', /ForcedSquare/i.test(font), font);

// 3. No vertical borders on nav tabs; tabs full-height (no vertical padding clipping)
const tabBoxes = await page.evaluate(() => {
  const nav = document.querySelector('nav');
  const tabs = [...nav.querySelectorAll('button')].filter((b) => !b.getAttribute('aria-label'));
  return tabs.map((b) => {
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    const navR = nav.getBoundingClientRect();
    return { borderLeft: cs.borderLeftWidth, borderRight: cs.borderRightWidth, top: r.top, bottom: r.bottom, navTop: navR.top, navBottom: navR.bottom, text: b.textContent };
  });
});
check('nav tabs have no vertical borders', tabBoxes.every((t) => t.borderLeft === '0px' && t.borderRight === '0px'));
check('nav tabs fill the bar vertically (no clipping)', tabBoxes.every((t) => t.top >= t.navTop - 1 && t.bottom <= t.navBottom + 1));

// 4. No parallelogram gets cut off at the list edges
const clipped = await page.evaluate(() => {
  const wrap = document.querySelector('nav div div:last-child');
  const wrapR = wrap.getBoundingClientRect();
  return [...wrap.querySelectorAll('button')].some((b) => {
    const r = b.getBoundingClientRect();
    return r.left < wrapR.left || r.right > wrapR.right;
  });
});
check('no nav parallelograms clipped by the container', !clipped);

// 5. Brand words adjacent ("PolyStats" without a space)
const brand = await page.evaluate(() => document.querySelector('nav [aria-label="PolyStats home"] span:last-child').textContent);
check('brand words adjacent', brand === 'PolyStats', brand);

// 6. Favicon wired
const fav = await page.evaluate(() => document.querySelector('link[rel="icon"]')?.getAttribute('href'));
check('favicon is the blocky P png', fav === '/favicon.png', fav);

// 7. No hash in URLs after clicking a nav tab
await page.click('nav button:has-text("Track of the Week")');
await page.waitForTimeout(400);
check('URL has no hash', !page.url().includes('#'), page.url());
check('TOTW page renders', await page.locator('h1:has-text("Track of the Week")').count() > 0);

// 8. Leaderboard + Utils pages render with the game title style
await page.goto(BASE + '/leaderboard', { waitUntil: 'networkidle' });
const lbTitle = await page.locator('h1').first().evaluate((el) => getComputedStyle(el).fontFamily);
check('Leaderboard title uses ForcedSquare', /ForcedSquare/i.test(lbTitle), lbTitle);
const lbText = await page.locator('body').evaluate((el) => getComputedStyle(el).color);
check('Leaderboard text is white', lbText === 'rgb(255, 255, 255)', lbText);

await page.goto(BASE + '/utils', { waitUntil: 'networkidle' });
check('Utils page renders', await page.locator('h1:has-text("Utils")').count() > 0);

// 9. No rounded corner boxes on any page
for (const path of ['/', '/totw', '/user', '/compare', '/leaderboard', '/utils']) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  const rounded = await page.evaluate(() => {
    return [...document.querySelectorAll('div,button,table,input,span,a')].filter((el) => {
      const cs = getComputedStyle(el);
      if (cs.borderRadius !== '0px' && cs.borderRadius !== '') {
        const r = el.getBoundingClientRect();
        return r.width > 60 && r.height > 20; // ignore tiny dots/pills
      }
      return false;
    }).length;
  });
  check(`no rounded boxes on ${path}`, rounded === 0, `${rounded} found`);
}

// 10. console errors
const real = errors.filter((e) => !/googletagmanager|gtag/.test(e));
check('no console errors across pages', real.length === 0, real.slice(0, 3).join(' | '));

// screenshots for the record
await page.goto(BASE + '/user', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/shot-user.png', fullPage: true });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/shot-home.png', fullPage: true });

await browser.close();
preview.kill();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
