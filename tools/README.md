# Render tools

These scripts turn source HTML (written in `build/`, which is git-ignored) into the files that get posted.
They need Node, Playwright with Chromium, and ffmpeg. All three are pre-installed in the cloud routine environment.
The brand fonts load from Google Fonts. If they fail to load, the render stops with `RENDER FAILED`
instead of producing off-brand images.

## Posts → PNG

```
node tools/render-post.js build/YYYY-MM-DD-post/slides.html content/YYYY-MM-DD-post
```

- Every `<section class="slide">` must be exactly **1080×1350**. Output: `slide-01.png`, `slide-02.png`, …
- It prints a `WARNING` for any text that crosses the 80px side margins. Aim for 0 warnings.
- Elements inside `.wave` or `[data-bleed]` are ignored by the margin check (use these for decorative full-bleed parts).
- A good starting point is a past post's source pattern: `.slide` frames with `.brand`, `.count`, `.wave`, chips, cards.

## Reels → MP4 + cover PNG

```
node tools/render-reel.js build/YYYY-MM-DD-reel/reel.html content/YYYY-MM-DD-reel
```

Output: `reel.mp4` (1080×1920, 30 fps, H.264 yuv420p, silent AAC track, faststart) and `cover.png` (1080×1920).
A 30-second reel takes about 1–2 minutes to render.

### Source structure

```html
<section id="cover" class="frame"> … static cover design … </section>

<section id="stage" class="frame">
  <!-- anything directly inside #stage (not in a .beat) stays on screen the whole video -->
  <div class="brand"><!-- paste brand/logo-dark.svg here (inline, unchanged except width/height) --></div>
  <div class="ep">EP. 02</div>

  <div class="beat" data-start="0" data-end="2.4"> … beat 1 … </div>
  <div class="beat" data-start="2.4" data-end="5.4"> … beat 2 … </div>
  …
  <div class="wave live"></div>   <!-- .live = the waveform bars move -->
</section>
```

Both `#cover` and `#stage` must be exactly 1080×1920 (`position: relative; overflow: hidden`).
Give `.beat` `position: absolute; inset: 0` and its own padding (top ≥ 200px, sides 80px, bottom 300px).
The video length is the largest `data-end`. Beats must not overlap. Each beat fades in over 0.12s.

### Animation attributes (inside a beat; all times are seconds from the beat's start)

| Attribute | Effect |
|-----------|--------|
| `data-in="0.6"` | element pops in (fade + slide up) at 0.6s |
| `data-out="2.0"` | element fades out at 2.0s |
| `data-type data-at="0.2-3.4"` | text appears word by word between 0.2s and 3.4s (inner spans such as `.hl` keep their style) |
| `data-timer="64-68" data-at="0-2.4"` | text counts as m:ss from 1:04 to 1:08 (values in seconds) |
| `data-bar="25-53" data-at="0-4"` | element width animates from 25% to 53% (use on the inner `<span>` of a progress bar) |

Anything else custom: define `window.onFrame = function (t) { … }` (t = seconds from the start of the video).
Don't use CSS animations or transitions, because frames are captured by seeking time, not in real time.

### Checks

The script warns about text outside the 80px side margins or inside the bottom 300px (Instagram UI), checked on the
cover and at the end of every beat. Aim for 0 warnings. Then pull a few frames to look at:

```
ffmpeg -i content/…/reel.mp4 -vf "select='eq(n\,60)+eq(n\,300)+eq(n\,600)',scale=360:-1,tile=3x1" -frames:v 1 check.png
```
