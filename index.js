// HD Avatar Extension for SillyTavern
// Replaces thumbnail avatars with full-resolution images — lazy loaded

(function () {
    'use strict';

    const MODULE_NAME = 'hd-avatar';

    // ── Config ───────────────────────────────────────────────────────────────
    // Only upgrade images whose rendered size is at least this many px
    const MIN_DISPLAY_SIZE = 32; // px
    // Start loading slightly before the image enters the viewport
    const ROOT_MARGIN = '100px';
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Convert a thumbnail URL → full-resolution URL.
     *
     * Character:  /thumbnail?type=avatar&file=Name.png  → /characters/Name.png
     * Persona:    /thumbnail?type=persona&file=Name.png → /User Avatars/Name.png
     */
    function toHDSrc(src) {
        if (!src) return null;
        let url;
        try {
            const base = src.startsWith('http')
                ? src
                : `${location.origin}${src.startsWith('/') ? '' : '/'}${src}`;
            url = new URL(base);
        } catch {
            return null;
        }

        const p = url.pathname;

        if (p.endsWith('/thumbnail') || p.endsWith('thumbnail')) {
            const type = url.searchParams.get('type');
            const file = url.searchParams.get('file');
            if (!file) return null;
            if (type === 'persona') return `/User Avatars/${file}`;
            if (type === 'avatar')  return `/characters/${file}`;
        }

        const avatarMatch = p.match(/\/thumbnails\/avatar\/(.+)$/);
        if (avatarMatch)  return `/characters/${avatarMatch[1]}`;

        const personaMatch = p.match(/\/thumbnails\/persona\/(.+)$/);
        if (personaMatch) return `/User Avatars/${personaMatch[1]}`;

        return null;
    }

    /**
     * Check whether an img is large enough to be worth upgrading.
     */
    function isBigEnough(img) {
        const w = img.offsetWidth  || img.clientWidth  || img.naturalWidth  || 0;
        const h = img.offsetHeight || img.clientHeight || img.naturalHeight || 0;
        return w >= MIN_DISPLAY_SIZE || h >= MIN_DISPLAY_SIZE;
    }

    /**
     * Actually swap the src.
     * Tries /characters/ first → /User Avatars/ → original thumbnail (silent fallback).
     */
    function swapSrc(img) {
        const original = img.dataset.originalSrc || img.getAttribute('src');
        const hd       = toHDSrc(original);
        if (!hd) return;

        let retried = false;

        function onError() {
            if (!retried && hd.includes('/characters/')) {
                retried = true;
                const filename = hd.split('/characters/')[1];
                img.addEventListener('error', () => {
                    img.src = original;
                    img.dataset.hdUpgraded = 'err';
                }, { once: true });
                img.src = `/User Avatars/${filename}`;
            } else {
                img.src = original;
                img.dataset.hdUpgraded = 'err';
            }
        }

        img.addEventListener('error', onError, { once: true });
        img.dataset.hdUpgraded  = '1';
        img.dataset.originalSrc = original;
        img.src = hd;
    }

    // ── Lazy loading via IntersectionObserver ─────────────────────────────────

    const ioSupported = typeof IntersectionObserver !== 'undefined';
    let lazyObserver;

    if (ioSupported) {
        lazyObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const img = entry.target;
                lazyObserver.unobserve(img);
                if (isBigEnough(img)) swapSrc(img);
            }
        }, { rootMargin: ROOT_MARGIN });
    }

    /**
     * Register an img for lazy upgrading.
     */
    function scheduleUpgrade(img) {
        if (img.dataset.hdUpgraded) return;
        if (!toHDSrc(img.getAttribute('src'))) return;

        img.dataset.hdUpgraded = 'queued';

        if (ioSupported) {
            lazyObserver.observe(img);
        } else {
            // Fallback for browsers without IntersectionObserver
            if (isBigEnough(img)) swapSrc(img);
        }
    }

    function scheduleAll() {
        document.querySelectorAll('img').forEach(scheduleUpgrade);
    }

    // ── MutationObserver — watch for dynamically added images ─────────────────

    function startMutationObserver() {
        const mo = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    if (node.tagName === 'IMG') {
                        scheduleUpgrade(node);
                    } else {
                        node.querySelectorAll?.('img').forEach(scheduleUpgrade);
                    }
                }

                // src attribute changed on an existing img (e.g. character switch)
                if (
                    mutation.type === 'attributes' &&
                    mutation.attributeName === 'src' &&
                    mutation.target.tagName === 'IMG'
                ) {
                    const img = mutation.target;
                    if (img.dataset.hdUpgraded && img.dataset.hdUpgraded !== 'err') {
                        delete img.dataset.hdUpgraded;
                        if (ioSupported) lazyObserver.unobserve(img);
                    }
                    scheduleUpgrade(img);
                }
            }
        });

        mo.observe(document.body, {
            childList:       true,
            subtree:         true,
            attributes:      true,
            attributeFilter: ['src'],
        });
    }

    // ── Init ──────────────────────────────────────────────────────────────────

    function init() {
        console.log(`[${MODULE_NAME}] HD Avatar (lazy) loaded`);
        scheduleAll();
        startMutationObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
