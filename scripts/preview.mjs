import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { PATH_PREFIX } from "./prefix.js";

const root = path.resolve("_site");
const port = Number(process.env.PORT || 4173);
const prefix = PATH_PREFIX === "/" ? "" : PATH_PREFIX.slice(0, -1);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

function resolveFile(urlPath) {
  let pathname = decodeURIComponent(urlPath.split("?")[0]);
  if (prefix) {
    if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return null;
    pathname = pathname.slice(prefix.length) || "/";
  }
  const filePath = path.normalize(path.join(root, pathname));
  if (filePath !== root && !filePath.startsWith(root + path.sep)) return null;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    return path.join(filePath, "index.html");
  }
  return filePath;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  const filePath = resolveFile(url.pathname);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const missing = path.join(root, "404.html");
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end(fs.existsSync(missing) ? fs.readFileSync(missing) : "Not found");
    return;
  }
  const type = types[path.extname(filePath)] || "application/octet-stream";
  res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`http://127.0.0.1:${port}${PATH_PREFIX}`);
});
