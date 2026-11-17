// Render a reel source HTML into reel.mp4 (1080x1920, 30 fps, H.264 + silent AAC) and cover.png.
// Usage: node tools/render-reel.js <source.html> <output-folder>
//
// Source HTML contract (see tools/README.md for the full reference):
//   <section id="cover" class="frame"> ... </section>   -> cover.png (1080x1920)
//   <section id="stage" class="frame">                  -> the video
//     (anything directly in #stage outside a .beat stays on screen the whole time: logo, EP tag, waveform)
//     <div class="beat" data-start="0" data-end="2.2"> ... </div>
//   Inside a beat:
//     data-in="0.4"                        element pops in 0.4s after the beat starts
//     data-out="1.8"                       element fades out 1.8s after the beat starts
//     data-type data-at="0.2-3"            words appear one by one between 0.2s and 3s
//     data-timer="64-68" data-at="0-2"     text counts m:ss from 1:04 to 1:08 over 0-2s
//     data-bar="34-53" data-at="0-2"       width animates 34% -> 53% over 0-2s
//   Optional: window.onFrame = (t) => { ... } for anything custom (t = seconds from start).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { checkFonts, checkMargins } = require('./render-common');

const FPS = 30;

const RUNTIME = () => {
  const clamp = x => Math.max(0, Math.min(1, x));
  const ease = x => 1 - Math.pow(1 - x, 3);
  const win = (el, len) => {
    const [a, b] = (el.dataset.at || `0-${len}`).split('-').map(Number);
    return [a, b];
  };
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  // split [data-type] text into word spans once
  document.querySelectorAll('#stage [data-type]').forEach(el => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        const s = document.createElement('span'); s.className = '__w'; s.textContent = part; frag.appendChild(s);
      });
      n.parentNode.replaceChild(frag, n);
    });
  });
  const beats = [...document.querySelectorAll('#stage .beat')];
  window.__duration = Math.max(...beats.map(b => +b.dataset.end));
  window.__seek = t => {
    beats.forEach((b, i) => {
      const s = +b.dataset.start, e = +b.dataset.end, len = e - s;
      const on = t >= s && (t < e || (i === beats.length - 1 && t <= e));
      b.style.display = on ? '' : 'none';
      if (!on) return;
      const lt = t - s;
      b.style.opacity = clamp(lt / 0.12);
      b.style.setProperty('--p', clamp(lt / len));
      b.querySelectorAll('[data-in],[data-out]').forEach(el => {
        const kin = el.dataset.in != null ? clamp((lt - +el.dataset.in) / 0.3) : 1;
        const kout = el.dataset.out != null ? 1 - clamp((lt - +el.dataset.out) / 0.25) : 1;
        el.style.opacity = Math.min(kin, kout);
        el.style.transform = `translateY(${(1 - ease(kin)) * 36}px) scale(${0.96 + 0.04 * ease(kin)})`;
      });
      b.querySelectorAll('[data-type]').forEach(el => {
        const [a, z] = win(el, len); const words = el.querySelectorAll('.__w');
        const n = Math.round(clamp((lt - a) / (z - a)) * words.length);
        words.forEach((w, k) => { w.style.visibility = k < n ? 'visible' : 'hidden'; });
      });
      b.querySelectorAll('[data-timer]').forEach(el => {
        const [from, to] = el.dataset.timer.split('-').map(Number); const [a, z] = win(el, len);
        el.textContent = fmt(from + (to - from) * clamp((lt - a) / (z - a)));
      });
      b.querySelectorAll('[data-bar]').forEach(el => {
        const [from, to] = el.dataset.bar.split('-').map(Number); const [a, z] = win(el, len);
        el.style.width = (from + (to - from) * ease(clamp((lt - a) / (z - a)))) + '%';
      });
    });
    document.querySelectorAll('#stage .wave.live i').forEach((bar, k) => {
      bar.style.height = (24 + Math.abs(Math.sin(k * 0.37 + t * 3.1)) * 80 + Math.abs(Math.sin(k * 1.3 - t * 2.3)) * 40) + 'px';
    });
    if (window.onFrame) window.onFrame(t);
  };
};

(async () => {
  const [src, outDir] = process.argv.slice(2);
  if (!src || !outDir) { console.error('Usage: node tools/render-reel.js <source.html> <output-folder>'); process.exit(2); }
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(src), { waitUntil: 'networkidle' });
  await checkFonts(page);
  await page.addStyleTag({ content: 'html,body{margin:0!important;padding:0!important;background:#071019!important;display:block!important}' });

  for (const id of ['cover', 'stage']) {
    const box = await page.$eval('#' + id, el => { const r = el.getBoundingClientRect(); return [r.width, r.height]; })
      .catch(() => { throw new Error(`Missing <section id="${id}">`); });
    if (Math.round(box[0]) !== 1080 || Math.round(box[1]) !== 1920) throw new Error(`#${id} is ${box[0]}x${box[1]}, expected 1080x1920`);
  }

  // cover.png
  let warnings = await checkMargins(page, '#cover', 0, { side: 80, bottom: 300 }, 'cover');
  await page.$eval('#stage', el => { el.style.display = 'none'; });
  await (await page.$('#cover')).screenshot({ path: path.join(outDir, 'cover.png') });
  console.log('wrote', path.join(outDir, 'cover.png'));
  await page.$eval('#cover', el => { el.style.display = 'none'; });
  await page.$eval('#stage', el => { el.style.display = ''; });

  await page.evaluate(RUNTIME);
  const duration = await page.evaluate(() => window.__duration);
  if (!(duration > 0 && duration <= 60)) throw new Error('Bad duration from .beat data-end: ' + duration);

  // safe-area check at the end of each beat (everything popped in)
  const ends = await page.$$eval('#stage .beat', bs => bs.map(b => [+b.dataset.start, +b.dataset.end]));
  for (let i = 0; i < ends.length; i++) {
    await page.evaluate(t => window.__seek(t), ends[i][1] - 0.05);
    warnings += await checkMargins(page, '#stage', 0, { side: 80, bottom: 300 }, `beat ${i + 1}`);
  }

  const out = path.join(outDir, 'reel.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exited ' + c))));
  const stage = await page.$('#stage');
  const frames = Math.round(duration * FPS);
  for (let f = 0; f < frames; f++) {
    await page.evaluate(t => window.__seek(t), f / FPS);
    const buf = await stage.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % (FPS * 5) === 0) console.log(`frame ${f}/${frames}`);
  }
  ff.stdin.end();
  await done;
  await browser.close();
  console.log(`wrote ${out} (${duration}s, ${frames} frames), ${warnings} layout warning(s)`);
})().catch(e => { console.error('RENDER FAILED:', e.message); process.exit(1); });
