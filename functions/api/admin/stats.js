import { json, getStats, checkAdminAuth } from "../../_lib/kv.js";

export async function onRequestGet({ request, env }) {
  if (!checkAdminAuth(request, env)) {
    return json({ error: "Nicht autorisiert" }, 401);
  }
  return json(await getStats(env));
}
