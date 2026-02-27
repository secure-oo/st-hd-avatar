// HD Avatar Extension for SillyTavern
// Replaces thumbnail avatars with full-resolution character images

(function () {
    'use strict';

    const MODULE_NAME = 'hd-avatar';

    /**
     * Convert a thumbnail URL to a full-resolution image URL.
     *
     * Character avatar:  /thumbnail?type=avatar&file=CharacterName.png
     *   → /characters/CharacterName.png
     *
     * User persona:      /thumbnail?type=avatar&file=PersonaName.png  (stored in User Avatars)
     *   ST also uses:    /thumbnail?type=persona&file=PersonaName.png
     *   → /User Avatars/PersonaName.png
     */
    function toHDSrc(src) {
        if (!src) return null;

        // Handle both absolute and relative URL forms
        let url;
        try {
            const base = src.startsWith('http') ? src : `${location.origin}${src.startsWith('/') ? '' : '/'}${src}`;
            url = new URL(base);
        } catch {
            return null;
        }

        const pathname = url.pathname;

        if (pathname.endsWith('/thumbnail') || pathname.endsWith('thumbnail')) {
            const type = url.searchParams.get('type');
            const file = url.searchParams.get('file');

            if (!file) return null;

            // User persona thumbnails
            if (type === 'persona') {
                return `/User Avatars/${file}`;
            }

            // Character avatars
            if (type === 'avatar') {
                // ST stores user persona files in "User Avatars/" folder.
                // Heuristic: if the filename starts with "user" or lives in a
                // known persona path we route to User Avatars, otherwise characters.
                // The cleanest approach: try characters first (fallback handles errors).
                return `/characters/${file}`;
            }
        }

        // Match already-formed thumbnail paths like /thumbnails/avatar/file.jpg
        const thumbMatch = pathname.match(/\/thumbnails\/avatar\/(.+)$/);
        if (thumbMatch) {
            return `/characters/${thumbMatch[1]}`;
        }

        // Match /thumbnails/persona/file
        const personaMatch = pathname.match(/\/thumbnails\/persona\/(.+)$/);
        if (personaMatch) {
            return `/User Avatars/${personaMatch[1]}`;
        }

        return null;
    }

    /**
     * For user persona images that fail from /characters/, retry from /User Avatars/.
     */
    function addPersonaFallback(img, originalSrc) {
        img.addEventListener('error', () => {
            // Already tried User Avatars or not a characters path — give up
            if (img.dataset.hdUpgraded === 'err' || !img.src.includes('/characters/')) {
                img.src = originalSrc;
                img.dataset.hdUpgraded = 'err';
                return;
            }
            // Retry with User Avatars path
            const filename = img.src.split('/characters/')[1];
            img.dataset.hdUpgraded = 'retry';
            img.addEventListener('error', () => {
                img.src = originalSrc;
                img.dataset.hdUpgraded = 'err';
            }, { once: true });
            img.src = `/User Avatars/${filename}`;
        }, { once: true });
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

        // Fallback: /characters/ fail → retry /User Avatars/ → original thumbnail
        addPersonaFallback(img, img.src);

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
