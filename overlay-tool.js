// ============================================
// OverlayToolV3.4
// ============================================
// Paste into browser console while previewing a banner.
//
// COMP OVERLAY
// - Comp is pinned to the banner's top-left corner (0,0)
// - Comp is click-through -> Inspect picks the BANNER, not the comp
//
// TIMELINE (needs a GSAP timeline at window.banner.mainTL)
// - Drag the scrubber to seek; ⏪ / ⏩ step 0.5s; ▶ / ❚❚ play-pause
// - "Layout helpers" adds a "layout-mode" class to <html> (banner's CSS reacts to it)
// - "Inspect thru link" (separate, on by default) lets Inspect pass through the
//   full-banner #catch-all clickthrough link, so you can see the real elements
// - Closing the tool resumes playback
//
// FRAME EDITOR (new in 3.3) - the main way to position things
// - Paste the frame's Contents variable (e.g. frame4Contents) into the box
// - "Pick", then click an element on the banner (Esc cancels)
// - Nudge it with the ← ↑ ↓ → buttons or your arrow keys (Shift = 10px), or type in
//   its style box. Relative elements move with left/top, absolute ones with margins
// - "Copy for Innovid" copies the frame with your changes written in as inline
//   style="" attributes - the same format as hand-written frames. Paste it back into
//   the same Contents variable. Nothing else in the markup is changed
// - Copy before reloading the preview: unsaved nudges are lost on reload
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

;(function () {
    // ---------- Find the banner ----------
    // Search this window, then same-origin iframes, for banner.mainTL
    function findBannerWin(w) {
        try {
            if (w.banner && w.banner.mainTL) return w
        } catch (e) {
            return null // cross-origin frame
        }
        for (var i = 0; i < w.frames.length; i++) {
            var found = findBannerWin(w.frames[i])
            if (found) return found
        }
        return null
    }

    // Walk up to the highest same-origin parent, so the panel isn't clipped by the banner iframe
    function topAccessibleWin(w) {
        while (w !== w.top) {
            try {
                w.parent.document // throws if cross-origin
                w = w.parent
            } catch (e) {
                break
            }
        }
        return w
    }

    var win = findBannerWin(window) || window // where the banner + comp live
    var doc = win.document
    var panelWin = topAccessibleWin(win) // where the panel lives
    var panelDoc = panelWin.document
    var inBanner = panelDoc === doc

    // Remove previous copies (V2, V1, and the INK LayoutHelper) to prevent stacked tools
    ;[window, win, panelWin].forEach(function (w) {
        if (w.__overlayToolV3) w.__overlayToolV3.destroy()
        if (w.__compOverlay) w.__compOverlay.destroy()
    })
    var oldInk = doc.getElementById('INK-LayoutHelper')
    if (oldInk) oldInk.remove()

    var tl = (win.banner && win.banner.mainTL) || null

    var Z = 2147483647 // highest possible z-index
    var STEP = 0.5 // seconds per ⏪ / ⏩ click
    var POP_SIZE = { width: 220, height: 280 }

    // Inspection helpers from INK LayoutHelper
    // Click-through: the full-banner #catch-all link sits on top of everything and steals Inspect
    var CATCHALL_CSS = '#catch-all { pointer-events: none !important; }'
    var LAYOUT_MODE_CLASS = 'layout-mode' // banner's own CSS reacts to this class on <html>
    var SWAP_DEBUG_CLASS = 'swap-debug'
    var SHEEN_DEBUG_CLASS = 'sheen-debug'
    var SHOW_DEBUG_CLASS = 'show-debug'

    // ---------- Comp image ----------
    var img = doc.createElement('img')
    img.style.cssText =
        'position:fixed;top:0;left:0;opacity:0.25;pointer-events:none;display:none;' +
        'max-width:none;max-height:none;margin:0;padding:0;border:0;z-index:' +
        (Z - 1) +
        ';'
    doc.body.appendChild(img)

    // ---------- Helper stylesheet ----------
    var helperStyle = doc.createElement('style')
    ;(doc.head || doc.documentElement).appendChild(helperStyle)

    // ---------- Control panel ----------
    var btn =
        'background:none;border:0;color:#fff;cursor:pointer;font:bold 14px/1 sans-serif;padding:0 3px;'
    var row = 'display:block;margin:5px 0;cursor:pointer;'
    var tlBtn =
        'flex:1;padding:3px 0;cursor:pointer;font:12px/1 sans-serif;' +
        'background:#ddd;color:#111;border:1px solid #888;border-radius:3px;' // explicit, so banner CSS can't wash them out
    var PLAY = '▶︎' // ︎ = draw as plain text, not an emoji, so it takes the button's dark color
    var PAUSE = '❚❚'
    var look =
        'background:rgba(0,0,0,0.85);color:#fff;font:11px/1.3 monospace;' +
        'padding:4px 6px;box-sizing:border-box;text-align:left;'
    var frArea =
        'display:block;width:100%;box-sizing:border-box;margin:4px 0;' +
        (inBanner ? 'height:60px;' : 'height:110px;') +
        'background:#111;color:#fff;border:1px solid #555;border-radius:3px;' +
        'font:10px/1.4 monospace;padding:4px;resize:vertical;'
    var frStyleArea =
        'display:block;width:100%;height:44px;box-sizing:border-box;margin:4px 0;' +
        'background:#111;color:#9fe8c8;border:1px solid #555;border-radius:3px;' +
        'font:11px/1.4 monospace;padding:4px;resize:vertical;'
    var hint = 'color:#aaa;margin:6px 0 2px;'

    // Docked: top-right inside the banner, or bottom-right of the outer page (usually clear of the banner)
    var DOCK_CSS =
        'position:fixed;border-radius:6px;z-index:' +
        Z +
        ';' +
        look +
        'overflow-y:auto;' +
        (inBanner
            ? 'top:4px;right:4px;max-height:calc(100vh - 8px);'
            : 'bottom:12px;right:12px;max-height:calc(100vh - 24px);')
    var POP_CSS = look + 'background:#000;min-height:100%;'

    var panel = panelDoc.createElement('div')
    panel.style.cssText = DOCK_CSS

    panel.innerHTML = `
        <div data-el="head" style="display:flex;justify-content:space-between;align-items:center;cursor:move;touch-action:none;">
            <b data-el="title">OverlayToolV3</b>
            <span style="white-space:nowrap;">
                <button data-el="pop" title="Pop out to its own window" style="${btn}">⧉</button>
                <button data-el="min" title="Minimize" style="${btn}">−</button>
                <button data-el="close" title="Close tool" style="${btn}">×</button>
            </span>
        </div>
        <div data-el="body">
            <div data-el="popNote" style="display:none;margin-top:5px;padding:4px;border:1px solid #c90;border-radius:3px;color:#fc6;">
                Pop-out is blocked inside this preview. For a full-size panel, open the banner on its own page - copy this address into a new tab:
                <input data-el="popUrl" readonly style="display:block;width:100%;box-sizing:border-box;margin-top:4px;font:10px monospace;background:#111;color:#fff;border:1px solid #555;">
            </div>
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
                        <button data-el="play" title="Play / pause" style="${tlBtn}color:#000;font-weight:bold;">${PLAY}</button>
                        <button data-el="fwd" title="Forward ${STEP}s" style="${tlBtn}">⏩</button>
                    </div>
                    <label style="${row}"><input data-el="helpers" type="checkbox" checked> Layout Mode</label>
                    <label style="${row}"><input data-el="sheenDebug" type="checkbox"> Sheen Debug</label>
                    <label style="${row}"><input data-el="designRules" type="checkbox"> Design Rules</label>
                </div>
            </div>

            <div style="border-top:1px solid #555;margin-top:6px;padding-top:4px;">
                <b data-el="frToggle" title="Show / hide the Frame editor" style="cursor:pointer;">▾ Frame editor</b>
                <div data-el="frBox">
                    <div style="${hint}">1. Paste the frame's Contents variable:</div>
                    <textarea data-el="frSrc" spellcheck="false" placeholder="<offer exitTime=&quot;3&quot;> ... </offer>" style="${frArea}"></textarea>
                    <div style="${hint}">2. Pick an element, then nudge it:</div>
                    <div style="display:flex;gap:4px;">
                        <button data-el="frPick" title="Then click an element on the banner (Esc cancels)" style="${tlBtn}">Pick</button>
                        <button data-el="frParent" title="Select the element around this one" style="${tlBtn}">Parent ↑</button>
                    </div>
                    <div data-el="frSel" style="margin:4px 0;color:#9fe8c8;word-break:break-word;">Nothing picked</div>
                    <div style="display:flex;gap:4px;">
                        <button data-el="frL" title="Left (Shift: 10px)" style="${tlBtn}">←</button>
                        <button data-el="frU" title="Up (Shift: 10px)" style="${tlBtn}">↑</button>
                        <button data-el="frD" title="Down (Shift: 10px)" style="${tlBtn}">↓</button>
                        <button data-el="frR" title="Right (Shift: 10px)" style="${tlBtn}">→</button>
                    </div>
                    <textarea data-el="frStyle" spellcheck="false" placeholder="style of the picked element" style="${frStyleArea}"></textarea>
                    <div style="${hint}">3. Paste the result back into Innovid:</div>
                    <div style="display:flex;gap:4px;">
                        <button data-el="frCopy" title="Copy the frame with your changes" style="${tlBtn}font-weight:bold;">Copy for Innovid</button>
                        <button data-el="frUndo" title="Throw away all nudges since the last paste" style="${tlBtn}">Undo all</button>
                    </div>
                    <div data-el="frStatus" style="color:#fc6;margin-top:4px;"></div>
                </div>
            </div>
        </div>
    `
    panelDoc.body.appendChild(panel)

    // Look up elements inside OUR panel only (avoids clashing with page IDs)
    function get(name) {
        return panel.querySelector('[data-el="' + name + '"]')
    }

    // ---------- Helpers ----------
    function updateHelperCss() {
        helperStyle.textContent = get('catchall').checked ? CATCHALL_CSS : ''
        doc.documentElement.classList.toggle(
            LAYOUT_MODE_CLASS,
            !!(tl && get('helpers').checked)
        )
    }

    function updateDebugClasses() {
        var sheenDebug = get('sheenDebug').checked
        doc.documentElement.classList.toggle(SWAP_DEBUG_CLASS, sheenDebug)
        doc.documentElement.classList.toggle(SHEEN_DEBUG_CLASS, sheenDebug)
        doc.documentElement.classList.toggle(
            SHOW_DEBUG_CLASS,
            get('designRules').checked
        )
    }

    // ---------- Comp controls ----------
    get('file').addEventListener('change', function (e) {
        var file = e.target.files[0]
        if (!file) return
        var reader = new FileReader()
        reader.onload = function (ev) {
            img.src = ev.target.result
            img.style.display = 'block'
            get('show').checked = true
        }
        reader.readAsDataURL(file)
    })

    get('op').addEventListener('input', function () {
        img.style.opacity = this.value / 100
        get('opVal').textContent = this.value
    })

    get('show').addEventListener('change', function () {
        img.style.display = this.checked && img.src ? 'block' : 'none'
    })

    // ---------- Text box helpers ----------
    // Replace the selected text, keeping Ctrl/Cmd+Z undo working where the browser allows it
    function replaceSelection(ta, text) {
        var ok = false
        try {
            ok = ta.ownerDocument.execCommand('insertText', false, text) // fires "input" itself
        } catch (e) {}
        if (!ok) {
            var s = ta.selectionStart
            ta.value = ta.value.slice(0, s) + text + ta.value.slice(ta.selectionEnd)
            ta.selectionStart = ta.selectionEnd = s + text.length
            var Ev = ta.ownerDocument.defaultView.Event
            ta.dispatchEvent(new Ev('input', { bubbles: true })) // same as typing
        }
    }

    // Find the number under the cursor and add delta to it. Returns false if there isn't one.
    function nudgeNumber(ta, delta) {
        var value = ta.value
        var pos = ta.selectionStart
        var re = /-?\d*\.?\d+/g
        var m
        while ((m = re.exec(value))) {
            var start = m.index
            var end = start + m[0].length
            if (start > pos) break
            if (pos <= end) {
                var decimals = (m[0].split('.')[1] || '').length
                var step = Math.pow(10, -decimals) // 372 -> 373, 1.14 -> 1.15, .3 -> .4
                var next = (parseFloat(m[0]) + delta * step).toFixed(decimals)
                if (parseFloat(next) === 0) next = (0).toFixed(decimals) // no "-0"
                ta.setSelectionRange(start, end)
                replaceSelection(ta, next) // leaves the cursor at the end of the number
                return true
            }
        }
        return false
    }

    // Copy a textarea's contents, flashing the button's label
    function copyFrom(ta, copyBtn) {
        var label = copyBtn.textContent
        function done(ok) {
            copyBtn.textContent = ok ? 'Copied ✓' : 'Copy failed'
            setTimeout(function () {
                copyBtn.textContent = label
            }, 1200)
        }
        function fallback() {
            var ok = false
            ta.select()
            try {
                ok = ta.ownerDocument.execCommand('copy')
            } catch (e) {}
            done(ok)
        }
        var clip = ta.ownerDocument.defaultView.navigator.clipboard
        if (clip && clip.writeText) {
            clip.writeText(ta.value).then(function () {
                done(true)
            }, fallback)
        } else {
            fallback()
        }
    }

    // ---------- Frame editor ----------
    // Picks elements on the banner and writes their positioning back into the pasted
    // frame markup as inline style="" attributes. Everything else in the markup is kept
    // exactly as typed (bare attributes like "sheen bold", spacing, <img />, etc).
    var FRAME_KEY = 'overlayToolFrameSrc'
    var VOID_TAGS = { img: 1, br: 1, hr: 1, input: 1, meta: 1, link: 1, source: 1, wbr: 1 }
    var frOpen = true
    var frNodes = [] // tags found in the pasted markup, in order
    var frEdits = {} // source tag index -> style text being edited
    var frSelIdx = null // source tag index of the picked element
    var frSelEl = null // the picked element on the banner
    var frHoverEl = null
    var frPicking = false
    var frRaf = 0

    var frameStyle = doc.createElement('style') // live preview of the nudges
    frameStyle.setAttribute('data-overlay-tool', 'frame-edits')
    doc.body.appendChild(frameStyle)
    var pickStyle = doc.createElement('style')
    pickStyle.textContent = 'html.ot-picking, html.ot-picking * { cursor: crosshair !important; }'
    ;(doc.head || doc.documentElement).appendChild(pickStyle)

    function makeBox(css) {
        var b = doc.createElement('div')
        b.style.cssText =
            'position:fixed;pointer-events:none;display:none;box-sizing:border-box;z-index:' +
            (Z - 2) +
            ';' +
            css
        doc.body.appendChild(b)
        return b
    }
    var selBox = makeBox('outline:2px solid #0ff;outline-offset:1px;')
    var hovBox = makeBox('outline:2px dashed #f0f;outline-offset:1px;')

    function norm(t) {
        return (t || '').replace(/\s+/g, ' ').trim()
    }

    function frStatus(msg) {
        get('frStatus').textContent = msg || ''
    }

    // Find every opening tag in the markup, with its position and its text content
    function parseFrame(src) {
        var re = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g
        var nodes = []
        var stack = []
        var last = 0
        var m
        function addText(t) {
            for (var i = 0; i < stack.length; i++) stack[i].text += t
        }
        while ((m = re.exec(src))) {
            addText(src.slice(last, m.index).replace(/<!--[\s\S]*?-->/g, ''))
            last = re.lastIndex
            var name = m[2].toLowerCase()
            if (m[1]) {
                // closing tag: pop back to its opener
                for (var j = stack.length - 1; j >= 0; j--) {
                    if (stack[j].name === name) {
                        stack.length = j
                        break
                    }
                }
                continue
            }
            var node = { name: name, start: m.index, end: re.lastIndex, tag: m[0], text: '' }
            nodes.push(node)
            if (!m[4] && !VOID_TAGS[name]) stack.push(node)
        }
        addText(src.slice(last))
        nodes.forEach(function (n) {
            n.text = norm(n.text)
        })
        return nodes
    }

    var STYLE_ATTR = /\sstyle\s*=\s*("([^"]*)"|'([^']*)')/i

    function styleOf(node) {
        var m = STYLE_ATTR.exec(node.tag)
        return m ? (m[2] != null ? m[2] : m[3]) : ''
    }

    function withStyle(tag, style) {
        style = style.trim().replace(/"/g, "'")
        if (STYLE_ATTR.test(tag)) {
            return tag.replace(STYLE_ATTR, style ? ' style="' + style + '"' : '')
        }
        if (!style) return tag
        return tag.replace(/(\s*\/?>)$/, ' style="' + style + '"$1')
    }

    // "position:relative;top:-4px;" <-> [['position','relative'], ['top','-4px']]
    function parseDecls(s) {
        return s
            .split(';')
            .map(function (d) {
                var i = d.indexOf(':')
                return i < 0 ? null : [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()]
            })
            .filter(function (d) {
                return d && d[0] && d[1]
            })
    }

    function serializeDecls(decls) {
        return decls
            .map(function (d) {
                return d[0] + ':' + d[1] + ';'
            })
            .join('')
    }

    function findDecl(decls, prop) {
        for (var i = decls.length - 1; i >= 0; i--) if (decls[i][0] === prop) return decls[i]
        return null
    }

    // The frame wrapper (<offer>, <rtb>) an element belongs to on the banner
    function frameRoot(el) {
        return (el.closest && el.closest('offer, rtb')) || null
    }

    // Banner elements that are the same thing as el (the template may draw copies, e.g. for the sheen)
    function twinsOf(el) {
        var root = frameRoot(el)
        if (!root || el.tagName.toLowerCase() === 'img') return [el]
        var t = norm(el.textContent)
        var name = el.tagName.toLowerCase()
        var twins = Array.prototype.filter.call(root.querySelectorAll(name), function (d) {
            return d === el || norm(d.textContent) === t
        })
        if (twins.indexOf(el) < 0) twins.push(el)
        return twins
    }

    // Which tag in the pasted markup is this banner element? Matches by tag + text, then by order.
    function mapToSource(el) {
        var name = el.tagName.toLowerCase()
        var cands = frNodes.filter(function (n) {
            return n.name === name
        })
        if (!cands.length) return null
        var root = frameRoot(el)
        if (!root || el === root) return cands[0]
        var domSame = Array.prototype.slice.call(root.querySelectorAll(name))
        var t = norm(el.textContent)
        if (name !== 'img' && t) {
            var byText = cands.filter(function (n) {
                return n.text === t
            })
            if (byText.length === 1) return byText[0]
            if (byText.length > 1) {
                var sameText = domSame.filter(function (d) {
                    return norm(d.textContent) === t
                })
                return byText[Math.min(Math.max(sameText.indexOf(el), 0), byText.length - 1)]
            }
        }
        var i = domSame.indexOf(el)
        return i >= 0 && i < cands.length ? cands[i] : null
    }

    function isShowing(el) {
        var op = 1
        for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
            var cs = win.getComputedStyle(e)
            if (cs.display === 'none' || cs.visibility === 'hidden') return false
            op *= parseFloat(cs.opacity)
            if (op < 0.05) return false
        }
        return true
    }

    // Smallest visible element from the pasted markup under the pointer (ignores pointer-events,
    // so it works even when the template or the clickthrough link swallows clicks)
    function elementAt(x, y) {
        var names = {}
        frNodes.forEach(function (n) {
            if (n.name !== 'br') names[n.name] = 1
        })
        var sel = Object.keys(names).join(',')
        if (!sel) return null
        var best = null
        var bestArea = Infinity
        Array.prototype.forEach.call(doc.querySelectorAll(sel), function (el) {
            var r = el.getBoundingClientRect()
            if (x < r.left || x > r.right || y < r.top || y > r.bottom) return
            var area = r.width * r.height
            if (area >= bestArea || !frameRoot(el) || !isShowing(el)) return
            best = el
            bestArea = area
        })
        return best
    }

    function placeBox(box, el) {
        if (!el || !el.isConnected) {
            box.style.display = 'none'
            return
        }
        var r = el.getBoundingClientRect()
        box.style.display = 'block'
        box.style.left = r.left + 'px'
        box.style.top = r.top + 'px'
        box.style.width = r.width + 'px'
        box.style.height = r.height + 'px'
    }

    function frLoop() {
        placeBox(selBox, frSelEl)
        placeBox(hovBox, frPicking ? frHoverEl : null)
        frRaf = win.requestAnimationFrame(frLoop)
    }

    // Preview: apply each edited style over the element's own inline style
    function applyFrameEdits() {
        var css = ''
        Object.keys(frEdits).forEach(function (idx) {
            var node = frNodes[idx]
            if (!node) return
            var now = parseDecls(frEdits[idx])
            var was = parseDecls(styleOf(node))
            var rules = now.map(function (d) {
                return d[0] + ':' + d[1].replace(/\s*!important\s*$/i, '') + ' !important;'
            })
            was.forEach(function (d) {
                if (!findDecl(now, d[0])) rules.push(d[0] + ':unset !important;') // removed in the box
            })
            css += '[data-ot="' + idx + '"]{' + rules.join('') + '}\n'
        })
        frameStyle.textContent = css
    }

    function clearMarks() {
        Array.prototype.forEach.call(doc.querySelectorAll('[data-ot]'), function (el) {
            el.removeAttribute('data-ot')
        })
    }

    function describe(node) {
        var t = node.text.length > 34 ? node.text.slice(0, 32) + '…' : node.text
        return '<' + node.name + '>' + (t ? ' "' + t + '"' : '')
    }

    function select(el) {
        var node = el && mapToSource(el)
        if (!node) {
            frStatus("That element isn't in the pasted markup. Is the right frame pasted?")
            return
        }
        frSelIdx = frNodes.indexOf(node)
        frSelEl = el
        twinsOf(el).forEach(function (t) {
            t.setAttribute('data-ot', frSelIdx)
        })
        get('frSel').textContent = describe(node)
        get('frStyle').value = frSelIdx in frEdits ? frEdits[frSelIdx] : styleOf(node)
        frStatus('')
        panel.focus() // so the arrow keys nudge right away
    }

    // ----- Pick mode -----
    function stopEvent(e) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
    }
    function onPickMove(e) {
        frHoverEl = elementAt(e.clientX, e.clientY)
    }
    function onPickClick(e) {
        stopEvent(e)
        var el = elementAt(e.clientX, e.clientY)
        stopPick()
        if (el) select(el)
        else frStatus('Nothing from the pasted frame there - is that frame showing?')
    }
    function onPickKey(e) {
        if (e.key === 'Escape') stopPick()
    }
    var BLOCKED = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'auxclick', 'dblclick']

    function startPick() {
        if (!frNodes.length) {
            frStatus("Paste the frame's Contents variable into the box first.")
            return
        }
        frPicking = true
        doc.documentElement.classList.add('ot-picking')
        doc.addEventListener('mousemove', onPickMove, true)
        doc.addEventListener('click', onPickClick, true)
        doc.addEventListener('keydown', onPickKey, true)
        panelDoc.addEventListener('keydown', onPickKey, true)
        BLOCKED.forEach(function (t) {
            doc.addEventListener(t, stopEvent, true)
        })
        get('frPick').textContent = 'Click the banner…'
        frStatus('Click an element on the banner. Esc cancels.')
    }

    function stopPick() {
        if (!frPicking) return
        frPicking = false
        frHoverEl = null
        doc.documentElement.classList.remove('ot-picking')
        doc.removeEventListener('mousemove', onPickMove, true)
        doc.removeEventListener('click', onPickClick, true)
        doc.removeEventListener('keydown', onPickKey, true)
        panelDoc.removeEventListener('keydown', onPickKey, true)
        BLOCKED.forEach(function (t) {
            doc.removeEventListener(t, stopEvent, true)
        })
        get('frPick').textContent = 'Pick'
        frStatus('')
    }

    // ----- Nudging -----
    function bump(decls, prop, d) {
        var e = findDecl(decls, prop)
        if (!e) {
            e = [prop, '0px']
            decls.push(e)
        }
        var m = /^(-?\d*\.?\d+)(px)?$/.exec(e[1])
        if (!m) {
            frStatus("Can't nudge " + prop + ' (' + e[1] + ') - edit it in the box instead.')
            return
        }
        e[1] = Math.round(parseFloat(m[1]) + d) + 'px'
    }

    // Relative (or unpositioned) elements move with left/top; absolute ones with margins,
    // like the hand-written frames do
    function nudgeSelected(dx, dy) {
        if (frSelIdx == null) {
            frStatus('Pick an element first.')
            return
        }
        var decls = parseDecls(get('frStyle').value)
        var pos = findDecl(decls, 'position')
        var abs = pos && /absolute|fixed/.test(pos[1])
        if (!pos) decls.unshift(['position', 'relative'])
        else if (pos[1] === 'static') pos[1] = 'relative'
        if (dx) bump(decls, abs ? 'margin-left' : 'left', dx)
        if (dy) bump(decls, abs ? 'margin-top' : 'top', dy)
        get('frStyle').value = serializeDecls(decls)
        onStyleInput()
    }

    function onStyleInput() {
        if (frSelIdx == null) return
        frEdits[frSelIdx] = get('frStyle').value
        applyFrameEdits()
    }

    function frameOutput() {
        var src = get('frSrc').value
        Object.keys(frEdits)
            .map(Number)
            .sort(function (a, b) {
                return frNodes[b].start - frNodes[a].start // last first, so positions stay valid
            })
            .forEach(function (idx) {
                var n = frNodes[idx]
                src = src.slice(0, n.start) + withStyle(n.tag, frEdits[idx]) + src.slice(n.end)
            })
        return src
    }

    function saveFrame() {
        try {
            panelWin.localStorage.setItem(FRAME_KEY, get('frSrc').value)
        } catch (e) {}
    }

    function resetSelection() {
        frSelIdx = null
        frSelEl = null
        get('frSel').textContent = 'Nothing picked'
        get('frStyle').value = ''
    }

    // ----- Wiring -----
    get('frToggle').addEventListener('click', function () {
        frOpen = !frOpen
        get('frBox').style.display = frOpen ? 'block' : 'none'
        this.textContent = (frOpen ? '▾' : '▸') + ' Frame editor'
        applyMinimized()
    })

    get('frSrc').addEventListener('input', function () {
        frNodes = parseFrame(this.value)
        var had = Object.keys(frEdits).length
        frEdits = {}
        clearMarks()
        applyFrameEdits()
        resetSelection()
        saveFrame()
        frStatus(had ? 'Frame changed - unsaved nudges were cleared.' : '')
    })
    get('frSrc').addEventListener('keydown', function (e) {
        e.stopPropagation()
    })

    get('frPick').addEventListener('click', function () {
        if (frPicking) stopPick()
        else startPick()
    })

    get('frParent').addEventListener('click', function () {
        if (!frSelEl) return frStatus('Pick an element first.')
        var p = frSelEl.parentElement
        while (p && !(frameRoot(p) || p.matches('offer, rtb'))) p = null
        while (p && !mapToSource(p)) p = p.parentElement
        if (p) select(p)
        else frStatus('Already at the outermost element.')
    })

    ;[
        ['frL', -1, 0],
        ['frR', 1, 0],
        ['frU', 0, -1],
        ['frD', 0, 1],
    ].forEach(function (b) {
        get(b[0]).addEventListener('click', function (e) {
            var k = e.shiftKey ? 10 : 1
            nudgeSelected(b[1] * k, b[2] * k)
        })
    })

    // Arrow keys nudge the picked element when the panel (not a text box) has focus
    panel.tabIndex = -1
    panel.style.outline = 'none'
    panel.addEventListener('keydown', function (e) {
        var tag = e.target.tagName
        if (tag === 'TEXTAREA' || tag === 'INPUT') return
        var k = e.shiftKey ? 10 : 1
        var moves = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, -k], ArrowDown: [0, k] }
        if (moves[e.key] && frSelIdx != null) {
            e.preventDefault()
            nudgeSelected(moves[e.key][0], moves[e.key][1])
        }
    })

    get('frStyle').addEventListener('input', onStyleInput)
    get('frStyle').addEventListener('keydown', function (e) {
        e.stopPropagation()
        if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            var delta = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)
            if (nudgeNumber(this, delta)) e.preventDefault() // its "input" event updates the preview
        }
    })

    get('frCopy').addEventListener('click', function () {
        if (!frNodes.length) return frStatus("Paste the frame's Contents variable first.")
        var out = frameOutput()
        var ta = get('frSrc')
        ta.value = out // the box now holds the finished frame...
        frNodes = parseFrame(out) // ...and the nudges stay live (tag order is unchanged)
        saveFrame()
        copyFrom(ta, this)
        frStatus("Copied. Paste it into this frame's Contents variable in Innovid, then save.")
    })

    get('frUndo').addEventListener('click', function () {
        if (!Object.keys(frEdits).length) return
        frEdits = {}
        applyFrameEdits()
        if (frSelIdx != null) get('frStyle').value = styleOf(frNodes[frSelIdx])
        frStatus('Nudges undone.')
    })

    function initFrameEditor() {
        try {
            get('frSrc').value = panelWin.localStorage.getItem(FRAME_KEY) || ''
        } catch (e) {}
        frNodes = parseFrame(get('frSrc').value)
        frLoop()
    }

    function destroyFrameEditor() {
        stopPick()
        win.cancelAnimationFrame(frRaf)
        clearMarks()
        frameStyle.remove()
        pickStyle.remove()
        selBox.remove()
        hovBox.remove()
    }


    // ---------- Minimize ----------
    // A panel stuck inside a short banner starts minimized so it doesn't cover the whole ad
    var minimized = inBanner && (win.innerHeight < 300 || win.innerWidth < 300)

    function applyMinimized() {
        get('body').style.display = minimized ? 'none' : 'block'
        get('title').style.display = minimized ? 'none' : 'inline'
        panel.style.width = minimized
            ? 'auto'
            : popWin
            ? '100%'
            : frOpen
            ? '300px' // room to read code
            : '170px'
        get('min').textContent = minimized ? '+' : '−'
        get('min').title = minimized ? 'Expand' : 'Minimize'
    }

    get('min').addEventListener('click', function () {
        minimized = !minimized
        applyMinimized()
    })

    get('close').addEventListener('click', destroy)

    // ---------- Drag the panel by its title bar ----------
    // Pointer capture keeps the drag alive when the cursor passes over the banner iframe
    var head = get('head')
    var pdrag = null

    head.addEventListener('pointerdown', function (e) {
        if (popWin || e.target.tagName === 'BUTTON') return
        var r = panel.getBoundingClientRect()
        panel.style.left = r.left + 'px'
        panel.style.top = r.top + 'px'
        panel.style.right = 'auto'
        panel.style.bottom = 'auto'
        pdrag = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top }
        head.setPointerCapture(e.pointerId)
        e.preventDefault()
    })

    head.addEventListener('pointermove', function (e) {
        if (!pdrag) return
        panel.style.left = pdrag.ox + e.clientX - pdrag.sx + 'px'
        panel.style.top = pdrag.oy + e.clientY - pdrag.sy + 'px'
    })

    head.addEventListener('pointerup', function () {
        pdrag = null
    })

    // ---------- Pop out / dock ----------
    // Document Picture-in-Picture (always on top) when available, else a regular popup window
    var popWin = null
    var destroyed = false

    function popOut() {
        var pip = panelWin === panelWin.top && panelWin.documentPictureInPicture
        var req = pip
            ? pip.requestWindow(POP_SIZE)
            : Promise.resolve(
                  panelWin.open(
                      '',
                      'OverlayToolV3',
                      'popup,width=' +
                          POP_SIZE.width +
                          ',height=' +
                          POP_SIZE.height
                  )
              )

        req.then(function (w) {
            if (!w) throw new Error('popup blocked')
            popWin = w
            w.document.title = 'OverlayToolV3'
            w.document.body.style.cssText = 'margin:0;background:#000;'
            w.document.body.appendChild(panel) // moves the panel, listeners included
            panel.style.cssText = POP_CSS
            get('pop').textContent = '⇲'
            get('pop').title = 'Dock back into the page'
            applyMinimized()
            w.addEventListener('pagehide', dock) // fires when the user closes the window
        }).catch(function (err) {
            // Usually: the banner sits in a sandboxed, different-origin iframe that may not open windows.
            // Offer the banner's own address instead - opened as its own tab, the tool has room again.
            minimized = false
            applyMinimized()
            get('popNote').style.display = 'block'
            get('popUrl').value = win.location.href
            get('popUrl').focus()
            get('popUrl').select()
            console.log('OverlayToolV3: open the banner on its own page: ' + win.location.href)
            console.warn(
                'OverlayToolV3: could not pop out (' +
                    err.message +
                    '). ' +
                    'Allow popups for this site, or paste the tool into the top page instead of the banner frame.'
            )
        })
    }

    function dock() {
        if (!popWin) return
        var w = popWin
        popWin = null
        if (destroyed) return
        panelDoc.body.appendChild(panel)
        panel.style.cssText = DOCK_CSS
        get('pop').textContent = '⧉'
        get('pop').title = 'Pop out to its own window'
        applyMinimized()
        if (!w.closed) w.close()
    }

    get('pop').addEventListener('click', function () {
        if (popWin) dock()
        else popOut()
    })

    // ---------- Timeline controls ----------
    var raf = 0

    function isDone() {
        return tl.progress() >= 1
    }

    function seekTo(t) {
        tl.seek(Math.max(0, Math.min(tl.duration(), t)))
        tl.pause()
    }

    // Keep scrubber, time readout and play button in sync with the timeline
    function tick() {
        var d = tl.duration()
        var t = tl.time()
        var scrub = get('scrub')
        var label = tl.paused() || isDone() ? PLAY : PAUSE
        var time = t.toFixed(2) + ' / ' + d.toFixed(2) + 's'
        if (scrub.max != d) scrub.max = d
        if (scrub.value != t) scrub.value = t
        if (get('tlTime').textContent !== time) get('tlTime').textContent = time
        if (get('play').textContent !== label) get('play').textContent = label
        raf = win.requestAnimationFrame(tick)
    }

    if (tl) {
        get('scrub').addEventListener('input', function () {
            seekTo(parseFloat(this.value))
        })
        get('back').addEventListener('click', function () {
            seekTo(tl.time() - STEP)
        })
        get('fwd').addEventListener('click', function () {
            seekTo(tl.time() + STEP)
        })
        get('play').addEventListener('click', function () {
            if (!tl.paused() && !isDone()) {
                tl.pause()
            } else {
                if (isDone()) tl.seek(0)
                tl.play()
            }
        })
        get('helpers').addEventListener('change', updateHelperCss)
        tick()
    } else {
        get('tlBox').style.display = 'none'
        get('tlTime').textContent = 'no banner.mainTL'
    }

    get('catchall').addEventListener('change', updateHelperCss)
    updateHelperCss()
    get('sheenDebug').addEventListener('change', updateDebugClasses)
    get('designRules').addEventListener('change', updateDebugClasses)
    updateDebugClasses()

    initFrameEditor()
    applyMinimized()
    try {
        panelWin.localStorage.removeItem('overlayToolLiveCss') // leftover from 3.2 / 3.3
    } catch (e) {}

    // ---------- Exit ----------
    function destroy() {
        destroyed = true
        if (popWin) {
            var w = popWin
            dock()
            w.close()
        }
        win.cancelAnimationFrame(raf)
        img.remove()
        panel.remove()
        helperStyle.remove()
        destroyFrameEditor()
        doc.documentElement.classList.remove(
            LAYOUT_MODE_CLASS,
            SWAP_DEBUG_CLASS,
            SHEEN_DEBUG_CLASS,
            SHOW_DEBUG_CLASS
        )
        if (tl)
            tl.play() // leave the banner running, like INK LayoutHelper did
        ;[window, win, panelWin].forEach(function (w) {
            delete w.__overlayToolV3
        })
        console.log('OverlayToolV3.4 closed')
    }

    var api = { destroy: destroy }
    ;[window, win, panelWin].forEach(function (w) {
        w.__overlayToolV3 = api
    })

    console.log(
        'OverlayToolV3.4 loaded' +
            (inBanner ? '' : ' - comp in banner iframe, panel in outer page')
    )
    console.log(
        tl
            ? 'Timeline found: ' + tl.duration().toFixed(2) + 's'
            : 'No window.banner.mainTL found - comp overlay only'
    )
    if (minimized)
        console.log(
            'Small banner: panel started minimized. Click ⧉ to pop it out into its own window.'
        )
})()
