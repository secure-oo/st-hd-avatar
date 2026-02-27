// HD Avatar Extension for SillyTavern
// Replaces thumbnail avatars with full-resolution character images

(function () {
    'use strict';

    const MODULE_NAME = 'hd-avatar';

    /**
     * Convert a thumbnail URL to a full-resolution character image URL.
     * Thumbnail format:  /thumbnail?type=avatar&file=CharacterName.png
     * Full-res format:   /characters/CharacterName.png
     */
    function toHDSrc(src) {
        if (!src) return null;

        // Handle both absolute and relative URL forms
        let url;
        try {
            // Use URL API when possible for reliable param parsing
            const base = src.startsWith('http') ? src : `${location.origin}${src.startsWith('/') ? '' : '/'}${src}`;
            url = new URL(base);
        } catch {
            return null;
        }

        const pathname = url.pathname;

        // Match /thumbnail endpoint with type=avatar
        if (pathname.endsWith('/thumbnail') || pathname.endsWith('thumbnail')) {
            const type = url.searchParams.get('type');
            const file = url.searchParams.get('file');
            if (type === 'avatar' && file) {
                return `/characters/${file}`;
            }
        }

        // Match already-formed thumbnail paths like /thumbnails/avatar/file.jpg
        const thumbMatch = pathname.match(/\/thumbnails\/avatar\/(.+)$/);
        if (thumbMatch) {
            return `/characters/${thumbMatch[1]}`;
        }

        return null;
    }

    /**
     * Upgrade a single <img> element if it carries a thumbnail avatar src.
     */
    function upgradeImg(img) {
        // Skip if already upgraded
        if (img.dataset.hdUpgraded) return;

        const hd = toHDSrc(img.getAttribute('src'));
        if (!hd) return;

        img.dataset.hdUpgraded = '1';
        img.dataset.originalSrc = img.src;

        // Swap src; fall back silently on error
        img.addEventListener('error', () => {
            img.src = img.dataset.originalSrc;
            img.dataset.hdUpgraded = 'err';
        }, { once: true });

        img.src = hd;
    }

    /**
     * Scan the whole document for unprocessed avatar images.
     */
    function upgradeAll() {
        document.querySelectorAll('img').forEach(upgradeImg);
    }

    /**
     * Watch for dynamically added / mutated img elements (new messages, refreshes, etc.)
     */
    function startObserver() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                // New nodes added
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    if (node.tagName === 'IMG') {
                        upgradeImg(node);
                    } else {
                        node.querySelectorAll && node.querySelectorAll('img').forEach(upgradeImg);
                    }
                }
                // Attribute changes (src swapped on existing img)
                if (
                    mutation.type === 'attributes' &&
                    mutation.attributeName === 'src' &&
                    mutation.target.tagName === 'IMG'
                ) {
                    const img = mutation.target;
                    // Reset upgrade flag so we re-evaluate the new src
                    if (img.dataset.hdUpgraded && img.dataset.hdUpgraded !== 'err') {
                        delete img.dataset.hdUpgraded;
                    }
                    upgradeImg(img);
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src'],
        });
    }

    // ---------- Init ----------

    function init() {
        console.log(`[${MODULE_NAME}] HD Avatar extension loaded`);
        upgradeAll();
        startObserver();
    }

    // SillyTavern exposes jQuery; wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
