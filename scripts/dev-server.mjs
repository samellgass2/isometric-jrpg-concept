import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 5173);
const PROJECT_ROOT = process.cwd();

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};

function resolveRequestPath(urlPathname) {
  const requestPath = urlPathname === "/" ? "/src/index.html" : urlPathname;
  const absolutePath = path.resolve(PROJECT_ROOT, `.${requestPath}`);

  if (!absolutePath.startsWith(PROJECT_ROOT)) {
    return null;
  }

  return absolutePath;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const filePath = resolveRequestPath(url.pathname);

  if (!filePath || !existsSync(filePath)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");

  try {
    const content = await readFile(filePath);
    res.statusCode = 200;
    res.end(content);
  } catch (error) {
    res.statusCode = 500;
    res.end(`Server error: ${error.message}`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Dev server running at http://${HOST}:${PORT}`);
});
