import { json, randomId, SESSION_TTL } from "../_lib/kv.js";

export async function onRequestPost({ request, env }) {
  const { token } = await request.json().catch(() => ({}));
  if (!token) return json({ error: "Kein Token übermittelt" }, 400);

  const ip = request.headers.get("CF-Connecting-IP") || "";
  const verifyRes = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET,
        response: token,
        remoteip: ip,
      }),
    }
  );
  const verifyData = await verifyRes.json();
  if (!verifyData.success) {
    return json({ error: "Bot-Verifizierung fehlgeschlagen" }, 400);
  }

  const sessionId = randomId();
  await env.KV.put(
    "session:" + sessionId,
    JSON.stringify({ steps: 0, claimed: false }),
    { expirationTtl: SESSION_TTL }
  );
  return json({ sessionId });
}
