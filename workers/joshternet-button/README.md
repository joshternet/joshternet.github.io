# Joshternet button Worker

Serves the one-line Joshternet membership embed on joshternet.org. After a
registry-backed state check, the embed inserts inline SVG. This Worker does
not publish downloadable button image files.

Registry membership is the only source of truth. This Worker never fetches
the supplied origin or `/.well-known/josh`.

## Production routes

Wrangler attaches these Cloudflare zone routes on deploy:

- `https://joshternet.org/embed/joshternet-button.js`
- `https://joshternet.org/api/button-state?origin=…`

The same paths are routed on `www.joshternet.org`. Docs live at
`/implement/buttons/`.

`/api/button-state` returns `ok`, `state`, `href`, `alt`, and `linkLabel`.
It does not return an image file URL. WordPress and other clients that map
`state` onto their own local artwork can keep doing that.

## Local development

```bash
npm install
npm test
npm run dev
```

From the site root, `npm run dev` starts Jekyll with LiveReload and this
Worker together. Wrangler listens on `http://127.0.0.1:8790`. Optional
`.dev.vars` can set `SITE_ORIGIN=http://127.0.0.1:4000` so link URLs point
at the local Jekyll preview instead of production.

```html
<script async src="http://127.0.0.1:8790/embed/joshternet-button.js"></script>
```

## Deploy

```bash
npm test
npm run check
npm run deploy
```
