# SillyTavern HD Avatar

A lightweight SillyTavern extension that replaces low-resolution thumbnail avatars with full-resolution character images.

## Why

SillyTavern serves avatars through a `/thumbnail` endpoint that downsizes images for performance. This means no matter how you style them with CSS, the underlying bitmap is already degraded. This extension intercepts those thumbnail URLs and swaps them for the original full-res files from `/characters/`.

## Install

In SillyTavern → Extensions → Install Extension, paste:

```
https://github.com/YOUR_USERNAME/st-hd-avatar
```

## How it works

- On load, scans all `<img>` elements and rewrites any `thumbnail?type=avatar` URLs to `/characters/filename`
- A `MutationObserver` watches for dynamically added images (new chat messages, character switching) and upgrades them automatically
- Falls back to the original thumbnail silently if the full-res file can't be loaded

## Notes

- No settings required, works automatically after install
- Compatible with any CSS avatar resizing/reshaping you apply on top
