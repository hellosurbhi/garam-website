/**
 * All copy for the admin Shows tab (issue 337): the show list, the editor,
 * publish, restore and the version history. Components import from here and
 * never hardcode their own text.
 */
import {
  SKIPPED_TIME_MESSAGE,
  type SnapshotDiff,
  type TicketSource,
} from "./eventsSnapshot";

export const SHOWS_TAB_LABEL = "Shows";

export const SHOWS_LOAD = {
  loading: "Loading shows...",
  denied:
    "This account can't manage shows. Log out and sign in with an admin account.",
  sessionExpired: "Your session expired. Log in again.",
  network: "Couldn't reach the server. Check your connection and try again.",
  failed: "Couldn't load the shows.",
  retry: "Try again",
} as const;

export const SHOWS_STATUS = {
  heading: "Show list",
  live: (version: number, date: string, author: string | undefined) =>
    author
      ? `Version ${version} is live, published ${date} by ${author}.`
      : `Version ${version} is live, published ${date}.`,
  onSite: "The website shows this version.",
  checking: "Checking which version the website shows...",
  rebuilding: (minutes: number) =>
    minutes < 1
      ? "The website is rebuilding, requested just now."
      : `The website is rebuilding, requested ${minutes} min ago.`,
  stuck:
    "The rebuild looks stuck. Press Rebuild site, or restore the previous version.",
  notRequested:
    "The website hasn't rebuilt for this version yet. Press Rebuild site.",
  locked: (seconds: number) =>
    `A rebuild just started. Publishing and restoring unlock in ${seconds} s.`,
  noChanges: "No unpublished changes.",
  changes: (count: number) =>
    count === 1 ? "1 unpublished change." : `${count} unpublished changes.`,
  savedBy: (author: string, date: string) =>
    `Draft last saved by ${author} on ${date}.`,
} as const;

export const SHOWS_ACTIONS = {
  addShow: "Add show",
  publish: "Publish",
  discard: "Discard draft",
  history: "Version history",
  hideHistory: "Hide history",
  rebuild: "Rebuild site",
  rebuilding: "Rebuilding...",
  edit: "Edit",
  cancelShow: "Cancel show",
} as const;

export const SHOWS_LIST = {
  heading: "Shows in the draft",
  upcoming: "Upcoming shows",
  older: (count: number) => `Past, hidden and canceled shows (${count})`,
  empty: "No upcoming shows. Add the next one.",
  unpublished: "Unpublished",
  listed: "On the tickets page",
  notifyCard: "Notify me card on the tickets page",
  hidden: "Hidden",
  canceled: "Canceled",
  past: "Past",
  undated: "No date",
  noVenue: "Venue not set",
} as const;

export const SHOWS_TOAST = {
  saved: "Draft saved",
  discarded: "Draft discarded",
  published: (version: number) =>
    `Version ${version} published. The website is rebuilding.`,
  restored: (version: number) =>
    `Version ${version} published from the older one. The website is rebuilding.`,
  noRebuild: (version: number) =>
    `Version ${version} is published but the rebuild didn't start. Press Rebuild site.`,
  rebuildStarted: "Rebuild started",
  rebuildFailed: "The rebuild didn't start. Try again in a minute.",
  reloaded:
    "Someone else changed the shows first, so nothing was saved. The list now shows their version.",
} as const;

/** Headings for each kind of pending change, in the order they are listed. */
export const CHANGE_LABELS: Record<keyof SnapshotDiff, string> = {
  added: "New shows",
  changed: "Edited shows",
  canceled: "Canceled shows",
  tbaCitiesAdded: "Coming soon cities added",
  tbaCitiesChanged: "Coming soon cities edited",
  tbaCitiesRemoved: "Coming soon cities removed",
};

export const PUBLISH_DIALOG = {
  title: "Publish these changes?",
  body: "The website rebuilds with these changes in a few minutes. Ticket links switch within a minute.",
  confirm: "Publish now",
  busy: "Publishing...",
} as const;

export const RESTORE_DIALOG = {
  title: (version: number) => `Restore version ${version}?`,
  body: (version: number) =>
    `This publishes the shows exactly as they were in version ${version} and rebuilds the website. Shows added after version ${version} stay on record, hidden and canceled.`,
  confirm: (version: number) => `Restore version ${version}`,
  busy: "Restoring...",
} as const;

export const DISCARD_DIALOG = {
  title: "Discard the draft?",
  body: "Every unpublished change goes away and the draft matches the live version again.",
  confirm: "Discard draft",
  busy: "Discarding...",
} as const;

export const CONFIRM_DIALOG = {
  noteLabel: "What changed and why",
  noteRequired: "Add a short note so the history says why.",
  back: "Keep editing",
} as const;

export const HISTORY = {
  heading: "Version history",
  empty: "No versions yet.",
  version: (version: number) => `Version ${version}`,
  liveBadge: "Live",
  byLine: (kind: string, author: string, date: string) =>
    `${kind} by ${author} on ${date}`,
  kindMigration: "First import",
  kindPublish: "Published",
  kindRollback: (version: number | undefined) =>
    version ? `Restored version ${version}` : "Restored",
  changeCount: (count: number) =>
    count === 1 ? "1 change" : `${count} changes`,
  restore: "Restore",
  restoreLabel: (version: number) => `Restore version ${version}`,
} as const;

export const COMING_SOON = {
  heading: "Coming soon cities",
  hint: "Each city here gets a coming soon page and can fill a spare footer city link. Notify me cards on the homepage and tickets page go to the five cities with the most waitlist signups.",
  notifyNow: (cities: string[]) =>
    `Notify me cards right now: ${cities.join(", ")}.`,
  notifyNone: "No notify me cards right now.",
  empty: "No coming soon cities.",
  cityLabel: "City to add",
  stateLabel: "State",
  add: "Add city",
  remove: "Remove",
  removeLabel: (city: string) => `Remove ${city} from coming soon`,
} as const;

export const TICKET_SOURCE_LABELS: Record<TicketSource, string> = {
  "our-eventbrite": "Our Eventbrite",
  "their-eventbrite": "Promoter's Eventbrite",
  "other-platform": "Another ticket site",
  none: "No tickets yet",
};

export const EDITOR = {
  titleNew: "Add a show",
  titleEdit: (city: string, date: string) => `Edit ${city}, ${date}`,
  close: "Close",
  save: "Save to draft",
  saving: "Saving...",
  fixFirst: "Fix the highlighted fields first.",
  otherShows: "Other shows in the draft need fixing first:",
  pickOne: "Pick one",
  sectionWhere: "When and where",
  sectionTickets: "Tickets",
  sectionCard: "On the card",
  sectionStatus: "Status",
  city: "City",
  cityLocked: "The city of a published show can't change.",
  state: "State",
  stateAbbr: "State code",
  date: "Date",
  startTime: "Starts",
  endTime: "Ends",
  timezone: "Time zone",
  venue: "Venue",
  venueNone: "No venue yet",
  venueNew: "New venue",
  venueName: "Venue name",
  venueStreet: "Street address",
  venueLocality: "Town or city",
  venueRegion: "State or region code",
  venuePostal: "Postal code",
  venueCountry: "Country code",
  ticketSource: "Who sells the tickets",
  url: "Ticket link",
  eventbriteId: "Eventbrite event id",
  price: "Ticket price in USD",
  onSaleAt: "Tickets go on sale (show's local time)",
  soldOut: "Sold out",
  tagline: "Card tagline",
  description: "Description",
  lineup: "On stage",
  hidden: "Hide from the website",
  canceled: "Canceled",
  note: "Note for the record",
  noteHint: "Needed when you cancel the show or move its date.",
  noteNeeded: "Add a note saying why.",
  badDate: "Enter a real date with a four digit year.",
  skippedTime: SKIPPED_TIME_MESSAGE,
  stale:
    "Someone published a newer version while the editor was open, so nothing you typed was saved. Open the show again to edit the current version.",
  staleDismiss: "OK",
} as const;
