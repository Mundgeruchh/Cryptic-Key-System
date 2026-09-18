// Gemeinsame KV-Helfer, genutzt von mehreren /functions/api/*.js Dateien.
// Dateien mit führendem "_" werden von Cloudflare Pages NICHT als Routen behandelt.

export const AD_STEPS_REQUIRED = 3;
export const SESSION_TTL = 60 * 15; // 15 Minuten

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function randomId(len = 24) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// All keys are stored as one array of { key, status } objects under "keys_list".
// status is "available" or "used".

export async function getAllKeys(env) {
  const raw = await env.KV.get("keys_list");
  return raw ? JSON.parse(raw) : [];
}

export async function setAllKeys(env, arr) {
  await env.KV.put("keys_list", JSON.stringify(arr));
}

export async function getStats(env) {
  const all = await getAllKeys(env);
  const available = all.filter((k) => k.status === "available").length;
  const used = all.filter((k) => k.status === "used").length;
  return { available, used, totalEver: all.length };
}

export function checkAdminAuth(request, env) {
  const pass = request.headers.get("X-Admin-Pass") || "";
  return Boolean(env.ADMIN_PASS) && pass === env.ADMIN_PASS;
}

// ---------- Discord webhook logging ----------

export async function sendDiscordEmbeds(env, embeds) {
  if (!env.KEY_LOGS) return; // webhook not configured, silently skip
  try {
    await fetch(env.KEY_LOGS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds }),
    });
  } catch (e) {
    // Never let a webhook failure break key issuance
  }
}

export function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
