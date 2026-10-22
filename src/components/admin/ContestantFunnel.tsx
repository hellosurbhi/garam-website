import { useState, useMemo } from "react";
import { type Application } from "@/types/application";
import { toMs } from "@/utils/date";
import styles from "./ContestantFunnel.module.css";

interface ContestantFunnelProps {
  applications: Application[];
}

type FunnelWindow = 7 | 30 | 90;

const WINDOWS: { value: FunnelWindow; label: string }[] = [
  { value: 7, label: "7D" },
  { value: 30, label: "30D" },
  { value: 90, label: "90D" },
];

function inWindow(val: unknown, start: number): boolean {
  const ms = toMs(val);
  return ms !== null && ms >= start;
}

function medianDays(
  apps: Application[],
  getTo: (a: Application) => number | null,
  getFrom: (a: Application) => number | null,
): number | null {
  const diffs = apps
    .map((a) => {
      const from = getFrom(a);
      const to = getTo(a);
      if (from === null || to === null || to < from) return null;
      return (to - from) / (1000 * 60 * 60 * 24);
    })
    .filter((d): d is number => d !== null);
  if (diffs.length === 0) return null;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}

function fmtDays(days: number | null): string {
  if (days === null) return "";
  if (days < 1) return `${Math.round(days * 24)}h`;
  return `${days.toFixed(1)}d`;
}

function pct(num: number, den: number): string {
  if (den === 0) return "—";
  return `${Math.round((num / den) * 100)}%`;
}

export default function ContestantFunnel({
  applications,
}: ContestantFunnelProps) {
  const [window, setWindow] = useState<FunnelWindow>(30);
  const [windowStart, setWindowStart] = useState<number>(
    () => Date.now() - 30 * 24 * 60 * 60 * 1000,
  );

  const { stages, cityRows, slowestIdx } = useMemo(() => {
    const start = windowStart;

    const applied = applications.filter((a) => inWindow(a.submittedAt, start));
    const contacted = applications.filter((a) =>
      inWindow(a.contactedAt, start),
    );
    const scheduled = applications.filter((a) =>
      inWindow(a.scheduledAt, start),
    );
    const interviewed = applications.filter((a) =>
      inWindow(a.interviewedAt, start),
    );
    const approved = applications.filter(
      (a) => a.decision === "approve" && inWindow(a.decidedAt, start),
    );
    const invited = applications.filter((a) => inWindow(a.invitedAt, start));
    const waiverSigned = applications.filter((a) =>
      inWindow(a.waiverSignedAt, start),
    );
    const participated = applications.filter((a) =>
      inWindow(a.participatedAt, start),
    );

    const stageList = [
      {
        label: "Applied",
        count: applied.length,
        vsCount: null as number | null,
        medianD: null as number | null,
      },
      {
        label: "Contacted",
        count: contacted.length,
        vsCount: applied.length,
        medianD: medianDays(
          contacted,
          (a) => toMs(a.contactedAt),
          (a) => toMs(a.submittedAt),
        ),
      },
      {
        label: "Scheduled",
        count: scheduled.length,
        vsCount: contacted.length,
        medianD: medianDays(
          scheduled,
          (a) => toMs(a.scheduledAt),
          (a) => toMs(a.contactedAt),
        ),
      },
      {
        label: "Interviewed",
        count: interviewed.length,
        vsCount: scheduled.length,
        medianD: medianDays(
          interviewed,
          (a) => toMs(a.interviewedAt),
          (a) => toMs(a.scheduledAt),
        ),
      },
      {
        label: "Approved",
        count: approved.length,
        vsCount: interviewed.length,
        medianD: medianDays(
          approved,
          (a) => toMs(a.decidedAt),
          (a) => toMs(a.interviewedAt),
        ),
      },
      {
        label: "Invited",
        count: invited.length,
        vsCount: approved.length,
        medianD: medianDays(
          invited,
          (a) => toMs(a.invitedAt),
          (a) => toMs(a.decidedAt),
        ),
      },
      {
        label: "Waiver signed",
        count: waiverSigned.length,
        vsCount: invited.length,
        medianD: medianDays(
          waiverSigned,
          (a) => toMs(a.waiverSignedAt),
          (a) => toMs(a.invitedAt),
        ),
      },
      {
        label: "Participated",
        count: participated.length,
        vsCount: waiverSigned.length,
        medianD: medianDays(
          participated,
          (a) => toMs(a.participatedAt),
          (a) => toMs(a.waiverSignedAt),
        ),
      },
    ];

    // Slowest stage = highest median days (skip nulls and the first stage)
    let slowestIdx = -1;
    let slowestDays = -1;
    stageList.forEach((s, i) => {
      if (i === 0 || s.medianD === null) return;
      if (s.medianD > slowestDays) {
        slowestDays = s.medianD;
        slowestIdx = i;
      }
    });

    // Per-city table
    const cityMap = new Map<
      string,
      { applied: number; cast: number; participated: number }
    >();
    for (const app of applications) {
      if (!inWindow(app.submittedAt, start)) continue;
      const city =
        (typeof app.city === "string" && app.city.trim()) || "Unknown";
      if (!cityMap.has(city))
        cityMap.set(city, { applied: 0, cast: 0, participated: 0 });
      const row = cityMap.get(city)!;
      row.applied++;
      if (app.status === "Cast" || app.status === "Participated") row.cast++;
      if (app.status === "Participated") row.participated++;
    }
    const cityRows = [...cityMap.entries()]
      .map(([city, counts]) => ({ city, ...counts }))
      .sort((a, b) => b.applied - a.applied)
      .slice(0, 10);

    return { stages: stageList, cityRows, slowestIdx };
  }, [applications, windowStart]);

  const maxCount = stages[0]?.count ?? 1;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Contestant Funnel</h2>
        <div className={styles.windowGroup}>
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              className={styles.windowBtn}
              data-active={window === w.value || undefined}
              onClick={() => {
                setWindowStart(Date.now() - w.value * 24 * 60 * 60 * 1000);
                setWindow(w.value);
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {stages[0]?.count === 0 ? (
        <p className={styles.empty}>No applicants in this window.</p>
      ) : (
        <>
          <div className={styles.funnel}>
            {stages.map((stage, i) => {
              const barWidth =
                maxCount > 0 ? Math.max(4, (stage.count / maxCount) * 100) : 0;
              const isSlowest = i === slowestIdx;
              return (
                <div key={stage.label} className={styles.stageRow}>
                  <span className={styles.stageLabel}>{stage.label}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${barWidth}%`,
                        background: isSlowest
                          ? "var(--brand-red)"
                          : "var(--charcoal)",
                      }}
                    />
                  </div>
                  <span
                    className={styles.stageCount}
                    style={
                      isSlowest ? { color: "var(--brand-red)" } : undefined
                    }
                  >
                    {stage.count}
                  </span>
                  <span className={styles.stagePct}>
                    {stage.vsCount !== null
                      ? pct(stage.count, stage.vsCount)
                      : ""}
                  </span>
                  <span
                    className={styles.stageMedian}
                    style={
                      isSlowest ? { color: "var(--brand-red)" } : undefined
                    }
                  >
                    {fmtDays(stage.medianD)}
                  </span>
                </div>
              );
            })}
          </div>

          {slowestIdx > 0 && (
            <p className={styles.slowestNote}>
              Slowest stage: {stages[slowestIdx]?.label} (
              {fmtDays(stages[slowestIdx]?.medianD ?? null)} median)
            </p>
          )}

          {cityRows.length > 0 && (
            <div className={styles.citySection}>
              <h3 className={styles.cityTitle}>By City</h3>
              <table className={styles.cityTable}>
                <thead>
                  <tr>
                    <th>City</th>
                    <th>Applied</th>
                    <th>Cast</th>
                    <th>Participated</th>
                  </tr>
                </thead>
                <tbody>
                  {cityRows.map((row) => (
                    <tr key={row.city}>
                      <td>{row.city}</td>
                      <td>{row.applied}</td>
                      <td>{row.cast}</td>
                      <td>{row.participated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
