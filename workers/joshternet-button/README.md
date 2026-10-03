# Joshternet button Worker

Serves IndieWeb-style Joshternet membership buttons and the one-line embed
script on joshternet.org.

Registry membership is the only source of truth. This Worker never fetches
the supplied origin or `/.well-known/josh`.

## Production routes

Wrangler attaches these Cloudflare zone routes on deploy:

- `https://joshternet.org/embed/joshternet-button.js`
- `https://joshternet.org/api/button-state?origin=…`
- `https://joshternet.org/button?origin=…`

The same paths are routed on `www.joshternet.org`. Static button artwork stays
on GitHub Pages at `/assets/buttons/`. Docs live at `/implement/buttons/`.

## Local development

```bash
npm install
npm test
npm run dev
```

Wrangler listens on `http://127.0.0.1:8790`. Optional `.dev.vars` can set
`SITE_ORIGIN=http://127.0.0.1:4000` so image and link URLs point at the local
Jekyll preview instead of production.

```html
<script async src="http://127.0.0.1:8790/embed/joshternet-button.js"></script>
```

## Deploy

```bash
npm test
npm run deploy
```
