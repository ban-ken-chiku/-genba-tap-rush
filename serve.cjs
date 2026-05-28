const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "0.0.0.0";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath =
    url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(root, safePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("forbidden");
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    const readablePath = !statError && stat.isDirectory() ? path.join(filePath, "index.html") : filePath;

    fs.readFile(readablePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": types[path.extname(readablePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(data);
  });
  });
});

server.listen(port, host, () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
    .map((entry) => `http://${entry.address}:${port}`);

  console.log(`Local:   http://127.0.0.1:${port}`);
  addresses.forEach((address) => console.log(`Network: ${address}`));
});
