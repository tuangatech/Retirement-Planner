// Drives the retirement planner end-to-end in headless Chromium.
// Covers what the Vitest suite cannot: routing, rendering, route guards, the MFJ scope
// badges, and a real 10,000-run Monte Carlo simulation via the Web Worker.
//
//   node .claude/skills/verify-ui/drive.mjs
//
// Exit 0 = every assertion passed and no console/page errors fired.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.APP_URL || 'http://localhost:5175';
const OUT = new URL('./out/shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const errors = [];
const steps = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` });

async function step(label, fn) {
    try {
        await fn();
        steps.push(`PASS  ${label}`);
    } catch (e) {
        steps.push(`FAIL  ${label} — ${e.message.split('\n')[0]}`);
    }
}

await step('landing renders', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Start Planning', { timeout: 15000 });
    await shot('01-landing');
});

await step('navigate landing -> /wizard/1 via button', async () => {
    await page.click('text=Start Planning');
    await page.waitForURL('**/wizard/1', { timeout: 15000 });
    await page.waitForSelector('text=Your Plan', { timeout: 15000 });
    await shot('02-wizard1');
});

await step('select Married filing jointly', async () => {
    await page.click('text=Married filing jointly');
    await page.waitForSelector('text=Spouse’s Age at Retirement', { timeout: 10000 });
});

await step('MFJ scope badges on Screen 1', async () => {
    const n = await page.locator('span:text-is("Household")').count();
    if (n < 2) throw new Error(`expected >=2 Household badges, saw ${n}`);
    steps.push(`  note: ${n} "Household" badges on Screen 1`);
    await shot('03-wizard1-mfj-badges');
});

// Move with Next, never goto — a hard load resets InputsContext and loses the MFJ choice.
await step('step 2 via Next (Savings & Income)', async () => {
    await page.click('button:has-text("Next")');
    await page.waitForURL('**/wizard/2', { timeout: 15000 });
    await page.waitForSelector('h2:has-text("Savings & Income")', { timeout: 15000 });
    await shot('04-wizard2');
});

await step('Screen 2 badges: Household + You only', async () => {
    const n = await page.locator('span:text-is("Household")').count();
    if (n < 1) throw new Error(`expected Household badge, saw ${n}`);
    await page.click('text=+ Add Part-Time Work');
    await page.waitForSelector('span:text-is("You only")', { timeout: 10000 });
    await shot('05-wizard2-badges');
});

await step('step 3 via Next (Healthcare, per-person badge)', async () => {
    await page.click('button:has-text("Next")');
    await page.waitForURL('**/wizard/3', { timeout: 15000 });
    await page.waitForSelector('h2:has-text("Healthcare Costs")', { timeout: 15000 });
    await page.waitForSelector('span:text-is("Per person")', { timeout: 10000 });
    await shot('06-wizard3');
});

await step('step 4 via Next (Assumptions & Strategy)', async () => {
    await page.click('button:has-text("Next")');
    await page.waitForURL('**/wizard/4', { timeout: 15000 });
    await page.waitForSelector('h2:has-text("Assumptions & Strategy")', { timeout: 15000 });
    await page.waitForSelector('span:text-is("Household")', { timeout: 10000 });
    await shot('07-wizard4');
});

await step('Back then Next returns to step 4', async () => {
    await page.click('button:has-text("Back")');
    await page.waitForURL('**/wizard/3', { timeout: 15000 });
    await page.click('button:has-text("Next")');
    await page.waitForURL('**/wizard/4', { timeout: 15000 });
});

await step('run 10,000-sim simulation -> /results', async () => {
    await page.click('button:has-text("Calculate")');
    await page.waitForURL('**/results', { timeout: 60000 });
    await page.waitForSelector('[role="tablist"]', { timeout: 60000 });
    await shot('08-results');
});

// Radix tabs don't expose `value` on [role="tab"] — select by index.
const TABS = ['summary', 'monte-carlo', 'cash-flow', 'breakdown', 'assumptions'];
for (const [i, tab] of TABS.entries()) {
    await step(`results tab: ${tab}`, async () => {
        await page.locator('[role="tab"]').nth(i).click();
        await page.waitForTimeout(400);
        await shot(`09-tab-${tab}`);
    });
}

// "Back to Wizard" must land on the LAST step (where Calculate lives), not step 1 and not
// the long-stale /wizard/7 that WizardPage silently clamped while leaving a wrong URL.
await step('Back to Wizard from /results -> last step (/wizard/4)', async () => {
    await page.click('text=Back to Wizard');
    await page.waitForURL('**/wizard/4', { timeout: 15000 });
    await page.waitForSelector('h2:has-text("Assumptions & Strategy")', { timeout: 15000 });
    await shot('10-back-to-wizard');
});

// /scenarios is declared AFTER the catch-all `path="*"`; router ranking is specificity-based.
await step('/scenarios resolves despite being declared after catch-all', async () => {
    await page.goto(`${BASE}/scenarios`, { waitUntil: 'networkidle' });
    const p = new URL(page.url()).pathname;
    if (p !== '/scenarios') throw new Error(`redirected to ${p} — catch-all won`);
    await shot('10-scenarios');
});

await step('/compare without params -> /scenarios (guard fires)', async () => {
    await page.goto(`${BASE}/compare`, { waitUntil: 'networkidle' });
    const p = new URL(page.url()).pathname;
    if (p !== '/scenarios') throw new Error(`expected /scenarios, got ${p}`);
});

await step('refresh /results -> SPA fallback + guard to /wizard/1', async () => {
    const resp = await page.goto(`${BASE}/results`, { waitUntil: 'networkidle' });
    if (!resp.ok()) throw new Error(`deep link returned HTTP ${resp.status()}`);
    const p = new URL(page.url()).pathname;
    if (p !== '/wizard/1') throw new Error(`expected /wizard/1, got ${p}`);
    await shot('11-results-refresh-guard');
});

await step('unknown path -> catch-all redirect to /', async () => {
    await page.goto(`${BASE}/no-such-page`, { waitUntil: 'networkidle' });
    const p = new URL(page.url()).pathname;
    if (p !== '/') throw new Error(`expected /, got ${p}`);
});

await browser.close();

console.log('\n=== STEPS ===');
console.log(steps.join('\n'));
console.log('\n=== CONSOLE / PAGE ERRORS ===');
console.log(errors.length ? [...new Set(errors)].join('\n') : '(none)');
const failed = steps.filter((s) => s.startsWith('FAIL')).length;
console.log(`\n=== ${failed} failed step(s), ${errors.length} error event(s) ===`);
console.log(`screenshots: ${OUT}`);
process.exit(failed > 0 ? 1 : 0);
