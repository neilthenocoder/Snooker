// Snooker marketplace (Rich, round 22): what the pages and the dashboard share.
import { html } from "./dom.js";

export const STATUS = { pending: "Waiting for approval", approved: "For sale", rejected: "Not approved", sold: "Sold" };
export const price = (a) => (a.price == null || a.price === "" ? "Price on request" : Number(a.price) === 0 ? "Free" : `£${Number(a.price).toFixed(2).replace(/\.00$/, "")}`);
export const adHref = (a) => `/marketplace/${a.no ?? a.id}`;
export const findAd = (ads, ref) => ads.find((a) => String(a.no) === String(ref) || a.id === ref);
export const statusTag = (a) => html`<span class="mk-status s-${a.status}">${STATUS[a.status] ?? a.status}</span>`;
