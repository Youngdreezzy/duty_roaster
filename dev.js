// Local test server: serves /public and /api using the in-memory store.
// Run: npm run dev   then open http://localhost:3000
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'local-dev-secret-change-me-please';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const http = require('http');
const fs = require('fs');
const path = require('path');
const handler = require('./lib/handler');

const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    req.query = Object.fromEntries(url.searchParams);
    req.query.action = url.pathname.slice(5);
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      if (data) { try { req.body = JSON.parse(data); } catch { req.body = data; } }
      handler(req, res);
    });
    return;
  }
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!path.extname(p)) p += '.html';
  const file = path.join(PUBLIC, path.normalize(p));
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log('Roster dev server on http://localhost:' + (process.env.PORT || 3000)));
