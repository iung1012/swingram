import { readFile, writeFile, readdir, stat } from "node:fs/promises";
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
  let clientEntry;

  try {
    const manifestPath = await findManifest();
    const manifest = await readFile(manifestPath, "utf8");
    const match =
      manifest.match(/clientEntry\s*:\s*["']([^"']+)["']/) ??
      manifest.match(/clientEntry\s*:\s*`([^`]+)`/);
    if (match) {
      clientEntry = match[1];
    }
  } catch {
    // Fall through to the asset-based fallback below.
  }

  if (!clientEntry) {
    const assetsDir = path.join(clientDir, "assets");
    const entries = await readdir(assetsDir, { withFileTypes: true });
    const indexBundles = entries.filter((entry) => entry.isFile() && /^index-.*\.js$/.test(entry.name));
    if (indexBundles.length === 0) {
      throw new Error("Unable to locate the client entry bundle");
    }

    const candidates = await Promise.all(
      indexBundles.map(async (entry) => {
        const fullPath = path.join(assetsDir, entry.name);
        const info = await stat(fullPath);
        return { name: entry.name, size: info.size };
      }),
    );

    candidates.sort((a, b) => b.size - a.size);
    clientEntry = `/assets/${candidates[0].name}`;
  }

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
