import {
  json,
  checkAdminAuth,
  getAvailableKeys,
  setAvailableKeys,
} from "../../_lib/kv.js";

export async function onRequestPost({ request, env }) {
  if (!checkAdminAuth(request, env)) {
    return json({ error: "Nicht autorisiert" }, 401);
  }

  const { text } = await request.json().catch(() => ({}));
  if (typeof text !== "string") {
    return json({ error: "Keine Textdaten übermittelt" }, 400);
  }

  const newKeys = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const existing = await getAvailableKeys(env);
  const existingSet = new Set(existing);
  let added = 0;
  for (const k of newKeys) {
    if (!existingSet.has(k)) {
      existing.push(k);
      existingSet.add(k);
      added++;
    }
  }
  await setAvailableKeys(env, existing);

  const totalEver = parseInt((await env.KV.get("total_ever")) || "0", 10);
  await env.KV.put("total_ever", String(totalEver + added));

  return json({ added });
}
