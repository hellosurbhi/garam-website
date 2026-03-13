import type { Application } from "@/types/application";

export function formatLocation(app: Application): string {
  if (app.state) return `${app.city}, ${app.state}`;
  return app.city;
}
