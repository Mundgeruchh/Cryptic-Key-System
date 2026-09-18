import {
  json,
  AD_STEPS_REQUIRED,
  SESSION_TTL,
  getAllKeys,
  setAllKeys,
} from "../_lib/kv.js";

export async function onRequestPost({ request, env }) {
  const { sessionId } = await request.json().catch(() => ({}));
  if (!sessionId) return json({ error: "No session" }, 400);

  const raw = await env.KV.get("session:" + sessionId);
  if (!raw) return json({ error: "Session expired, please start again" }, 400);

  const session = JSON.parse(raw);
  if (session.claimed) return json({ error: "Key already claimed" }, 400);
  if (session.steps < AD_STEPS_REQUIRED) {
    return json({ error: "Not all steps completed yet" }, 400);
  }

  const all = await getAllKeys(env);
  const entry = all.find((k) => k.status === "available");
  if (!entry) {
    return json({ error: "No keys available right now" }, 410);
  }
  entry.status = "used";
  await setAllKeys(env, all);

  session.claimed = true;
  await env.KV.put("session:" + sessionId, JSON.stringify(session), {
    expirationTtl: SESSION_TTL,
  });

  return json({ key: entry.key });
}
