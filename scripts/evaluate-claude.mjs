import { spawnSync } from "node:child_process";

if (!process.env.ANTHROPIC_API_KEY || !process.env.ANTHROPIC_MODEL) {
  console.error("Export ANTHROPIC_API_KEY and ANTHROPIC_MODEL before running the live synthetic evaluation. Provider usage is billed to that account.");
  process.exit(1);
}
const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/claude-live.test.ts"], {
  stdio: "inherit", env: { ...process.env, RUN_LIVE_CLAUDE_EVAL: "1" },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
