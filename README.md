# Post Builder

Canva-style carousel generator. Turn competitor posts (screenshots, pasted text, or an Instagram URL) into ready-to-post carousels in your own template — 1080×1080 slides, editable inline, exportable as PNGs or a zip.

## Features

- **7 slide archetypes** with inline `**bold**` support (hook, stat, checklist, quote, step, CTA, etc.)
- **Claude Opus vision analysis** rewrites competitor content to a configurable reading level and target audience, compressed to per-slide character budgets
- **Input flexibility** — drag in screenshots, paste text, drop an Instagram URL, or write long-form yourself
- **Inline editor** with 2–4 column preview grid, per-slide editor, and caption + 3 hook variations
- **Export** each slide as a 1080×1080 PNG, or bundle all slides into a zip

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in ANTHROPIC_API_KEY
npm run dev
```

Open <http://localhost:3100> — you'll be redirected to `/post-builder`.

## Environment

- `ANTHROPIC_API_KEY` *(required)* — from <https://console.anthropic.com>
- `INSTAGRAM_OEMBED_TOKEN` *(optional)* — Meta app access token; without it the Instagram URL resolver falls back to public scrape, then to a "paste screenshots" prompt

## Tech stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- `@anthropic-ai/sdk` (Opus 4.7 with adaptive thinking + vision)
- `html-to-image` + `jszip` for export

## Project structure

```
src/
├── app/
│   ├── post-builder/page.tsx           # /post-builder route
│   └── api/
│       ├── post-builder/analyze/       # Claude analysis + compression
│       ├── post-builder/fetch-ig/      # Instagram URL resolver
│       └── proxy-image/                # CORS-safe image proxy
├── components/
│   ├── PostBuilder.tsx                 # top-level UI
│   ├── CarouselSlide.tsx               # 1080x1080 slide renderer
│   └── post-builder/                   # ProfileEditor, ParamsPanel, InputPanel,
│                                       # SlidePreviewGrid, SlideEditor,
│                                       # CaptionPanel, ExportBar
└── lib/
    └── post-templates.ts               # slide types + compression params
```
