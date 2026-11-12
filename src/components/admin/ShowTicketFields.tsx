import { EDITOR, TICKET_SOURCE_LABELS } from "@/data/adminShows";
import { ticketSourceSchema } from "@/data/eventsSnapshot";
import type { FieldErrors } from "./showIssues";
import type { SetField, ShowForm } from "./showForm";
import ShowField, { ShowCheck } from "./ShowField";
import styles from "./ShowEditorModal.module.css";

interface Props {
  form: ShowForm;
  set: SetField;
  errors: FieldErrors;
}

/** The "Tickets" part of the Shows editor. */
export default function ShowTicketFields({ form, set, errors }: Props) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{EDITOR.sectionTickets}</legend>
      <ShowField
        id="show-source"
        label={EDITOR.ticketSource}
        error={errors.ticketSource}
      >
        {(a) => (
          <select
            {...a}
            value={form.ticketSource}
            onChange={(e) =>
              set("ticketSource", ticketSourceSchema.parse(e.target.value))
            }
          >
            {ticketSourceSchema.options.map((s) => (
              <option key={s} value={s}>
                {TICKET_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        )}
      </ShowField>
      <ShowField id="show-url" label={EDITOR.url} error={errors.url}>
        {(a) => (
          <input
            {...a}
            type="url"
            inputMode="url"
            value={form.url}
            onChange={(e) => set("url", e.target.value)}
          />
        )}
      </ShowField>
      <div className={styles.pair}>
        <ShowField
          id="show-eventbrite-id"
          label={EDITOR.eventbriteId}
          error={errors.eventbriteId}
        >
          {(a) => (
            <input
              {...a}
              inputMode="numeric"
              value={form.eventbriteId}
              onChange={(e) => set("eventbriteId", e.target.value)}
            />
          )}
        </ShowField>
        <ShowField id="show-price" label={EDITOR.price} error={errors.price}>
          {(a) => (
            <input
              {...a}
              inputMode="decimal"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
            />
          )}
        </ShowField>
      </div>
      <ShowField
        id="show-on-sale"
        label={EDITOR.onSaleAt}
        error={errors.onSaleLocal}
      >
        {(a) => (
          <input
            {...a}
            type="datetime-local"
            value={form.onSaleLocal}
            onChange={(e) => set("onSaleLocal", e.target.value)}
          />
        )}
      </ShowField>
      <ShowCheck
        label={EDITOR.soldOut}
        checked={form.soldOut}
        onChange={(v) => set("soldOut", v)}
        error={errors.soldOut}
      />
    </fieldset>
  );
}
