import { useState } from "react";
import type { Templates } from "@/lib/outreach/model";
import type { EmailDashboardData } from "./api";
import TemplatesEditor from "./TemplatesEditor";
import styles from "./Email.module.css";
export default function DefaultsEditor({
  data,
  busy,
  offline,
  onSave,
}: {
  data: EmailDashboardData;
  busy: boolean;
  offline: boolean;
  onSave: (enabled: boolean, templates: Templates) => void;
}) {
  const [templates, setTemplates] = useState<Templates | null>(null);
  return (
    <details className={styles.defaults}>
      <summary>Reusable email copy</summary>
      <p>
        These defaults are used for newly added shows. Edit a show's copy above
        to change its scheduled emails.
      </p>
      <TemplatesEditor
        value={templates ?? data.settings.value.templates}
        onChange={setTemplates}
        disabled={busy}
      />
      <button
        disabled={busy || offline || !templates}
        onClick={() =>
          onSave(
            data.settings.value.enabled,
            templates ?? data.settings.value.templates,
          )
        }
      >
        Save reusable copy
      </button>
    </details>
  );
}
