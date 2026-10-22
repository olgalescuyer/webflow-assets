# Webflow Stickers

Sticker animations and a Halloween spider for a Webflow site, served as two static files from Vercel.

- `stickers.css` – styles
- `stickers.js` – behaviour
- `index.html` – blank page (Vercel needs something at `/`)

No build step. Deploy the repo to Vercel as a plain static project (Framework preset: **Other**).

## Add to Webflow

Site settings → Custom code → **Head code**, replace `YOUR-PROJECT` with your Vercel domain:

```html
<link rel="stylesheet" href="https://YOUR-PROJECT.vercel.app/stickers.css">
<script src="https://YOUR-PROJECT.vercel.app/stickers.js" defer></script>
```

Remove any old pasted sticker/spider snippets first. Publish.

To turn the spider off (e.g. after Halloween), add `data-spider="false"` to the script tag.

## Stickers

Select a sticker (an Image, or a Div wrapping one) → Settings → Custom attributes:

| Attribute | Example | What it does |
|---|---|---|
| `data-sticker` | `true` | Required. Turns the sticker on. |
| `data-sticker-delay` | `500` | ms to wait before popping in. |
| `data-sticker-float` | `3.5` | Seconds per float swing (default 4). |
| `data-sticker-rotate` | `-10` | Resting tilt in degrees. |
| `data-sticker-burst` | `18` | Copies that fly up on click. `0` turns it off. |
| `data-sticker-burst-src` | image URL | Fly a different image on click. |

Stickers pop in when their `<section>` scrolls into view. Add `data-sticker-trigger` to any wrapper to use that instead.
Don't put a Webflow Interaction on the same element.

## Spider

Appears after scrolling past the first screen (100vh), desktop only (992px+ with a mouse).
Tweak it in `stickers.js` (`SPIDER` settings) and `stickers.css` (`.tb-spider`: `--spider-size`, `right`).
# webflow-assets
