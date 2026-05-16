import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { events } from "@/data/events";
import Skeleton from "../ui/Skeleton";
import styles from "./ContestantsTab.module.css";

interface Invite {
  id: string;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  showId: string;
  showDate?: string;
  role: string;
  claimed?: boolean;
  createdAt?: { seconds: number };
}

type InviteStatus = "pending" | "claimed" | "expired";

export default function ContestantsTab() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [showFilter, setShowFilter] = useState("all");

  const today = new Date().toLocaleDateString("en-CA");
  const upcomingEvents = events.filter(
    (e) => e.isoDate && e.isoDate > today && !e.hidden,
  );

  async function fetchInvites() {
    setLoading(true);
    setFetchError(false);
    try {
      const q = query(
        collection(getFirebaseDb(), "invites"),
        orderBy("createdAt", "desc"),
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Invite);
      setInvites(docs);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvites();
  }, []);

  const filteredInvites = useMemo(() => {
    if (showFilter === "all") return invites;
    return invites.filter((inv) => inv.showId === showFilter);
  }, [invites, showFilter]);

  function getShowLabel(showId: string): string {
    const parts = showId.split("-");
    const isoDate = parts.slice(-3).join("-");
    const citySlug = parts.slice(0, -3).join("-");
    const event = events.find(
      (e) => e.citySlug === citySlug && e.isoDate === isoDate,
    );
    if (event) return `${event.date}: ${event.city}`;
    return showId;
  }

  function getInviteStatus(invite: Invite): InviteStatus {
    if (invite.claimed) return "claimed";
    if (invite.showDate && invite.showDate < today) return "expired";
    return "pending";
  }

  function getStatusColor(status: InviteStatus): string {
    switch (status) {
      case "pending":
        return "var(--color-status-pending)";
      case "claimed":
        return "var(--color-status-claimed)";
      case "expired":
        return "var(--color-status-expired)";
    }
  }

  if (loading) {
    return (
      <div
        className={styles.container}
        role="status"
        aria-live="polite"
        aria-label="Loading contestants"
      >
        <Skeleton count={4} />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <p>Failed to load contestants.</p>
          <button onClick={fetchInvites} className={styles.retryButton}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.filterRow}>
        <label htmlFor="show-filter" className={styles.filterLabel}>
          Filter by show
        </label>
        <select
          id="show-filter"
          value={showFilter}
          onChange={(e) => setShowFilter(e.target.value)}
          className={styles.filterSelect}
          aria-label="Filter contestants by show"
        >
          <option value="all">All shows</option>
          {upcomingEvents.map((event) => {
            const eventShowId = `${event.citySlug}-${event.isoDate}`;
            return (
              <option key={eventShowId} value={eventShowId}>
                {event.date}: {event.city}
              </option>
            );
          })}
        </select>
      </div>

      {filteredInvites.length === 0 ? (
        <div className={styles.emptyState}>
          {showFilter === "all"
            ? "No contestants invited yet."
            : "No contestants for this show."}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Name</th>
                <th className={styles.th}>Role</th>
                <th className={styles.th}>Show</th>
                <th className={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvites.map((invite) => {
                const status = getInviteStatus(invite);
                return (
                  <tr key={invite.id} className={styles.row}>
                    <td className={styles.td}>
                      <div className={styles.nameCell}>
                        <span className={styles.inviteName}>
                          {invite.applicantName}
                        </span>
                        {invite.applicantEmail && (
                          <span className={styles.inviteEmail}>
                            {invite.applicantEmail}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.roleTag}>{invite.role}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.showLabel}>
                        {getShowLabel(invite.showId)}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span
                        className={styles.statusBadge}
                        style={
                          {
                            "--status-color": getStatusColor(status),
                          } as React.CSSProperties
                        }
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className={styles.countLabel}>
        {filteredInvites.length} contestant
        {filteredInvites.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
