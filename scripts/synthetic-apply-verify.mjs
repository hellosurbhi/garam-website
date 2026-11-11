import { writeFile } from "node:fs/promises";
import { createAdmin } from "./synthetic/admin.mjs";
import { sweep } from "./synthetic/ledger.mjs";

try {
  if (!process.env.MONITOR_RUN_ID)
    throw new Error("MONITOR_RUN_ID is required for exact-attempt cleanup");
  const errors = await sweep(await createAdmin(), process.env.MONITOR_RUN_ID);
  await writeFile(
    "synthetic-cleanup.json",
    JSON.stringify({ ok: errors.length === 0, errors }),
  );
  if (errors.length)
    throw new Error(
      `Cleanup requires attention for ${errors.length} item(s); see the sanitized report`,
    );
  console.log("Cleanup verified: test documents and photos are absent.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Cleanup failed");
  process.exitCode = 1;
}
