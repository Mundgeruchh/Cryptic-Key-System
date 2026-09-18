import {
  json,
  AD_STEPS_REQUIRED,
  SESSION_TTL,
  getAllKeys,
  setAllKeys,
  sendDiscordEmbeds,
  formatDuration,
} from "../_lib/kv.js";

const WARNING_THRESHOLDS = [10, 5, 0];

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

  const remainingAfter = all.filter((k) => k.status === "available").length;
  const durationMs = Date.now() - (session.createdAt || Date.now());
  const userAgent = request.headers.get("User-Agent") || "Unknown";
  const country = request.headers.get("CF-IPCountry") || "Unknown";

  // Fire-and-forget logging embed for the issued key
  await sendDiscordEmbeds(env, [
    {
      title: "🔑 Key issued",
      color: 0x8b5cf6,
      fields: [
        { name: "Key", value: `||${entry.key}||`, inline: false },
        { name: "Time taken", value: formatDuration(durationMs), inline: true },
        { name: "Remaining after this", value: String(remainingAfter), inline: true },
        { name: "Browser / User-Agent", value: "```" + userAgent.slice(0, 500) + "```", inline: false },
        { name: "Country", value: country, inline: true },
      ],
      timestamp: new Date().toISOString(),
    },
  ]);

  // Low-stock warnings, fired only when we just crossed a threshold
  if (WARNING_THRESHOLDS.includes(remainingAfter)) {
    const isEmpty = remainingAfter === 0;
    await sendDiscordEmbeds(env, [
      {
        title: isEmpty ? "🚨 Out of keys!" : "⚠️ Low key stock",
        description: isEmpty
          ? "There are **no keys left** in the pool. Upload more via /admin as soon as possible."
          : `Only **${remainingAfter} keys** left in the pool. Consider uploading more soon.`,
        color: isEmpty ? 0xf87171 : 0xfbbf24,
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  return json({ key: entry.key });
}
