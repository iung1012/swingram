import http from "node:http";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";

import app from "./dist/server/server.js";

const handler = app?.default ?? app;
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function buildUrl(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const forwardedHost = String(req.headers.host || `localhost:${port}`).split(",")[0].trim();
  return new URL(req.url || "/", `${forwardedProto}://${forwardedHost}`);
}

async function readBody(req) {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

const server = http.createServer(async (req, res) => {
  try {
    const body = await readBody(req);
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        headers.set(key, value.join(","));
      } else {
        headers.set(key, value);
      }
    }

    const requestInit = {
      method: req.method,
      headers,
    };

    if (body) {
      requestInit.body = body;
      requestInit.duplex = "half";
    }

    const request = new Request(buildUrl(req), requestInit);

    const response = await handler.fetch(request, undefined, undefined);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (!hopByHopHeaders.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    if (!response.body) {
      res.end();
      return;
    }

    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`Frontend server listening on http://${host}:${port}`);
});
