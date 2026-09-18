import { json, AD_STEPS_REQUIRED, SESSION_TTL } from "../_lib/kv.js";

export async function onRequestPost({ request, env }) {
  const { sessionId } = await request.json().catch(() => ({}));
  if (!sessionId) return json({ error: "Keine Session" }, 400);

  const raw = await env.KV.get("session:" + sessionId);
  if (!raw) return json({ error: "Session abgelaufen, bitte neu starten" }, 400);

  const session = JSON.parse(raw);
  if (session.claimed) return json({ error: "Bereits abgeschlossen" }, 400);

  session.steps = Math.min(session.steps + 1, AD_STEPS_REQUIRED);
  await env.KV.put("session:" + sessionId, JSON.stringify(session), {
    expirationTtl: SESSION_TTL,
  });

  return json({ steps: session.steps });
}
