#!/usr/bin/env bash
# 启动 context_management 剥离代理，将请求转发到 UPSTREAM_API_URL
# 监听 127.0.0.1:18080，调用方通过 ANTHROPIC_BASE_URL=http://127.0.0.1:18080 使用
set -euo pipefail

: "${UPSTREAM_API_URL:?UPSTREAM_API_URL is required}"

cat > /tmp/strip-proxy.js << 'EOF'
const http = require('http'), https = require('https');
const up = new URL(process.env.UPSTREAM_API_URL);
http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    try { const d = JSON.parse(body); delete d.context_management; body = JSON.stringify(d); } catch(e) {}
    const opts = {
      hostname: up.hostname, port: 443,
      path: up.pathname + (req.url === '/' ? '' : req.url),
      method: req.method,
      headers: { ...req.headers, host: up.hostname, 'content-length': Buffer.byteLength(body) }
    };
    const r = https.request(opts, pr => { res.writeHead(pr.statusCode, pr.headers); pr.pipe(res); });
    r.on('error', e => { res.writeHead(502); res.end(e.message); });
    r.write(body); r.end();
  });
}).listen(18080, '127.0.0.1', () => console.log('Proxy ready on :18080'));
EOF

node /tmp/strip-proxy.js &
sleep 2
