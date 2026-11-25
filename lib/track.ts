import { apiClient } from "@/lib/api/client";

/** Funnel events the browser may send (the API rejects anything else). */
export type ClientEvent = "upgrade_view" | "upgrade_click" | "paid_click" | "ask_click" | "share_click";

/**
 * Records a funnel event. Fire-and-forget: never awaited, never throws, and
 * `keepalive` lets it finish when the click navigates away (to WhatsApp or
 * the Premium page).
 */
export function track(name: ClientEvent, props?: Record<string, string | number | boolean>) {
  apiClient("/api/events", {
    method: "POST",
    body: JSON.stringify({ name, props }),
    keepalive: true,
    on401: "throw",
  }).catch(() => {});
}
