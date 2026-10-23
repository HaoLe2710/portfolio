import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const releaseId = process.env.PORTFOLIO_RELEASE_ID?.trim();
const checksum = process.env.PORTFOLIO_RELEASE_CHECKSUM?.trim();
const commitSha = process.env.CF_PAGES_COMMIT_SHA?.trim();

if (!releaseId || !checksum || !/^[0-9a-f]{64}$/.test(checksum) || !commitSha) {
  throw new Error("The static release manifest requires release ID, SHA-256 checksum and Pages commit SHA.");
}

const filePath = resolve("out/release-manifest.json");
await mkdir(dirname(filePath), { recursive: true });
await writeFile(filePath, `${JSON.stringify({ releaseId, checksum, commitSha })}\n`, "utf8");
