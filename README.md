# GSP Overlay Tool

Browser tool for building and QA'ing HTML banners in Innovid: overlay a design comp on the banner, scrub through its GSAP timeline (`window.banner.mainTL`), and nudge frame elements into place, then copy the frame back out as ready-to-paste Innovid markup.

## Load it

**Console** – paste on the banner preview page:

```
(function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/mtutino1/GSP-overlay-tool@v3.4.0/overlay-tool.js';document.body.appendChild(s)})()
```

**Bookmarklet** – create a bookmark with this as the URL:

```
javascript:(function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/mtutino1/GSP-overlay-tool@v3.4.0/overlay-tool.js';document.body.appendChild(s)})()
```

If the preview site blocks outside scripts, paste the contents of `overlay-tool.js` into the console instead.

**Tip:** for the roomiest panel, open the banner on its own page. If pop-out is blocked inside the Innovid preview, the panel shows the banner's address to copy into a new tab.

## Using it

- **Comp:** choose an image, then set the opacity and show/hide it. It's pinned to the banner's top-left and is click-through.
- **Inspect thru link:** lets Inspect pass through the full-banner `#catch-all` clickthrough link.
- **Timeline:** scrub, step ⏪ / ⏩ 0.5s, and play/pause.
- **Layout Mode / Sheen Debug / Design Rules:** toggle the banner's own debug classes.
- **⧉** pops the panel out into its own window, which helps on small sizes like 300x50. **−** minimizes the panel and **×** closes the tool.

## Frame editor

1. Paste the frame's Contents variable (e.g. `frame4Contents`) into the box.
2. Scrub to that frame, click **Pick**, then click an element on the banner (Esc cancels). **Parent ↑** selects the element around it.
3. Nudge with the ← ↑ ↓ → buttons or the arrow keys (Shift = 10px), or edit the style box directly. Alt/Option + ↑ / ↓ on a number in the style box nudges it (decimals step by 0.01, e.g. `scale:1.14`).
4. **Copy for Innovid** copies the frame with your changes written in as inline `style=""` attributes, and paste it back into the same Contents variable.

Relative elements move with `left` / `top`; absolutely positioned ones (like `<img>`) move with margins. Nothing else in the markup changes: bare attributes like `sheen bold`, spacing, and `<script>` blocks stay exactly as typed.

Copy before reloading the preview: nudges you haven't copied are lost on reload.

### Template rules learned the hard way

- Keep everything inside the frame's wrapper (`<offer>` or `<rtb>`). Elements outside it break the sheen.
- Position with inline styles in the frame, not in `customStyles`.
- Per-frame animations go in a `<script>` as the first thing inside the wrapper, using the frame's `tl`, e.g. `tl.to('#main-logo', { duration: 0.5, y: 24, ease: 'power1.inOut' }, 0.1)`.

## Releasing a new version

1. Update `overlay-tool.js` and push.
2. Tag it, e.g. `git tag v3.5.0 && git push origin v3.5.0` (or create a release on GitHub with a new tag).
3. Change the `@v…` version to the new tag in the loader and bookmarklet above.
