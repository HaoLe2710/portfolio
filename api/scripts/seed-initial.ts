import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeedSql } from "../src/seed-data";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(SCRIPT_DIR, "../../src/data/mock-portfolio.ts");
const OUTPUT_DIR = resolve(SCRIPT_DIR, "../.seed");

async function main() {
  const args = process.argv.slice(2);
  const isRemote = args.includes("--remote");
  const isLocal = args.includes("--local");
  const isStaging = args.includes("--staging");
  if (isRemote === isLocal) {
    throw new Error("Pass exactly one target flag: --local or --remote.");
  }
  if (isStaging && (!isRemote || !args.includes("--confirm-staging"))) {
    throw new Error("Staging seed requires: --remote --staging --confirm-staging.");
  }
  if (!isStaging && isRemote) {
    const confirmIndex = args.indexOf("--confirm");
    if (confirmIndex < 0 || args[confirmIndex + 1] !== "portfolio_db") {
      throw new Error("Production seed requires the exact confirmation: --confirm portfolio_db.");
    }
  }

  const source = await readFile(SOURCE_FILE);
  const sourceHash = createHash("sha256").update(source).digest("hex");
  const { sql, importedCounts } = buildSeedSql(sourceHash);
  await mkdir(OUTPUT_DIR, { recursive: true });
  const sqlPath = resolve(OUTPUT_DIR, "initial-seed.sql");
  await writeFile(sqlPath, sql, "utf8");

  const database = isStaging ? "portfolio_db_staging" : "portfolio_db";
  const wranglerArgs = ["exec", "wrangler", "d1", "execute", database];
  if (isStaging) wranglerArgs.push("--config", "wrangler.staging.toml");
  wranglerArgs.push(isRemote ? "--remote" : "--local", `--file=${sqlPath}`);
  const run = spawnSync("pnpm", wranglerArgs, {
    cwd: resolve(SCRIPT_DIR, ".."),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (run.error) throw run.error;
  if (run.status !== 0) {
    throw new Error(`Wrangler seed execution failed with exit code ${run.status}.`);
  }

  console.log(
    JSON.stringify(
      { target: isRemote ? `remote:${database}` : `local:${database}`, sourceHash, importedCounts },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown seed failure.";
  console.error(message);
  process.exitCode = 1;
});
