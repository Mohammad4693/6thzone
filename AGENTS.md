# 6thzone — dev environment notes

## What this is
A from-scratch static-first website (vanilla HTML/CSS/JS) with a tiny zero-dependency
Node HTTP server (`server.js`) that serves `./public` and stores contact enquiries.

## Run
```
docker compose -f docker-compose.base44.yml up -d
```
- Single `web` service: `node:22-alpine`, repo bind-mounted at `/app`, run with `node --watch server.js`.
- Port 3000 (host) → 3000 (container). Health: `GET /healthz`.
- Contact submissions are appended as JSONL to the `submissions` docker volume at `/data/submissions.jsonl` (NOT in the repo, so they never get committed).

## Structure
- `server.js` — static file serving + `POST /api/contact` (validates name/email, appends to JSONL).
- `public/index.html` — single-page site; includes the sculpture as an inline `<template>` cloned by JS into `.sculpture-slot` elements.
- `public/content.js` — central editable content object (`window.SITE_CONTENT.en`): nav, hero, zones, services, applications, steps, principles, contact copy. Add a new language as a sibling key.
- `public/main.js` — renders collections from content, sculpture cloning, zone/service interactions, opportunity-explorer modal (native `<dialog>`), contact form fetch, scroll reveals, connector activation on first scroll, parallax.
- `public/styles.css` — all styling. Tokens at `:root` (bg #F5F5F2, ink #111, accent #F36B32, dark #151515).

## Quirks
- The hero sculpture extends above the panel via an absolutely-positioned transparent SVG (no clipping seam by design). Keep `.hero-panel` `overflow: visible`; only its background layer is rounded.
- `.zones-connected` (added to the hero panel on first scroll) drives the orange connector/glow activation via CSS transitions. `.always-connected` slots (services/why sections) are permanently activated.
- No external credentials are required; no third-party API keys.
- Verify quickly: `curl localhost:3000/healthz`, `curl -X POST localhost:3000/api/contact -H 'Content-Type: application/json' -d '{"name":"t","email":"t@t.co"}'`.
