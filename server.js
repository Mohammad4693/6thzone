// 6thzone — lightweight dev server (no external dependencies).
// Serves the static site from ./public and accepts contact enquiries at POST /api/contact.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || '/data';
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.jsonl');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, headers) {
  res.writeHead(status, headers);
  res.end(body);
}

function saveSubmission(entry) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(SUBMISSIONS_FILE, JSON.stringify(entry) + '\n', 'utf8');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 20 * 1024) { reject(new Error('Body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handleContact(req, res) {
  let raw;
  try { raw = await readBody(req); } catch { return send(res, 413, JSON.stringify({ ok: false, error: 'Payload too large.' }), { 'Content-Type': 'application/json' }); }
  let data;
  try { data = JSON.parse(raw || '{}'); } catch { return send(res, 400, JSON.stringify({ ok: false, error: 'Invalid request body.' }), { 'Content-Type': 'application/json' }); }

  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const entry = {
    receivedAt: new Date().toISOString(),
    name: str(data.name),
    email: str(data.email).toLowerCase(),
    company: str(data.company),
    phone: str(data.phone),
    service: str(data.service),
    description: str(data.description),
  };

  if (!entry.name) return send(res, 400, JSON.stringify({ ok: false, error: 'Please enter your name.' }), { 'Content-Type': 'application/json' });
  if (!EMAIL_RE.test(entry.email)) return send(res, 400, JSON.stringify({ ok: false, error: 'Please enter a valid work email.' }), { 'Content-Type': 'application/json' });

  try {
    saveSubmission(entry);
  } catch (err) {
    console.error('Failed to store submission:', err.message);
    return send(res, 500, JSON.stringify({ ok: false, error: 'We could not record your enquiry. Please try again.' }), { 'Content-Type': 'application/json' });
  }
  return send(res, 200, JSON.stringify({ ok: true }), { 'Content-Type': 'application/json' });
}

function serveStatic(req, res, pathname) {
  let filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });
  if (pathname === '/' || !path.extname(filePath)) filePath = path.join(filePath, 'index.html');

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    const ext = path.extname(filePath).toLowerCase();
    const cacheControl = ext === '.html' ? 'no-cache' : 'no-cache';
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': cacheControl });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === 'POST' && pathname === '/api/contact') return handleContact(req, res);
  if (pathname === '/healthz') return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });
  if (pathname === '/favicon.ico') return send(res, 204, '', {});
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain' });
  return serveStatic(req, res, pathname);
});

server.listen(PORT, '0.0.0.0', () => console.log(`6thzone dev server listening on :${PORT}`));
