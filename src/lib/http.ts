import { z } from "zod";

export interface InvalidRequestDetails {
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
}

export function jsonResponse(
  data: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  const responseHeaders = new Headers(headers);
  if (!responseHeaders.has("Content-Type")) {
    responseHeaders.set("Content-Type", "application/json");
  }

  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders,
  });
}

export function invalidRequestResponse(
  details: InvalidRequestDetails,
): Response {
  return jsonResponse({ error: "Invalid request", details }, 400);
}

function invalidRequestDetails(message: string): InvalidRequestDetails {
  return {
    formErrors: [message],
    fieldErrors: {},
  };
}

export async function parseJsonRequest<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
): Promise<
  | { success: true; data: z.infer<TSchema> }
  | { success: false; response: Response }
> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return {
      success: false,
      response: invalidRequestResponse(
        invalidRequestDetails("Expected application/json"),
      ),
    };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: invalidRequestResponse(
        invalidRequestDetails("Malformed JSON body"),
      ),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      success: false,
      response: invalidRequestResponse(z.flattenError(parsed.error)),
    };
  }

  return { success: true, data: parsed.data };
}
