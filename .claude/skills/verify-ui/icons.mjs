// Compares icon rendering across a lucide-react (or any icon library) version bump.
// Run once per version with a label, then diff the outputs:
//
//   node .claude/skills/verify-ui/icons.mjs before     # on current main
//   node .claude/skills/verify-ui/icons.mjs after      # on the bumped branch
//   diff .claude/skills/verify-ui/out/attrs_before.txt .claude/skills/verify-ui/out/attrs_after.txt
//
// Three independent signals, strongest first:
//   1. SVG census   — counts every <svg> per page and flags any 0-size or path-less one.
//                     A removed/renamed icon shows up here even when tsc passes.
//   2. Geometry dump — raw path data + stroke-width + viewBox, so a redraw is detectable
//                     even when it's pixel-identical.
//   3. Cropped shots — the icon-dense regions, for the human check.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const LABEL = process.argv[2];
if (!LABEL) {
    console.error('usage: node icons.mjs <label>   (e.g. "before" or "after")');
    process.exit(2);
}

const BASE = process.env.APP_URL || 'http://localhost:5175';
const OUT = new URL('./out/', import.meta.url).pathname;
const SHOTS = `${OUT}icons_${LABEL}/`;
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const census = [];
const broken = [];

async function survey(name) {
    const svgs = await page.$$eval('svg', (els) =>
        els.map((el) => {
            const r = el.getBoundingClientRect();
            return {
                cls: el.getAttribute('class') || '',
                w: Math.round(r.width),
                h: Math.round(r.height),
                paths: el.querySelectorAll('path,circle,line,rect,polyline,polygon').length,
            };
        })
    );
    const visible = svgs.filter((s) => s.w > 0 && s.h > 0);
    const bad = svgs.filter((s) => s.w === 0 || s.h === 0 || s.paths === 0);
    census.push(
        `${name.padEnd(22)} svgs=${String(svgs.length).padStart(3)}  visible=${String(visible.length).padStart(3)}  empty/0-size=${bad.length}`
    );
    for (const b of bad) broken.push(`${name}: cls="${b.cls}" ${b.w}x${b.h} paths=${b.paths}`);
}

// Raw geometry — catches redraws that pixel comparison and the eye both miss.
async function geometry() {
    return page.$$eval('svg', (els) =>
        els.slice(0, 12).map((el) => {
            const geo = [...el.querySelectorAll('path,circle,line,rect,polyline,polygon')]
                .map((n) => n.getAttribute('d') || `${n.tagName}:${n.getAttribute('points') || ''}`)
                .join('|');
            return `vb=${el.getAttribute('viewBox')} sw=${el.getAttribute('stroke-width')} lc=${el.getAttribute('stroke-linecap')} geo=${geo.slice(0, 120)}`;
        })
    );
}

const crop = async (sel, name) => {
    const el = await page.$(sel);
    if (el) await el.screenshot({ path: `${SHOTS}${name}.png` });
};

// --- Landing: where CircleCheck / TrendingUp / ShieldCheck live
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('text=Start Planning', { timeout: 15000 });
await survey('landing');
const geo = await geometry();
await page.screenshot({ path: `${SHOTS}landing-full.png`, fullPage: true });
await crop('header, nav', 'landing-header');
await crop('footer', 'footer');

// --- Wizard 2: HelpCircle popovers, Trash2 buttons, AlertCircle
await page.click('text=Start Planning');
await page.waitForURL('**/wizard/1', { timeout: 15000 });
await page.click('text=Married filing jointly');
await page.click('button:has-text("Next")');
await page.waitForSelector('h2:has-text("Savings & Income")', { timeout: 15000 });
await page.click('text=+ Add Part-Time Work');
await page.waitForSelector('span:text-is("You only")', { timeout: 10000 });
await survey('wizard2');
await crop('h4:has-text("Part-Time Work")', 'wizard2-parttime');

await page.click('button:has-text("Next")');
await page.waitForSelector('h2:has-text("Healthcare Costs")', { timeout: 15000 });
await survey('wizard3');

await page.click('button:has-text("Next")');
await page.waitForSelector('h2:has-text("Assumptions & Strategy")', { timeout: 15000 });
await survey('wizard4');

// --- Results: the tab row is the densest icon strip in the app
await page.click('button:has-text("Calculate")');
await page.waitForURL('**/results', { timeout: 60000 });
await page.waitForSelector('[role="tablist"]', { timeout: 60000 });
await survey('results-summary');
await crop('[role="tablist"]', 'results-tablist');

// --- Disclosures: AlertTriangle + Info
await page.locator('[role="tab"]').nth(4).click();
await page.waitForTimeout(600);
await survey('results-disclosures');
await page.screenshot({ path: `${SHOTS}disclosures.png` });

await browser.close();

writeFileSync(`${OUT}attrs_${LABEL}.txt`, geo.join('\n') + '\n');

console.log(`\n=== SVG CENSUS (${LABEL}) ===`);
console.log(census.join('\n'));
console.log(`\n=== EMPTY / ZERO-SIZE SVGs (${LABEL}) ===`);
console.log(broken.length ? broken.join('\n') : '(none)');
console.log(`\ngeometry: ${OUT}attrs_${LABEL}.txt`);
console.log(`screenshots: ${SHOTS}`);
process.exit(broken.length ? 1 : 0);
