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

export async function getAvailableKeys(env) {
  const raw = await env.KV.get("available_keys");
  return raw ? JSON.parse(raw) : [];
}

export async function setAvailableKeys(env, arr) {
  await env.KV.put("available_keys", JSON.stringify(arr));
}

export async function getStats(env) {
  const available = await getAvailableKeys(env);
  const usedCount = parseInt((await env.KV.get("used_count")) || "0", 10);
  const totalEver = parseInt((await env.KV.get("total_ever")) || "0", 10);
  return { available: available.length, used: usedCount, totalEver };
}

export function checkAdminAuth(request, env) {
  const pass = request.headers.get("X-Admin-Pass") || "";
  return Boolean(env.ADMIN_PASS) && pass === env.ADMIN_PASS;
}
