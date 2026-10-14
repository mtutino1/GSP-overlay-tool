// ============================================
// OverlayToolV2.1
// ============================================
// Paste into browser console while previewing a banner.
//
// COMP OVERLAY
// - Comp is pinned to the banner's top-left corner (0,0)
// - Comp is click-through -> Inspect picks the BANNER, not the comp
//
// TIMELINE (needs a GSAP timeline at window.banner.mainTL)
// - Drag the scrubber to seek; ⏪ / ⏩ step 0.5s; ▶ / ❚❚ play-pause
// - "Layout helpers" unmasks .in-mask and hides the start/sheen frames
// - "Inspect thru link" (separate, on by default) lets Inspect pass through the
//   full-banner #catch-all clickthrough link, so you can see the real elements
// - Closing the tool resumes playback
//
// SMALL BANNERS (new in 2.1)
// - The comp goes into the banner, but the PANEL goes into the top-level page
//   when it can, so a 300x50 iframe no longer clips it
// - Drag the panel by its title bar
// - "⧉" pops the panel out into its own floating window ("⇲" or closing it docks it back)
// - If the panel has to live inside a tiny banner, it starts minimized - use "⧉"
//
// GENERAL
// - Finds the banner in this window or any same-origin iframe
//   (cross-origin iframe: pick its context in the DevTools console dropdown first)
// - "−" minimizes the panel, "×" removes the tool entirely
// - Safe to re-paste: any previous copy (incl. V1 / INK LayoutHelper) is removed first
// ============================================

(function () {
    // ---------- Find the banner ----------
    // Search this window, then same-origin iframes, for banner.mainTL
    function findBannerWin(w) {
        try {
            if (w.banner && w.banner.mainTL) return w;
        } catch (e) {
            return null; // cross-origin frame
        }
        for (var i = 0; i < w.frames.length; i++) {
            var found = findBannerWin(w.frames[i]);
            if (found) return found;
        }
        return null;
    }

    // Walk up to the highest same-origin parent, so the panel isn't clipped by the banner iframe
    function topAccessibleWin(w) {
        while (w !== w.top) {
            try {
                w.parent.document; // throws if cross-origin
                w = w.parent;
            } catch (e) {
                break;
            }
        }
        return w;
    }

    var win = findBannerWin(window) || window; // where the banner + comp live
    var doc = win.document;
    var panelWin = topAccessibleWin(win);      // where the panel lives
    var panelDoc = panelWin.document;
    var inBanner = panelDoc === doc;

    // Remove previous copies (V2, V1, and the INK LayoutHelper) to prevent stacked tools
    [window, win, panelWin].forEach(function (w) {
        if (w.__overlayToolV2) w.__overlayToolV2.destroy();
        if (w.__compOverlay) w.__compOverlay.destroy();
    });
    var oldInk = doc.getElementById('INK-LayoutHelper');
    if (oldInk) oldInk.remove();

    var tl = (win.banner && win.banner.mainTL) || null;

    var Z = 2147483647; // highest possible z-index
    var STEP = 0.5;     // seconds per ⏪ / ⏩ click
    var POP_SIZE = { width: 220, height: 280 };

    // Inspection helpers from INK LayoutHelper
    // Click-through: the full-banner #catch-all link sits on top of everything and steals Inspect
    var CATCHALL_CSS = '#catch-all { pointer-events: none !important; }';
    var HELPER_CSS =
        '.frame .inner.start, .frame .inner.sheen { display: none; }' +
        '.in-mask { -webkit-mask: none !important; mask: none !important; }';

    // ---------- Comp image ----------
    var img = doc.createElement('img');
    img.style.cssText =
        'position:fixed;top:0;left:0;opacity:0.25;pointer-events:none;display:none;' +
        'max-width:none;max-height:none;margin:0;padding:0;border:0;z-index:' + (Z - 1) + ';';
    doc.body.appendChild(img);

    // ---------- Helper stylesheet ----------
    var helperStyle = doc.createElement('style');
    (doc.head || doc.documentElement).appendChild(helperStyle);

    // ---------- Control panel ----------
    var btn = 'background:none;border:0;color:#fff;cursor:pointer;font:bold 14px/1 sans-serif;padding:0 3px;';
    var row = 'display:block;margin:5px 0;cursor:pointer;';
    var tlBtn = 'flex:1;padding:3px 0;cursor:pointer;font:12px/1 sans-serif;';
    var look = 'background:rgba(0,0,0,0.85);color:#fff;font:11px/1.3 monospace;' +
        'padding:4px 6px;box-sizing:border-box;text-align:left;';

    // Docked: top-right inside the banner, or bottom-right of the outer page (usually clear of the banner)
    var DOCK_CSS = 'position:fixed;border-radius:6px;z-index:' + Z + ';' + look +
        (inBanner ? 'top:4px;right:4px;' : 'bottom:12px;right:12px;');
    var POP_CSS = look + 'background:#000;min-height:100%;';

    var panel = panelDoc.createElement('div');
    panel.style.cssText = DOCK_CSS;

    panel.innerHTML = `
        <div data-el="head" style="display:flex;justify-content:space-between;align-items:center;cursor:move;touch-action:none;">
            <b data-el="title">OverlayToolV2</b>
            <span style="white-space:nowrap;">
                <button data-el="pop" title="Pop out to its own window" style="${btn}">⧉</button>
                <button data-el="min" title="Minimize" style="${btn}">−</button>
                <button data-el="close" title="Close tool" style="${btn}">×</button>
            </span>
        </div>
        <div data-el="body">
            <input data-el="file" type="file" accept="image/*" style="width:100%;font-size:10px;margin-top:5px;">
            <label style="${row}">Opacity <span data-el="opVal">25</span>%
                <input data-el="op" type="range" min="0" max="100" value="25" style="width:100%;">
            </label>
            <label style="${row}"><input data-el="show" type="checkbox" checked> Show comp</label>
            <label style="${row}" title="Lets Inspect pass through the full-banner #catch-all link"><input data-el="catchall" type="checkbox" checked> Inspect thru link</label>

            <div style="border-top:1px solid #555;margin-top:6px;padding-top:4px;">
                <div style="display:flex;justify-content:space-between;">
                    <b>Timeline</b><span data-el="tlTime" style="color:#aaa;">–</span>
                </div>
                <div data-el="tlBox">
                    <input data-el="scrub" type="range" min="0" max="0" step="0.01" value="0" style="width:100%;">
                    <div style="display:flex;gap:4px;">
                        <button data-el="back" title="Back ${STEP}s" style="${tlBtn}">⏪</button>
                        <button data-el="play" title="Play / pause" style="${tlBtn}">▶</button>
                        <button data-el="fwd" title="Forward ${STEP}s" style="${tlBtn}">⏩</button>
                    </div>
                    <label style="${row}"><input data-el="helpers" type="checkbox" checked> Layout helpers</label>
                </div>
            </div>
        </div>
    `;
    panelDoc.body.appendChild(panel);

    // Look up elements inside OUR panel only (avoids clashing with page IDs)
    function get(name) { return panel.querySelector('[data-el="' + name + '"]'); }

    // ---------- Helpers ----------
    // Both toggles share one <style>; rebuild it from the two checkboxes
    function updateHelperCss() {
        helperStyle.textContent =
            (get('catchall').checked ? CATCHALL_CSS : '') +
            (tl && get('helpers').checked ? HELPER_CSS : '');
    }

    // ---------- Comp controls ----------
    get('file').addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
            img.src = ev.target.result;
            img.style.display = 'block';
            get('show').checked = true;
        };
        reader.readAsDataURL(file);
    });

    get('op').addEventListener('input', function () {
        img.style.opacity = this.value / 100;
        get('opVal').textContent = this.value;
    });

    get('show').addEventListener('change', function () {
        img.style.display = this.checked && img.src ? 'block' : 'none';
    });

    // ---------- Minimize ----------
    // A panel stuck inside a short banner starts minimized so it doesn't cover the whole ad
    var minimized = inBanner && (win.innerHeight < 300 || win.innerWidth < 300);

    function applyMinimized() {
        get('body').style.display = minimized ? 'none' : 'block';
        get('title').style.display = minimized ? 'none' : 'inline';
        panel.style.width = minimized ? 'auto' : (popWin ? '100%' : '170px');
        get('min').textContent = minimized ? '+' : '−';
        get('min').title = minimized ? 'Expand' : 'Minimize';
    }

    get('min').addEventListener('click', function () {
        minimized = !minimized;
        applyMinimized();
    });

    get('close').addEventListener('click', destroy);

    // ---------- Drag the panel by its title bar ----------
    // Pointer capture keeps the drag alive when the cursor passes over the banner iframe
    var head = get('head');
    var pdrag = null;

    head.addEventListener('pointerdown', function (e) {
        if (popWin || e.target.tagName === 'BUTTON') return;
        var r = panel.getBoundingClientRect();
        panel.style.left = r.left + 'px';
        panel.style.top = r.top + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        pdrag = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top };
        head.setPointerCapture(e.pointerId);
        e.preventDefault();
    });

    head.addEventListener('pointermove', function (e) {
        if (!pdrag) return;
        panel.style.left = (pdrag.ox + e.clientX - pdrag.sx) + 'px';
        panel.style.top = (pdrag.oy + e.clientY - pdrag.sy) + 'px';
    });

    head.addEventListener('pointerup', function () { pdrag = null; });

    // ---------- Pop out / dock ----------
    // Document Picture-in-Picture (always on top) when available, else a regular popup window
    var popWin = null;
    var destroyed = false;

    function popOut() {
        var pip = panelWin === panelWin.top && panelWin.documentPictureInPicture;
        var req = pip
            ? pip.requestWindow(POP_SIZE)
            : Promise.resolve(panelWin.open('', 'OverlayToolV2',
                'popup,width=' + POP_SIZE.width + ',height=' + POP_SIZE.height));

        req.then(function (w) {
            if (!w) throw new Error('popup blocked');
            popWin = w;
            w.document.title = 'OverlayToolV2';
            w.document.body.style.cssText = 'margin:0;background:#000;';
            w.document.body.appendChild(panel); // moves the panel, listeners included
            panel.style.cssText = POP_CSS;
            get('pop').textContent = '⇲';
            get('pop').title = 'Dock back into the page';
            applyMinimized();
            w.addEventListener('pagehide', dock); // fires when the user closes the window
        }).catch(function (err) {
            console.warn('OverlayToolV2: could not pop out (' + err.message + '). ' +
                'Allow popups for this site, or paste the tool into the top page instead of the banner frame.');
        });
    }

    function dock() {
        if (!popWin) return;
        var w = popWin;
        popWin = null;
        if (destroyed) return;
        panelDoc.body.appendChild(panel);
        panel.style.cssText = DOCK_CSS;
        get('pop').textContent = '⧉';
        get('pop').title = 'Pop out to its own window';
        applyMinimized();
        if (!w.closed) w.close();
    }

    get('pop').addEventListener('click', function () {
        if (popWin) dock();
        else popOut();
    });

    // ---------- Timeline controls ----------
    var raf = 0;

    function isDone() { return tl.progress() >= 1; }

    function seekTo(t) {
        tl.seek(Math.max(0, Math.min(tl.duration(), t)));
        tl.pause();
    }

    // Keep scrubber, time readout and play button in sync with the timeline
    function tick() {
        var d = tl.duration();
        var t = tl.time();
        var scrub = get('scrub');
        var label = (tl.paused() || isDone()) ? '▶' : '❚❚';
        var time = t.toFixed(2) + ' / ' + d.toFixed(2) + 's';
        if (scrub.max != d) scrub.max = d;
        if (scrub.value != t) scrub.value = t;
        if (get('tlTime').textContent !== time) get('tlTime').textContent = time;
        if (get('play').textContent !== label) get('play').textContent = label;
        raf = win.requestAnimationFrame(tick);
    }

    if (tl) {
        get('scrub').addEventListener('input', function () { seekTo(parseFloat(this.value)); });
        get('back').addEventListener('click', function () { seekTo(tl.time() - STEP); });
        get('fwd').addEventListener('click', function () { seekTo(tl.time() + STEP); });
        get('play').addEventListener('click', function () {
            if (!tl.paused() && !isDone()) {
                tl.pause();
            } else {
                if (isDone()) tl.seek(0);
                tl.play();
            }
        });
        get('helpers').addEventListener('change', updateHelperCss);
        tick();
    } else {
        get('tlBox').style.display = 'none';
        get('tlTime').textContent = 'no banner.mainTL';
    }

    get('catchall').addEventListener('change', updateHelperCss);
    updateHelperCss();
    applyMinimized();

    // ---------- Exit ----------
    function destroy() {
        destroyed = true;
        if (popWin) {
            var w = popWin;
            dock();
            w.close();
        }
        win.cancelAnimationFrame(raf);
        img.remove();
        panel.remove();
        helperStyle.remove();
        if (tl) tl.play(); // leave the banner running, like INK LayoutHelper did
        [window, win, panelWin].forEach(function (w) { delete w.__overlayToolV2; });
        console.log('OverlayToolV2.1 closed');
    }

    var api = { destroy: destroy };
    [window, win, panelWin].forEach(function (w) { w.__overlayToolV2 = api; });

    console.log('OverlayToolV2.1 loaded' +
        (inBanner ? '' : ' - comp in banner iframe, panel in outer page'));
    console.log(tl
        ? 'Timeline found: ' + tl.duration().toFixed(2) + 's'
        : 'No window.banner.mainTL found - comp overlay only');
    if (minimized) console.log('Small banner: panel started minimized. Click ⧉ to pop it out into its own window.');
})();
