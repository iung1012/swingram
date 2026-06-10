import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const clientDir = path.resolve("dist/client");
const serverAssetsDir = path.resolve("dist/server/assets");

async function findManifest() {
  const entries = await readdir(serverAssetsDir);
  const manifest = entries.find((name) => /^_tanstack-start-manifest_.*\.js$/.test(name));
  if (!manifest) {
    throw new Error("Unable to find TanStack Start manifest in dist/server/assets");
  }
  return path.join(serverAssetsDir, manifest);
}

async function main() {
  const manifestPath = await findManifest();
  const manifest = await readFile(manifestPath, "utf8");
  const match = manifest.match(/clientEntry:\s*"([^"]+)"/);
  if (!match) {
    throw new Error("Unable to extract clientEntry from TanStack Start manifest");
  }

  const clientEntry = match[1];
  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0a0a0a" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <title>Brasa Swing — Encontros adultos</title>
  </head>
  <body>
    <script type="module" src="${clientEntry}"></script>
  </body>
</html>
`;

  await writeFile(path.join(clientDir, "index.html"), html, "utf8");
}

await main();
