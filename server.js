const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 5177);
const host = "127.0.0.1";
let currentState = null;
const clients = new Set();
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function broadcastState() {
  const payload = `data: ${JSON.stringify({ ...(currentState || {}), serverNow: Date.now() })}\n\n`;

  for (const client of clients) {
    client.write(payload);
  }
}

function readRequestBody(request, callback) {
  let body = "";

  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > 8_000_000) {
      request.destroy();
    }
  });

  request.on("end", () => callback(body));
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);

  if (url.pathname === "/state" && request.method === "GET") {
    sendJson(response, 200, { ...(currentState || {}), serverNow: Date.now() });
    return;
  }

  if (url.pathname === "/state" && request.method === "POST") {
    readRequestBody(request, (body) => {
      try {
        currentState = { ...JSON.parse(body || "{}"), serverSavedAt: Date.now() };
        delete currentState.serverNow;
        broadcastState();
        sendJson(response, 200, { ok: true });
      } catch (error) {
        sendJson(response, 400, { ok: false, error: "Invalid JSON" });
      }
    });
    return;
  }

  if (url.pathname === "/events") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });
    response.write(`data: ${JSON.stringify(currentState || {})}\n\n`);
    clients.add(response);
    request.on("close", () => clients.delete(response));
    return;
  }

  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/") {
    pathname = "/index.html";
  }

  const filePath = path.normalize(path.join(root, pathname));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Painel: http://${host}:${port}/`);
  console.log(`Overlay OBS: http://${host}:${port}/overlay.html`);
});
