import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Upgrade an existing installation only. Never execute schema.sql or seeders.
const steps = [
    [fileURLToPath(new URL("./rename-study-parts.mjs", import.meta.url))],
    ["--experimental-strip-types", fileURLToPath(new URL("./migrate.ts", import.meta.url)), "--part-c-timing"],
    ["--experimental-strip-types", fileURLToPath(new URL("./migrate.ts", import.meta.url)), "--part-c-recall"],
    ["--experimental-strip-types", fileURLToPath(new URL("./migrate.ts", import.meta.url)), "--part-a-recall-phases"],
];

for (const args of steps) {
    const result = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Existing study database upgraded successfully; records preserved.");
