// Tiny, dependency-free local development server. Not intended for public production hosting.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const port = Number(process.env.PORT || 5500);
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const candidate = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!candidate.startsWith(resolve(root) + sep) || candidate.includes(`${sep}.git${sep}`)) {response.writeHead(403); response.end('Forbidden');return;}
    const file = await stat(candidate);
    if (!file.isFile()) throw new Error('Not a file');
    const body = await readFile(candidate);
    response.writeHead(200, {'Content-Type':mime[extname(candidate)] || 'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
    response.end(body);
  } catch { response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}); response.end('Not found'); }
}).listen(port, '127.0.0.1',()=>console.log(`KtirioCheck available at http://localhost:${port}`));
