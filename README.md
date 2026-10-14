# GSP Overlay Tool

Browser tool for QA'ing HTML banners: overlay a design comp on the banner and scrub through its GSAP timeline (`window.banner.mainTL`).

## Load it

**Console** – paste on the banner preview page:

```js
(function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/mtutino1/GSP-overlay-tool@v2.1.0/overlay-tool.js';document.body.appendChild(s)})()
```

**Bookmarklet** – create a bookmark with this as the URL:

```
javascript:(function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/mtutino1/GSP-overlay-tool@v2.1.0/overlay-tool.js';document.body.appendChild(s)})()
```

If the preview site blocks outside scripts, paste the contents of `overlay-tool.js` into the console instead.

## Using it

- **Comp:** choose an image, then set the opacity and show/hide it. It's pinned to the banner's top-left and is click-through.
- **Inspect thru link:** lets Inspect pass through the full-banner `#catch-all` clickthrough link.
- **Timeline:** scrub, step ⏪ / ⏩ 0.5s, and play/pause.
- **Layout helpers:** removes masks from `.in-mask` and hides the start/sheen frames.
- **⧉** pops the panel out into its own window, which helps on small sizes like 300x50. **−** minimizes the panel and **×** closes the tool.

## Releasing a new version

1. Update `overlay-tool.js` and push.
2. Tag it, e.g. `git tag v2.2.0 && git push origin v2.2.0`.
3. Change `@v2.1.0` to the new tag in the loader and bookmarklet above.
