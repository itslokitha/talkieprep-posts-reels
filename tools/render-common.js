// Shared checks for the render scripts.
const REQUIRED_FONTS = ['Bricolage Grotesque', 'Figtree'];

// Fail if the brand fonts did not load (e.g. Google Fonts blocked); a fallback font would look off-brand.
async function checkFonts(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '')));
  const missing = REQUIRED_FONTS.filter(f => !loaded.includes(f));
  if (missing.length) throw new Error('Brand fonts did not load: ' + missing.join(', ') +
    '. Check that fonts.googleapis.com is reachable and the <link> includes them.');
}

// Warn about visible text that crosses the side margins or the bottom safe zone of a frame.
// Elements inside .wave or [data-bleed] are ignored.
async function checkMargins(page, frameSelector, index, { side, bottom }, label) {
  const issues = await page.evaluate(({ frameSelector, index, side, bottom }) => {
    const frame = document.querySelectorAll(frameSelector)[index];
    const fr = frame.getBoundingClientRect();
    const out = [];
    frame.querySelectorAll('*').forEach(el => {
      if (el.closest('.wave') || el.closest('[data-bleed]')) return;
      for (let a = el; a && a !== frame; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
      }
      const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (!hasText) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const bad = r.left < fr.left + side - 1 || r.right > fr.right - side + 1 ||
                  r.bottom > fr.bottom - bottom + 1;
      if (bad) out.push(`"${el.textContent.trim().slice(0, 40)}"`);
    });
    return out;
  }, { frameSelector, index, side, bottom });
  issues.forEach(t => console.warn(`WARNING ${label}: text outside safe area: ${t}`));
  return issues.length;
}

module.exports = { checkFonts, checkMargins };
