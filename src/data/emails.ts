export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export interface InterviewSummary {
  name: string;
  city: string;
  interviewTime: string;
  calUrl: string;
  pitchSnippet: string;
}

function wrap(body: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1A1A;line-height:1.6;">${body}</div>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;">${text}</p>`;
}

function link(url: string, label: string): string {
  return `<a href="${url}" style="color:#DC2626;">${label}</a>`;
}

export function schedulingInvite(name: string, calUrl: string): EmailTemplate {
  const subject = `Let's chat, ${name.split(" ")[0]}`;
  const text = [
    `Hi ${name},`,
    "",
    "I came across your application for Garam Masala Dating and loved your pitch. I'd love to jump on a quick call to learn more about you and answer any questions you might have about the show.",
    "",
    "You can grab a time that works for you here:",
    calUrl,
    "",
    "Looking forward to connecting!",
    "",
    "Surbhi",
    "Garam Masala Dating",
  ].join("\n");

  const html = wrap(
    p(`Hi ${name},`) +
      p(
        "I came across your application for Garam Masala Dating and loved your pitch. I'd love to jump on a quick call to learn more about you and answer any questions you might have about the show.",
      ) +
      p(
        `You can grab a time that works for you here: ${link(calUrl, calUrl)}`,
      ) +
      p("Looking forward to connecting!") +
      p("Surbhi<br>Garam Masala Dating"),
  );

  return { subject, text, html };
}

export function schedulingFollowup(
  name: string,
  calUrl: string,
): EmailTemplate {
  const subject = `Following up, ${name.split(" ")[0]}`;
  const text = [
    `Hi ${name},`,
    "",
    "Just wanted to follow up on my earlier message. We're still looking for contestants for an upcoming Garam Masala Dating show and I think you'd be a great fit.",
    "",
    "If you're still interested, feel free to grab a time here:",
    calUrl,
    "",
    "No worries if the timing isn't right. Just let me know!",
    "",
    "Surbhi",
    "Garam Masala Dating",
  ].join("\n");

  const html = wrap(
    p(`Hi ${name},`) +
      p(
        "Just wanted to follow up on my earlier message. We're still looking for contestants for an upcoming Garam Masala Dating show and I think you'd be a great fit.",
      ) +
      p(
        `If you're still interested, feel free to grab a time here: ${link(calUrl, calUrl)}`,
      ) +
      p("No worries if the timing isn't right. Just let me know!") +
      p("Surbhi<br>Garam Masala Dating"),
  );

  return { subject, text, html };
}

export function inviteApproval(
  name: string,
  opts: { portalUrl?: string; showDate?: string; showCity?: string } = {},
): EmailTemplate {
  const subject = `You're in! Garam Masala Dating`;
  const showLine =
    opts.showDate && opts.showCity
      ? `The show is on ${opts.showDate} in ${opts.showCity}.`
      : "We'll send you the show details shortly.";

  const text = [
    `Hi ${name},`,
    "",
    "Great news! We'd love to have you as a contestant on Garam Masala Dating. You had a wonderful energy on our call and we think the audience is going to love you.",
    "",
    showLine,
    "",
    opts.portalUrl
      ? `Next step: please sign your contestant waiver here: ${opts.portalUrl}`
      : "We'll send you the waiver link shortly.",
    "",
    "Reach out if you have any questions. So excited to have you!",
    "",
    "Surbhi",
    "Garam Masala Dating",
  ].join("\n");

  const html = wrap(
    p(`Hi ${name},`) +
      p(
        "Great news! We'd love to have you as a contestant on Garam Masala Dating. You had a wonderful energy on our call and we think the audience is going to love you.",
      ) +
      p(showLine) +
      (opts.portalUrl
        ? p(
            `Next step: please sign your contestant waiver here: ${link(opts.portalUrl, opts.portalUrl)}`,
          )
        : p("We'll send you the waiver link shortly.")) +
      p("Reach out if you have any questions. So excited to have you!") +
      p("Surbhi<br>Garam Masala Dating"),
  );

  return { subject, text, html };
}

export function waiverNudge(name: string, portalUrl: string): EmailTemplate {
  const subject = `Quick reminder, ${name.split(" ")[0]}: waiver needed`;
  const text = [
    `Hi ${name},`,
    "",
    "Just a quick reminder to sign your contestant waiver so we can confirm your spot in the show.",
    "",
    `You can sign here: ${portalUrl}`,
    "",
    "The link is valid for a limited time. Let me know if you run into any issues!",
    "",
    "Surbhi",
    "Garam Masala Dating",
  ].join("\n");

  const html = wrap(
    p(`Hi ${name},`) +
      p(
        "Just a quick reminder to sign your contestant waiver so we can confirm your spot in the show.",
      ) +
      p(`You can sign here: ${link(portalUrl, portalUrl)}`) +
      p(
        "The link is valid for a limited time. Let me know if you run into any issues!",
      ) +
      p("Surbhi<br>Garam Masala Dating"),
  );

  return { subject, text, html };
}

export function waiverReceipt(name: string): EmailTemplate {
  const subject = "We've got your waiver";
  const text = [
    `Hi ${name},`,
    "",
    "Thanks for signing your contestant waiver for Garam Masala Dating. You're all set!",
    "",
    "We'll be in touch with show day details as the date gets closer. In the meantime, feel free to reach out if you have any questions.",
    "",
    "Can't wait to have you on the show!",
    "",
    "Surbhi",
    "Garam Masala Dating",
  ].join("\n");

  const html = wrap(
    p(`Hi ${name},`) +
      p(
        "Thanks for signing your contestant waiver for Garam Masala Dating. You're all set!",
      ) +
      p(
        "We'll be in touch with show day details as the date gets closer. In the meantime, feel free to reach out if you have any questions.",
      ) +
      p("Can't wait to have you on the show!") +
      p("Surbhi<br>Garam Masala Dating"),
  );

  return { subject, text, html };
}

export function rejection(name: string): EmailTemplate {
  const subject = `Garam Masala Dating: update on your application`;
  const text = [
    `Hi ${name},`,
    "",
    "Thank you so much for applying to Garam Masala Dating and for taking the time to chat with us. We loved learning more about you.",
    "",
    "Unfortunately we're not able to move forward with your application at this time. The fit isn't quite right for the current show, but that can change, and we'd love to keep you in mind for future ones.",
    "",
    "Thank you again for your interest. It means a lot!",
    "",
    "Surbhi",
    "Garam Masala Dating",
  ].join("\n");

  const html = wrap(
    p(`Hi ${name},`) +
      p(
        "Thank you so much for applying to Garam Masala Dating and for taking the time to chat with us. We loved learning more about you.",
      ) +
      p(
        "Unfortunately we're not able to move forward with your application at this time. The fit isn't quite right for the current show, but that can change, and we'd love to keep you in mind for future ones.",
      ) +
      p("Thank you again for your interest. It means a lot!") +
      p("Surbhi<br>Garam Masala Dating"),
  );

  return { subject, text, html };
}

export function hostBriefing(interviews: InterviewSummary[]): EmailTemplate {
  const count = interviews.length;
  const subject = `Tomorrow's interviews (${count})`;

  const rows = interviews
    .map(
      (i) =>
        `${i.name} (${i.city}) at ${i.interviewTime} | ${i.calUrl}\n  "${i.pitchSnippet}"`,
    )
    .join("\n\n");

  const text = [
    `You have ${count} interview${count === 1 ? "" : "s"} scheduled for tomorrow.`,
    "",
    rows,
    "",
    "Good luck!",
  ].join("\n");

  const tableRows = interviews
    .map(
      (i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${i.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${i.city}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${i.interviewTime}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${link(i.calUrl, "View booking")}</td>
    </tr>
    <tr>
      <td colspan="4" style="padding:4px 12px 12px;border-bottom:2px solid #f0f0f0;color:#555;font-size:14px;">"${i.pitchSnippet}"</td>
    </tr>`,
    )
    .join("");

  const html = wrap(
    p(
      `You have ${count} interview${count === 1 ? "" : "s"} scheduled for tomorrow.`,
    ) +
      `<table style="width:100%;border-collapse:collapse;margin:0 0 16px;">${tableRows}</table>` +
      p("Good luck!"),
  );

  return { subject, text, html };
}

export function postShow(name: string): EmailTemplate {
  const subject = `How did it go? Garam Masala Dating`;
  const text = [
    `Hi ${name},`,
    "",
    "Thank you so much for being a contestant on Garam Masala Dating! We hope you had as much fun as we did.",
    "",
    "If you're open to it, we'd love a quick testimonial about your experience. It helps other single South Asians decide whether to apply, and your words go a long way.",
    "",
    "You can reply directly to this email with a sentence or two, or just let us know what you thought!",
    "",
    "Thanks again for being part of the show.",
    "",
    "Surbhi",
    "Garam Masala Dating",
  ].join("\n");

  const html = wrap(
    p(`Hi ${name},`) +
      p(
        "Thank you so much for being a contestant on Garam Masala Dating! We hope you had as much fun as we did.",
      ) +
      p(
        "If you're open to it, we'd love a quick testimonial about your experience. It helps other single South Asians decide whether to apply, and your words go a long way.",
      ) +
      p(
        "You can reply directly to this email with a sentence or two, or just let us know what you thought!",
      ) +
      p("Thanks again for being part of the show.") +
      p("Surbhi<br>Garam Masala Dating"),
  );

  return { subject, text, html };
}

export function applicationReceived(name: string, city: string): EmailTemplate {
  const firstName = name.split(" ")[0];
  const subject = `We got your application, ${firstName}!`;
  const text = [
    `Hi ${firstName},`,
    "",
    `Thank you so much for applying to Garam Masala Dating${city ? ` (${city})` : ""}! We're so excited you want to be on the show.`,
    "",
    "We go through applications personally and will be in touch soon. In the meantime, follow us on Instagram for show updates and behind-the-scenes content.",
    "",
    "Talk soon!",
    "",
    "Surbhi",
    "Garam Masala Dating",
  ].join("\n");

  const html = wrap(
    p(`Hi ${firstName},`) +
      p(
        `Thank you so much for applying to Garam Masala Dating${city ? ` (${city})` : ""}! We're so excited you want to be on the show.`,
      ) +
      p(
        `We go through applications personally and will be in touch soon. In the meantime, follow us on ${link("https://www.instagram.com/garammasaladating/", "@garammasaladating")} for show updates and behind-the-scenes content.`,
      ) +
      p("Talk soon!") +
      p("Surbhi<br>Garam Masala Dating"),
  );

  return { subject, text, html };
}

export function newShowAnnouncement(opts: {
  subject: string;
  city: string;
  date: string;
  venue: string;
  ticketUrl: string;
  customMessage?: string;
}): EmailTemplate {
  const { subject, city, date, venue, ticketUrl, customMessage } = opts;
  const text = [
    customMessage ?? `New show in ${city} on ${date} at ${venue}!`,
    "",
    `Grab your tickets: ${ticketUrl}`,
    "",
    "See you there!",
    "",
    "Surbhi",
    "Garam Masala Dating",
  ].join("\n");

  const html = wrap(
    p(customMessage ?? `New show in ${city} on ${date} at ${venue}!`) +
      p(`${link(ticketUrl, "Grab your tickets")} before they sell out.`) +
      p("See you there!") +
      p("Surbhi<br>Garam Masala Dating"),
  );

  return { subject, text, html };
}
