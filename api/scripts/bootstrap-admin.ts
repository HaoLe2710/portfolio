import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { writeFile, rm } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hashPasswordNode } from "./argon2id-node";

function escapeSql(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function promptEmail() {
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    return (await readline.question("Owner email: ")).trim().toLowerCase();
  } finally {
    readline.close();
  }
}

async function promptPassword() {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Run this command in an interactive terminal so the password can be entered without echo.");
  }
  stdout.write("Owner password (12-256 characters, hidden): ");
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise<string>((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") return finish(new Error("Bootstrap cancelled."));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u0008" || character === "\u007f") value = value.slice(0, -1);
        else if (character >= " ") value += character;
      }
    };
    stdin.on("data", onData);
  });
}

function runWrangler(args: string[]) {
  const result = spawnSync(process.execPath, [resolve(process.cwd(), "node_modules/wrangler/bin/wrangler.js"), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.stdout) stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Wrangler exited with status ${result.status ?? "unknown"}.`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const local = args.has("--local");
  const remote = args.has("--remote");
  const nonInteractive = args.has("--non-interactive");
  if (local === remote) throw new Error("Choose exactly one target: --local or --remote.");
  if (remote && (!args.has("--staging") || !args.has("--confirm-staging"))) {
    throw new Error("Remote bootstrap is limited to the isolated staging database. Use --remote --staging --confirm-staging.");
  }
  if (nonInteractive && (!remote || !args.has("--staging") || !args.has("--confirm-staging"))) {
    throw new Error("Non-interactive credential bootstrap is limited to explicitly confirmed staging D1.");
  }

  const email = nonInteractive
    ? (process.env.PORTFOLIO_BOOTSTRAP_EMAIL ?? "").trim().toLowerCase()
    : await promptEmail();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Enter a valid email address.");
  }
  const password = nonInteractive
    ? process.env.PORTFOLIO_BOOTSTRAP_PASSWORD ?? ""
    : await promptPassword();
  if (password.length < 12 || password.length > 256) {
    throw new Error("Password must contain between 12 and 256 characters.");
  }
  const credentials = await hashPasswordNode(password);
  const id = randomUUID();
  const sqlPath = join(tmpdir(), `portfolio-admin-bootstrap-${randomUUID()}.sql`);
  const sql = `INSERT INTO admin_users (id, email, password_salt, password_hash, password_iterations, password_algorithm, role)
SELECT ${escapeSql(id)}, ${escapeSql(email)}, ${escapeSql(credentials.salt)}, ${escapeSql(credentials.hash)}, ${credentials.iterations}, ${escapeSql(credentials.algorithm)}, 'OWNER'
WHERE NOT EXISTS (SELECT 1 FROM admin_users WHERE role = 'OWNER');
SELECT email, role FROM admin_users WHERE role = 'OWNER';\n`;

  await writeFile(sqlPath, sql, { encoding: "utf8", flag: "wx" });
  try {
    const database = local ? "portfolio_db" : "portfolio_db_staging";
    runWrangler([
      "d1", "execute", database,
      local ? "--local" : "--remote",
      ...(remote ? ["--config", "wrangler.staging.toml"] : []),
      "--file", sqlPath,
    ]);
  } finally {
    await rm(sqlPath, { force: true });
  }
  stdout.write(`Bootstrap checked ${local ? "local" : "staging"} D1. If an OWNER already exists, no account was changed.\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Bootstrap failed."}\n`);
  process.exitCode = 1;
});
