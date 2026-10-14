import type { Templates } from "@/lib/outreach/model";
import { milestones } from "@/lib/outreach/model";
import { emailLabels } from "@/data/outreach";
import styles from "./Email.module.css";
export default function TemplatesEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: Templates;
  onChange: (value: Templates) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.templates}>
      <p>
        Use {"{{city}}"}, {"{{date}}"}, {"{{venue}}"} and {"{{tickets}}"}. Show
        details fill in automatically. An unsubscribe link is added to each
        email.
      </p>
      {milestones.map((kind) => (
        <fieldset key={kind} disabled={disabled}>
          <legend>{emailLabels[kind]}</legend>
          <label>
            Subject
            <input
              value={value[kind].subject}
              maxLength={200}
              required
              onChange={(e) =>
                onChange({
                  ...value,
                  [kind]: { ...value[kind], subject: e.target.value },
                })
              }
            />
          </label>
          <label>
            Email copy
            <textarea
              value={value[kind].body}
              rows={8}
              maxLength={12000}
              required
              onChange={(e) =>
                onChange({
                  ...value,
                  [kind]: { ...value[kind], body: e.target.value },
                })
              }
            />
          </label>
        </fieldset>
      ))}
    </div>
  );
}
