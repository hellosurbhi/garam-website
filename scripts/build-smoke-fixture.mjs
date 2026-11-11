import { spawnSync } from "node:child_process";
// Isolated build configuration. These are public, nonfunctional test identifiers.
// Never load production credentials merely to render an offline browser fixture.
const result = spawnSync(
  process.execPath,
  ["node_modules/astro/bin/astro.mjs", "build", "--outDir", ".smoke-dist"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PUBLIC_FIREBASE_API_KEY: "AIzaSySmokeFixtureNotARealFirebaseKey00000",
      PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-garam-masala.firebaseapp.com",
      PUBLIC_FIREBASE_PROJECT_ID: "demo-garam-masala",
      PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-garam-masala.appspot.com",
      PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
      PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000",
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
