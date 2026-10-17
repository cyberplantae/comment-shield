export function validateEndpoint(value: string, local = false): string {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash) throw new Error("Use a server address without credentials, query, or fragment");
  if (url.protocol !== "https:" && !(local && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("Use HTTPS, or HTTP on localhost for a local service");
  return url.href.replace(/\/$/, "");
}
