export function resolveApiBaseUrl() {
  const browserBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const serverBase = typeof process !== "undefined" ? process.env.API_BASE_URL : undefined;

  if (typeof window !== "undefined") {
    return browserBase || "http://127.0.0.1:5005";
  }

  return serverBase || browserBase || "http://127.0.0.1:5005";
}

export function apiUrl(path: string) {
  const base = resolveApiBaseUrl();
  if (!base) return path;
  if (base.startsWith("/")) {
    return path.startsWith(base) ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }
  return new URL(path, base).toString();
}
