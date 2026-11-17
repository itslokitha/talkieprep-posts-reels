// Render a carousel source HTML into one PNG per slide.
// Usage: node tools/render-post.js <source.html> <output-folder>
// Every <section class="slide"> must be exactly 1080x1350. Output: slide-01.png, slide-02.png, ...
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { checkFonts, checkMargins } = require('./render-common');

(async () => {
  const [src, outDir] = process.argv.slice(2);
  if (!src || !outDir) { console.error('Usage: node tools/render-post.js <source.html> <output-folder>'); process.exit(2); }
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(src), { waitUntil: 'networkidle' });
  await checkFonts(page);

  const slides = await page.$$('.slide');
  if (!slides.length) throw new Error('No <section class="slide"> found');
  let warnings = 0;
  for (let i = 0; i < slides.length; i++) {
    const box = await slides[i].boundingBox();
    if (Math.round(box.width) !== 1080 || Math.round(box.height) !== 1350)
      throw new Error(`Slide ${i + 1} is ${box.width}x${box.height}, expected 1080x1350`);
    warnings += await checkMargins(page, '.slide', i, { side: 80, bottom: 0 }, `slide ${i + 1}`);
    const file = path.join(outDir, `slide-${String(i + 1).padStart(2, '0')}.png`);
    await slides[i].screenshot({ path: file });
    console.log('wrote', file);
  }
  await browser.close();
  console.log(`${slides.length} slides rendered, ${warnings} layout warning(s)`);
})().catch(e => { console.error('RENDER FAILED:', e.message); process.exit(1); });
