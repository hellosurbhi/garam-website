import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Resend } from "resend";
import { createElement } from "react";
import { render } from "@react-email/render";
import { createHmac } from "crypto";
import PostShow from "../src/emails/PostShow";

// Init Firebase Admin (standalone script, not Astro — init directly)
if (getApps().length === 0) {
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "").replace(
    /\\n/g,
    "\n",
  );
  initializeApp({
    credential: cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db = getFirestore();
const resend = new Resend(process.env.RESEND_API_KEY);
const SITE = process.env.SITE ?? "https://garammasaladating.com";
const UNSUB_SECRET = process.env.UNSUBSCRIBE_SECRET ?? "";

function makeUnsubUrl(email: string): string {
  const sig = createHmac("sha256", UNSUB_SECRET).update(email).digest("hex");
  return `${SITE}/api/unsubscribe?email=${encodeURIComponent(email)}&sig=${sig}`;
}

function yesterdayIso(tz: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayLocal = formatter.format(now);
  const d = new Date(todayLocal + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  // Find all contestants whose show was yesterday (in their show's timezone)
  const allContestants = await db.collection("contestants").get();
  const toSend: FirebaseFirestore.QueryDocumentSnapshot[] = [];

  for (const doc of allContestants.docs) {
    const data = doc.data();
    if (data.postShowEmailSentAt) continue;
    const tz = (data.showTimezone as string) || "America/New_York";
    const yesterday = yesterdayIso(tz);
    if (data.showDate === yesterday) {
      toSend.push(doc);
    }
  }

  if (toSend.length === 0) {
    console.log("No post-show emails to send today.");
    return;
  }

  // Find next upcoming show for the email CTA
  // Import events data — this is a standalone script so we use dynamic import
  const { events } = await import("../src/data/events");
  const todayStr = new Date().toLocaleDateString("en-CA");
  const nextShow = events.find(
    (e) => !e.hidden && e.isoDate && e.isoDate > todayStr,
  );

  console.log(`Sending post-show emails to ${toSend.length} contestants...`);

  for (const doc of toSend) {
    const data = doc.data();
    const email = data.email as string;
    const firstName = data.firstName as string;
    const showCity = data.showCity as string;

    try {
      const html = await render(
        createElement(PostShow, {
          firstName,
          showCity,
          nextShowCity: nextShow?.city,
          nextShowDate: nextShow?.date,
          nextShowUrl: nextShow?.url || undefined,
          unsubscribeUrl: makeUnsubUrl(email),
        }),
      );

      await resend.emails.send({
        from: "Garam Masala Dating <casting@garammasaladating.com>",
        to: email,
        subject: `Thanks for the laughs, ${firstName}! You're welcome back anytime`,
        html,
      });

      await doc.ref.update({
        postShowEmailSentAt: new Date().toISOString(),
      });

      console.log(`  ✓ Sent to ${email}`);
    } catch (err) {
      console.error(`  ✗ Failed for ${email}:`, err);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
