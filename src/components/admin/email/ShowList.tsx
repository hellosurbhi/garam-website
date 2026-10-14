import type { ShowInput } from "@/lib/outreach/model";
import type { EmailDashboardData } from "./api";
import DeliveryIssues from "./DeliveryIssues";
import styles from "./Email.module.css";
export default function ShowList({
  data,
  now,
  onEdit,
}: {
  data: EmailDashboardData;
  now: number;
  onEdit: (edit: { show: ShowInput; version: string | null }) => void;
}) {
  return (
    <>
      {data.shows.length === 0 && (
        <div className={styles.empty}>
          <h3>Your next show starts here</h3>
          <p>
            Add its date, venue and ticket link. Saved copy is ready to use.
          </p>
        </div>
      )}
      {data.shows.map((row) => (
        <article key={row.id} className={styles.show}>
          <div className={styles.heading}>
            <div>
              <h3>
                {row.value.city} · {row.value.date}
              </h3>
              <p>
                {row.value.venue} · {row.value.enabled ? "Scheduled" : "Paused"}
              </p>
            </div>
            <button
              onClick={() => {
                const {
                  createdAt: _createdAt,
                  updatedAt: _updatedAt,
                  ...show
                } = row.value;
                void _createdAt;
                void _updatedAt;
                onEdit({ show, version: row.version });
              }}
            >
              Edit show
            </button>
          </div>
          {data.progress
            .filter((p) => p.showId === row.id)
            .map((p) => (
              <div key={p.id}>
                <p>
                  {p.milestone}: {p.sent} sent of {p.total}
                  {p.excluded ? ` · ${p.excluded} excluded` : ""}
                  {p.attention ? ` · ${p.attention} need attention` : ""}
                </p>
                {p.attention > 0 && (
                  <DeliveryIssues showId={row.id} milestone={p.milestone} />
                )}
              </div>
            ))}
        </article>
      ))}
      <details className={styles.defaults}>
        <summary>Use a show already on the website</summary>
        {data.catalog
          .filter(
            (s) =>
              !data.shows.some((r) => r.id === s.id) &&
              s.date >= new Date(now).toISOString().slice(0, 10),
          )
          .map((show) => (
            <p key={show.id}>
              <button
                onClick={() =>
                  onEdit({
                    show: {
                      ...show,
                      audience: "all",
                      enabled: true,
                      published: true,
                      templates: data.settings.value.templates,
                    },
                    version: null,
                  })
                }
              >
                {show.city} · {show.date}
              </button>
            </p>
          ))}
      </details>
    </>
  );
}
