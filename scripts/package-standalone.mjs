import { cp, mkdir, stat } from "node:fs/promises";

const destination = ".next/standalone";
await stat(`${destination}/server.js`);
await cp(".next/static", `${destination}/.next/static`, { recursive: true });
try {
    await stat("public");
    await cp("public", `${destination}/public`, { recursive: true });
} catch (error) {
    if (error.code !== "ENOENT") throw error;
}
await mkdir(`${destination}/src/db`, { recursive: true });
for (const name of ["upgrade-production.mjs", "rename-study-parts.mjs", "repair-question-options.mjs", "migrate.ts"]) {
    await cp(`src/db/${name}`, `${destination}/src/db/${name}`);
}
console.log("Standalone app, assets and non-destructive migrations packaged.");
