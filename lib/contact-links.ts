/**
 * Href builders for tappable contact info (mobile-first: crews call, email,
 * and navigate from their phones). Pure string helpers — safe for client and
 * server components.
 */

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}

export function mapsHref(address: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

/**
 * Only link out to http(s) URLs. Work Order URLs come from Airtable via
 * Zapier; this keeps a bad value (or anything script-like) from becoming a
 * clickable href.
 */
export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
