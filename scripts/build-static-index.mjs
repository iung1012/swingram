import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const clientDir = path.resolve("dist/client");
const serverBundlePath = path.resolve("dist/server/server.js");

async function loadServerHandler() {
  const serverModule = await import(pathToFileURL(serverBundlePath).href);
  const handler = serverModule.default;

  if (typeof handler === "function") {
    return handler;
  }

  if (handler && typeof handler.fetch === "function") {
    return (request) => handler.fetch(request);
  }

  throw new Error("Unable to resolve a request handler from dist/server/server.js");
}

async function main() {
  const handler = await loadServerHandler();
  const response = await handler(new Request("http://localhost/"));

  if (!response || typeof response.text !== "function") {
    throw new Error("Prerender handler did not return a valid Response");
  }

  const html = await response.text();

  if (!html.includes("$_TSR")) {
    throw new Error("Prerendered HTML did not include TanStack bootstrap data");
  }

  await writeFile(path.join(clientDir, "index.html"), html, "utf8");

  // Keep a lightweight copy for debugging build output if needed.
  await writeFile(path.join(clientDir, "_shell.html"), html, "utf8");
}

await main();
