import type { ShowInput } from "@/lib/outreach/model";
import styles from "./Email.module.css";
export default function ShowFields({
  show,
  busy,
  setShow,
}: {
  show: ShowInput;
  busy: boolean;
  setShow: (show: ShowInput) => void;
}) {
  function field(key: keyof ShowInput, value: string) {
    setShow({ ...show, [key]: value });
  }
  return (
    <fieldset disabled={busy} className={styles.fields}>
      <label>
        City
        <input
          required
          value={show.city}
          onChange={(e) => field("city", e.target.value)}
        />
      </label>
      <label>
        Venue
        <input
          required
          value={show.venue}
          onChange={(e) => field("venue", e.target.value)}
        />
      </label>
      <label>
        Show date
        <input
          type="date"
          required
          value={show.date}
          onChange={(e) => field("date", e.target.value)}
        />
      </label>
      <label>
        Show time
        <input
          type="time"
          required
          value={show.time}
          onChange={(e) => field("time", e.target.value)}
        />
      </label>
      <label>
        Timezone
        <select
          value={show.timezone}
          onChange={(e) => field("timezone", e.target.value)}
        >
          <option value="America/New_York">Eastern</option>
          <option value="America/Chicago">Central</option>
          <option value="America/Denver">Mountain</option>
          <option value="America/Los_Angeles">Pacific</option>
        </select>
      </label>
      <label>
        Ticket link
        <input
          type="url"
          required
          value={show.tickets}
          onChange={(e) => field("tickets", e.target.value)}
        />
      </label>
      <label>
        Send to
        <select
          value={show.audience}
          onChange={(e) =>
            setShow({
              ...show,
              audience: e.target.value === "city" ? "city" : "all",
            })
          }
        >
          <option value="all">Everyone on the email list</option>
          <option value="city">Contacts in this city</option>
        </select>
      </label>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={show.published}
          onChange={(e) => setShow({ ...show, published: e.target.checked })}
        />
        Publish on the website
      </label>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={show.enabled}
          onChange={(e) => setShow({ ...show, enabled: e.target.checked })}
        />
        Automatic emails for this show
      </label>
    </fieldset>
  );
}
