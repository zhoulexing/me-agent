import { spawnSync } from "node:child_process";

const steps = ["parity", "typecheck", "build", "smoke", "test"];

for (const step of steps) {
  const result = spawnSync("npm", ["run", step], {
    stdio: "inherit",
    shell: false
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
