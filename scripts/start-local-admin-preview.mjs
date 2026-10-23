import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 8787);
const pagesPort = Number(process.env.PLAYWRIGHT_PORT ?? 8788);
const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const children = new Set();

function start(args) {
  const child = spawn(process.execPath, [wrangler, ...args], { stdio: "inherit" });
  children.add(child);
  child.once("exit", () => children.delete(child));
  child.once("error", (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
  return child;
}

function stopChildren() {
  for (const child of children) child.kill("SIGTERM");
}

process.once("SIGINT", stopChildren);
process.once("SIGTERM", stopChildren);
process.once("exit", stopChildren);

const api = start([
  "dev", "--config", "api/wrangler.toml", "--name", "web-portfolio-api-staging",
  "--ip", "127.0.0.1", "--port", String(apiPort),
]);

let apiReady = false;
for (let attempt = 0; attempt < 120; attempt += 1) {
  if (api.exitCode !== null) throw new Error("Local admin API stopped before becoming ready.");
  try {
    const response = await fetch(`http://127.0.0.1:${apiPort}/api/admin/me`);
    if (response.status === 401) {
      apiReady = true;
      break;
    }
  } catch {
    // Wrangler is still starting.
  }
  await delay(500);
}
if (!apiReady) throw new Error("Local admin API did not become ready within 60 seconds.");

const pages = start([
  "pages", "dev", "--ip", "127.0.0.1", "--port", String(pagesPort),
  "--show-interactive-dev-session=false",
]);

await new Promise((resolve) => pages.once("exit", resolve));
stopChildren();
