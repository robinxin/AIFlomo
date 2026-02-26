const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');

const port = parseInt(process.env.PORT || '3000', 10);
const nextDir = process.env.NEXT_DIR || path.join(__dirname, '..', 'flomo');

const app = next({
  dev: false,
  dir: nextDir,
  port,
});

const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, '127.0.0.1', () => {
    console.log(`Next.js server running on http://127.0.0.1:${port}`);
    if (process.send) {
      process.send({ type: 'ready', port });
    }
  });
});
