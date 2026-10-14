import { useState } from "react";
import { z } from "zod";
import { emailApi } from "./api";
const schema = z.object({
  contacts: z.array(
    z.object({ email: z.string(), city: z.string(), suppressed: z.boolean() }),
  ),
  suppressed: z.array(z.string()),
  lastGmailSendAt: z.number().nonnegative(),
  history: z.array(z.object({ email: z.string(), showId: z.string() })),
});
export default function AudienceImport({ onSaved }: { onSaved: () => void }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div>
      <label>
        Import the prepared audience file
        <input
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setMessage("Importing your audience…");
            try {
              if (file.size > 5000000)
                throw new Error("This audience file is too large");
              const data = schema.parse(JSON.parse(await file.text()));
              for (let i = 0; i < data.suppressed.length; i += 100)
                await emailApi(
                  {
                    contacts: [],
                    suppressed: data.suppressed.slice(i, i + 100),
                    complete: false,
                  },
                  "/import",
                );
              for (let i = 0; i < data.contacts.length; i += 100)
                await emailApi(
                  {
                    contacts: data.contacts.slice(i, i + 100),
                    suppressed: [],
                    complete: false,
                  },
                  "/import",
                );
              for (let i = 0; i < data.history.length; i += 100)
                await emailApi(
                  {
                    contacts: [],
                    suppressed: [],
                    history: data.history.slice(i, i + 100),
                    complete: false,
                  },
                  "/import",
                );
              await emailApi(
                {
                  contacts: [],
                  suppressed: [],
                  complete: true,
                  lastGmailSendAt: data.lastGmailSendAt,
                },
                "/import",
              );
              setMessage(
                "Audience imported. Unsubscribed contacts remain excluded.",
              );
              onSaved();
            } catch (err) {
              setMessage(
                err instanceof Error
                  ? err.message
                  : "Import failed. Please try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <p role="status">{message}</p>
    </div>
  );
}
