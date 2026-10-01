export { cn } from "cn"

/** Public base URL for links and QR codes (falls back to the current origin). */
export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  return configured || window.location.origin;
}
