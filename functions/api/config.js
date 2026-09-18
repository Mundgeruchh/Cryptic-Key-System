import { json } from "../_lib/kv.js";

export async function onRequestGet({ env }) {
  return json({ turnstileSitekey: env.TURNSTILE_SITEKEY || "" });
}
