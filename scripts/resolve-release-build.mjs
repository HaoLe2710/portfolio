const branch = process.env.CF_PAGES_BRANCH?.trim() ?? "";
const commitSha = process.env.CF_PAGES_COMMIT_SHA?.trim().toLowerCase() ?? "";
const previewUrl = process.env.CF_PAGES_URL?.trim() ?? "";
const token = process.env.PORTFOLIO_BUILD_LOOKUP_TOKEN?.trim() ?? "";
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
const retries = 25;
const retryDelayMs = 1_000;
const timeoutMs = 5_000;

if (!branch || !/^[0-9a-f]{40}$/.test(commitSha) || !previewUrl || !token || !apiBase) {
  console.error("Cloudflare Pages did not provide the required staging release lookup context.");
  process.exit(1);
}

let endpoint;
try {
  const api = new URL(apiBase);
  if (api.protocol !== "https:") throw new Error("Invalid API protocol.");
  endpoint = new URL("/api/build/release-context", api.origin);
} catch {
  console.error("The staging release lookup API URL is invalid.");
  process.exit(1);
}

endpoint.searchParams.set("branch", branch);
endpoint.searchParams.set("commitSha", commitSha);
endpoint.searchParams.set("previewUrl", previewUrl);

for (let attempt = 0; attempt < retries; attempt += 1) {
  let response;
  try {
    response = await fetch(endpoint, {
      headers: { "x-portfolio-build-token": token },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    if (attempt === retries - 1) {
      console.error("The staging Worker could not be reached after retrying the release context lookup.");
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    continue;
  }

  if (response.status === 204) process.exit(3);
  if (response.status === 404) {
    if (attempt < retries - 1) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    continue;
  }
  if (response.status === 408 || response.status === 429 || response.status >= 500) {
    if (attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      continue;
    }
    console.error(`The staging Worker remained unavailable after retrying (HTTP ${response.status}).`);
    process.exit(1);
  }
  if (!response.ok) {
    console.error(`The staging Worker rejected the release context lookup (HTTP ${response.status}).`);
    process.exit(1);
  }

  const body = await response.json().catch(() => null);
  const data = body?.data;
  if (!body?.success || typeof data?.releaseId !== "string" ||
      typeof data?.checksum !== "string" || typeof data?.commitSha !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.releaseId) ||
      data.commitSha !== commitSha || !/^[0-9a-f]{64}$/.test(data.checksum)) {
    console.error("The staging Worker returned an invalid release context.");
    process.exit(1);
  }
  process.stdout.write(`${data.releaseId}\t${data.checksum}\t${data.commitSha}\n`);
  process.exit(0);
}

process.exit(3);
