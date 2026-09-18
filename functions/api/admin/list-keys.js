import { json, checkAdminAuth, getAllKeys } from "../../_lib/kv.js";

export async function onRequestGet({ request, env }) {
  if (!checkAdminAuth(request, env)) {
    return json({ error: "Unauthorized" }, 401);
  }
  const all = await getAllKeys(env);
  // Newest-added-looking first isn't tracked (no timestamp), so return as stored.
  return json({ keys: all });
}
