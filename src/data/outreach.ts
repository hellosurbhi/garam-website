import type { Templates } from "@/lib/outreach/model";
export const defaultTemplates: Templates = {
  announcement: {
    subject: "Garam Masala Dating is coming to {{city}}",
    body: "Hi!\n\nWe're bringing Garam Masala Dating to {{venue}} in {{city}} on {{date}}. Come join us for a live comedy dating show.\n\nGet your tickets: {{tickets}}\n\nSee you there,\nGaram Masala Dating",
  },
  monday: {
    subject: "This week in {{city}}: Garam Masala Dating",
    body: "Hi!\n\nOur {{city}} show is this week. Join us at {{venue}} on {{date}} for Garam Masala Dating.\n\nTickets and show details: {{tickets}}\n\nSee you there,\nGaram Masala Dating",
  },
  friday: {
    subject: "Your weekend plans in {{city}}",
    body: "Hi!\n\nA reminder that Garam Masala Dating is at {{venue}} on {{date}}. We'd love to see you there.\n\nTickets and show details: {{tickets}}\n\nGaram Masala Dating",
  },
};
export const emailLabels = {
  announcement: "Announcement",
  monday: "Show week Monday",
  friday: "Show week Friday",
};
