export interface KitSubscriberFields {
  city?: string;
  source_page?: string;
  landing_page?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export async function addKitSubscriber(
  email: string,
  tags: string[],
  fields?: KitSubscriberFields,
): Promise<void> {
  const apiSecret = import.meta.env.KIT_API_SECRET;
  if (!apiSecret) {
    // Kit not configured — log warning and bail silently
    console.warn(
      "[kit] KIT_API_SECRET not configured, skipping subscriber sync",
    );
    return;
  }

  const body: Record<string, unknown> = {
    email_address: email,
    state: "active",
  };

  if (tags.length > 0) {
    body.tags = tags;
  }

  if (fields && Object.keys(fields).length > 0) {
    body.fields = fields;
  }

  const res = await fetch("https://api.kit.com/v4/subscribers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiSecret}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    // Log but don't throw — lead capture should never fail because of Kit
    console.error(
      `[kit] Failed to add subscriber ${email}: ${res.status} ${text}`,
    );
  }
}
