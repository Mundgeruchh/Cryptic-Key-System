import {
  json,
  checkAdminAuth,
  getAllKeys,
  setAllKeys,
} from "../../_lib/kv.js";

export async function onRequestPost({ request, env }) {
  if (!checkAdminAuth(request, env)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const { text } = await request.json().catch(() => ({}));
  if (typeof text !== "string") {
    return json({ error: "No text data submitted" }, 400);
  }

  const newKeys = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const all = await getAllKeys(env);
  const existingSet = new Set(all.map((k) => k.key));
  let added = 0;
  for (const k of newKeys) {
    if (!existingSet.has(k)) {
      all.push({ key: k, status: "available" });
      existingSet.add(k);
      added++;
    }
  }
  await setAllKeys(env, all);

  return json({ added });
}
