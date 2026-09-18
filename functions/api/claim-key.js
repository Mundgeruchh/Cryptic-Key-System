import {
  json,
  AD_STEPS_REQUIRED,
  SESSION_TTL,
  getAvailableKeys,
  setAvailableKeys,
} from "../_lib/kv.js";

export async function onRequestPost({ request, env }) {
  const { sessionId } = await request.json().catch(() => ({}));
  if (!sessionId) return json({ error: "Keine Session" }, 400);

  const raw = await env.KV.get("session:" + sessionId);
  if (!raw) return json({ error: "Session abgelaufen, bitte neu starten" }, 400);

  const session = JSON.parse(raw);
  if (session.claimed) return json({ error: "Key bereits abgeholt" }, 400);
  if (session.steps < AD_STEPS_REQUIRED) {
    return json({ error: "Noch nicht alle Schritte abgeschlossen" }, 400);
  }

  const available = await getAvailableKeys(env);
  if (available.length === 0) {
    return json({ error: "Aktuell sind keine Keys mehr verfügbar" }, 410);
  }
  const key = available.shift();
  await setAvailableKeys(env, available);

  const usedCount = parseInt((await env.KV.get("used_count")) || "0", 10);
  await env.KV.put("used_count", String(usedCount + 1));

  session.claimed = true;
  await env.KV.put("session:" + sessionId, JSON.stringify(session), {
    expirationTtl: SESSION_TTL,
  });

  return json({ key });
}
