// Bounded, loopback-only test of the built site. Never targets production.
import { preview } from "vite";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

const server = await preview({ preview: { host: "127.0.0.1", port: 0, open: false } });
const base = server.resolvedUrls.local[0];
const html = readFileSync("dist/index.html", "utf8");
const paths = ["", ...[...html.matchAll(/(?:src|href)="(\.\/assets\/[^" ]+\.(?:js|css|woff2))"/g)].map(m => m[1]), "media/hero-poster-800.avif", "media/hero-video-mobile.mp4"];
const reports = [];
try {
  for (const concurrency of [1, 10, 50]) {
    const latencies = [];
    const failures = [];
    let bytes = 0;
    let next = 0;
    const start = performance.now();
    const deadline = start + 10000;
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (performance.now() < deadline) {
        const i = next++;
        const path = paths[i % paths.length];
        const at = performance.now();
        try {
          const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10000) });
          const body = await response.arrayBuffer();
          if (!response.ok || !body.byteLength) throw new Error(`HTTP ${response.status}`);
          bytes += body.byteLength;
        } catch (error) { failures.push({ path, error: String(error) }); }
        latencies.push(performance.now() - at);
      }
    }));
    const elapsed = performance.now() - start;
    const count = latencies.length;
    latencies.sort((a, b) => a - b);
    reports.push({ concurrency, requests: count, errors: failures.length, failures, bytes, elapsedMs: Math.round(elapsed), requestsPerSecond: +(count / elapsed * 1000).toFixed(1), p95Ms: +latencies[Math.ceil(count * .95) - 1].toFixed(1), maxMs: +latencies.at(-1).toFixed(1) });
  }
  mkdirSync("docs/verification", { recursive: true });
  writeFileSync("docs/verification/load-test.json", JSON.stringify({ scope: "Local Vite preview; decoded response bytes; no CDN capacity claim", reports }, null, 2) + "\n");
  console.log(JSON.stringify(reports, null, 2));
  if (reports.some(r => r.errors)) process.exitCode = 1;
} finally { await server.close(); }
