// Sirve la compilación de producción (adaptador de Vercel) en local, porque
// `astro preview` no funciona con ese adaptador. Se usa para e2e y Lighthouse.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.vercel/output');
const port = Number(process.env.PORT ?? 4400);
const entry = path.join(out, 'functions/_render.func/apps/catalog/dist/server/entry.mjs');
const { default: handler } = await import(pathToFileURL(entry).href);

const types = { '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };

http
  .createServer((req, res) => {
    const file = path.join(out, 'static', decodeURIComponent((req.url ?? '/').split('?')[0]));
    if (req.url !== '/' && file.startsWith(path.join(out, 'static')) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, {
        'content-type': types[path.extname(file)] ?? 'application/octet-stream',
        'cache-control': 'public, max-age=31536000, immutable',
      });
      return fs.createReadStream(file).pipe(res);
    }
    handler(req, res);
  })
  .listen(port, () => console.log(`http://localhost:${port}`));
