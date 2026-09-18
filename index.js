// Cryptic Key System — Cloudflare Worker
// Struktur: statisches HTML (inline) + JSON-API + KV-Speicher für Keys/Sessions

const AD_STEPS_REQUIRED = 3;
const AD_WAIT_SECONDS = 20; // wie lange pro "Werbung" gewartet werden muss
const SESSION_TTL = 60 * 15; // 15 Minuten

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function html(body) {
  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function randomId(len = 24) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- KV Helpers ----------

async function getAvailableKeys(env) {
  const raw = await env.KV.get("available_keys");
  return raw ? JSON.parse(raw) : [];
}

async function setAvailableKeys(env, arr) {
  await env.KV.put("available_keys", JSON.stringify(arr));
}

async function getStats(env) {
  const available = await getAvailableKeys(env);
  const usedCount = parseInt((await env.KV.get("used_count")) || "0", 10);
  const totalEver = parseInt((await env.KV.get("total_ever")) || "0", 10);
  return {
    available: available.length,
    used: usedCount,
    totalEver,
  };
}

// ---------- Layout / Styles ----------

const BASE_STYLE = `
:root{
  --bg:#120a1f;
  --bg2:#1b1030;
  --card:#1e1233dd;
  --purple:#8b5cf6;
  --purple-dark:#6d28d9;
  --purple-light:#c4b5fd;
  --text:#eae6f7;
  --muted:#9d93b8;
  --danger:#f87171;
  --success:#34d399;
}
*{box-sizing:border-box;}
body{
  margin:0;
  min-height:100vh;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  color:var(--text);
  background:
    radial-gradient(circle at 20% 20%, #4c1d9533, transparent 40%),
    radial-gradient(circle at 80% 0%, #7c3aed33, transparent 45%),
    radial-gradient(circle at 50% 100%, #9333ea22, transparent 50%),
    var(--bg);
  display:flex;
  flex-direction:column;
  align-items:center;
  padding:40px 16px;
}
.wrap{width:100%;max-width:520px;}
.logo{
  text-align:center;
  font-size:28px;
  font-weight:800;
  letter-spacing:0.5px;
  margin-bottom:6px;
  background:linear-gradient(90deg,var(--purple-light),var(--purple));
  -webkit-background-clip:text;
  background-clip:text;
  color:transparent;
}
.logo span{opacity:.6;font-weight:500;}
.subtitle{text-align:center;color:var(--muted);margin-bottom:32px;font-size:14px;}
.card{
  background:var(--card);
  border:1px solid #ffffff14;
  border-radius:18px;
  padding:28px;
  backdrop-filter:blur(6px);
  box-shadow:0 10px 40px #00000055;
  margin-bottom:20px;
}
.card h2{margin-top:0;font-size:18px;}
.steps{display:flex;gap:8px;margin-bottom:24px;}
.step-dot{
  flex:1;height:6px;border-radius:4px;background:#ffffff1a;overflow:hidden;
}
.step-dot.active{background:linear-gradient(90deg,var(--purple-dark),var(--purple));}
.step-dot.done{background:var(--success);}
button{
  width:100%;
  padding:14px;
  border:none;
  border-radius:12px;
  font-size:15px;
  font-weight:700;
  cursor:pointer;
  background:linear-gradient(135deg,var(--purple),var(--purple-dark));
  color:white;
  transition:transform .15s, opacity .15s;
}
button:disabled{opacity:.4;cursor:not-allowed;}
button:not(:disabled):hover{transform:translateY(-1px);}
input[type=text],input[type=password],input[type=file]{
  width:100%;
  padding:12px 14px;
  border-radius:10px;
  border:1px solid #ffffff22;
  background:#0f0a1c;
  color:var(--text);
  font-size:14px;
  margin-bottom:14px;
}
.ad-slot{
  background:#0f0a1c;
  border:1px dashed #ffffff33;
  border-radius:14px;
  min-height:220px;
  display:flex;
  align-items:center;
  justify-content:center;
  color:var(--muted);
  font-size:13px;
  text-align:center;
  margin-bottom:18px;
  padding:16px;
}
.timer{
  text-align:center;
  font-size:32px;
  font-weight:800;
  color:var(--purple-light);
  margin-bottom:14px;
  font-variant-numeric:tabular-nums;
}
.key-box{
  background:#0f0a1c;
  border:1px solid var(--purple);
  border-radius:12px;
  padding:16px;
  font-family:monospace;
  font-size:18px;
  text-align:center;
  letter-spacing:1px;
  margin-bottom:16px;
  word-break:break-all;
}
.error{color:var(--danger);font-size:13px;margin-bottom:12px;}
.success-text{color:var(--success);font-size:13px;margin-bottom:12px;}
.muted{color:var(--muted);font-size:13px;}
.stats-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:22px;}
.stat{
  background:#0f0a1c;
  border:1px solid #ffffff14;
  border-radius:12px;
  padding:14px 8px;
  text-align:center;
}
.stat .num{font-size:22px;font-weight:800;color:var(--purple-light);}
.stat .label{font-size:11px;color:var(--muted);margin-top:4px;}
a.link{color:var(--purple-light);}
.footer{margin-top:20px;text-align:center;font-size:12px;color:var(--muted);}
`;

// ---------- Public page ----------

function publicPage(env) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cryptic Key System</title>
<style>${BASE_STYLE}</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Cryptic <span>Key System</span></div>
  <div class="subtitle">Bestätige, dass du kein Bot bist, schau dir kurz Werbung an und erhalte deinen Key.</div>

  <div class="steps">
    <div class="step-dot" id="dot-0"></div>
    <div class="step-dot" id="dot-1"></div>
    <div class="step-dot" id="dot-2"></div>
    <div class="step-dot" id="dot-3"></div>
  </div>

  <div class="card" id="stage-verify">
    <h2>1. Bot-Bestätigung</h2>
    <div id="turnstile-container" style="margin-bottom:16px;"></div>
    <div class="error" id="verify-error"></div>
  </div>

  <div class="card" id="stage-ads" style="display:none;">
    <h2 id="ad-title">2. Werbung ansehen</h2>
    <div class="ad-slot" id="ad-slot">
      <!-- HIER dein Ad-Network Script/Direct-Link einbauen -->
      Werbeplatz (Platzhalter) — hier kommt dein Ad-Network Code rein
    </div>
    <div class="timer" id="ad-timer">${AD_WAIT_SECONDS}</div>
    <button id="ad-continue-btn" disabled>Warte...</button>
    <div class="error" id="ad-error"></div>
  </div>

  <div class="card" id="stage-key" style="display:none;">
    <h2>🎉 Dein Key</h2>
    <div class="key-box" id="key-value">...</div>
    <button id="copy-btn">Key kopieren</button>
    <div class="success-text" id="copy-msg" style="margin-top:10px;"></div>
  </div>

  <div class="footer">Cryptic Key System</div>
</div>

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script>
const SITEKEY = ${JSON.stringify(env.TURNSTILE_SITEKEY || "")};
const REQUIRED_STEPS = ${AD_STEPS_REQUIRED};
const WAIT_SECONDS = ${AD_WAIT_SECONDS};

let sessionId = null;
let currentStep = 0;

function setDot(i, cls){ document.getElementById('dot-'+i).className = 'step-dot '+cls; }
setDot(0,'active');

window.onTurnstileSuccess = async function(token){
  document.getElementById('verify-error').textContent = '';
  try{
    const res = await fetch('/api/verify-turnstile', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Verifizierung fehlgeschlagen');
    sessionId = data.sessionId;
    setDot(0,'done');
    document.getElementById('stage-verify').style.display='none';
    document.getElementById('stage-ads').style.display='block';
    startAdStep();
  }catch(e){
    document.getElementById('verify-error').textContent = e.message;
  }
};

function renderTurnstile(){
  if(window.turnstile && SITEKEY){
    turnstile.render('#turnstile-container', {
      sitekey: SITEKEY,
      theme: 'dark',
      callback: window.onTurnstileSuccess
    });
  } else {
    setTimeout(renderTurnstile, 300);
  }
}
renderTurnstile();

function startAdStep(){
  currentStep++;
  setDot(currentStep,'active');
  document.getElementById('ad-title').textContent = '2. Werbung ansehen ('+currentStep+'/'+REQUIRED_STEPS+')';
  const btn = document.getElementById('ad-continue-btn');
  btn.disabled = true;
  btn.textContent = 'Warte...';
  let remaining = WAIT_SECONDS;
  document.getElementById('ad-timer').textContent = remaining;
  const iv = setInterval(()=>{
    remaining--;
    document.getElementById('ad-timer').textContent = Math.max(remaining,0);
    if(remaining<=0){
      clearInterval(iv);
      btn.disabled = false;
      btn.textContent = currentStep < REQUIRED_STEPS ? 'Weiter' : 'Key erhalten';
    }
  },1000);

  btn.onclick = async () => {
    btn.disabled = true;
    try{
      const res = await fetch('/api/ad-step', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sessionId })
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Fehler');
      setDot(currentStep,'done');
      if(data.steps >= REQUIRED_STEPS){
        await claimKey();
      } else {
        startAdStep();
      }
    }catch(e){
      document.getElementById('ad-error').textContent = e.message;
      btn.disabled = false;
    }
  };
}

async function claimKey(){
  try{
    const res = await fetch('/api/claim-key', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ sessionId })
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Kein Key verfügbar');
    document.getElementById('stage-ads').style.display='none';
    document.getElementById('stage-key').style.display='block';
    document.getElementById('key-value').textContent = data.key;
    setDot(REQUIRED_STEPS+1,'done');
  }catch(e){
    document.getElementById('ad-error').textContent = e.message;
  }
}

document.getElementById('copy-btn').onclick = () => {
  navigator.clipboard.writeText(document.getElementById('key-value').textContent);
  document.getElementById('copy-msg').textContent = 'Kopiert!';
};
</script>
</body>
</html>`;
}

// ---------- Admin page ----------

function adminPage() {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin — Cryptic Key System</title>
<style>${BASE_STYLE}</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Cryptic <span>Admin</span></div>

  <div class="card" id="login-card">
    <h2>Admin-Login</h2>
    <input type="password" id="pass" placeholder="Admin-Passwort">
    <button id="login-btn">Einloggen</button>
    <div class="error" id="login-error"></div>
  </div>

  <div id="panel" style="display:none;">
    <div class="card">
      <h2>Statistik</h2>
      <div class="stats-grid">
        <div class="stat"><div class="num" id="stat-available">-</div><div class="label">Verfügbar</div></div>
        <div class="stat"><div class="num" id="stat-used">-</div><div class="label">Verbraucht</div></div>
        <div class="stat"><div class="num" id="stat-total">-</div><div class="label">Gesamt jemals</div></div>
      </div>
      <button id="refresh-btn">Aktualisieren</button>
    </div>

    <div class="card">
      <h2>Neue Keys hochladen (.txt, 1 Key pro Zeile)</h2>
      <input type="file" id="file-input" accept=".txt">
      <button id="upload-btn">Hochladen</button>
      <div class="error" id="upload-error"></div>
      <div class="success-text" id="upload-success"></div>
    </div>
  </div>
</div>

<script>
let pass = null;

document.getElementById('login-btn').onclick = async () => {
  const val = document.getElementById('pass').value;
  const res = await fetch('/api/admin/stats', { headers: { 'X-Admin-Pass': val } });
  if(res.ok){
    pass = val;
    document.getElementById('login-card').style.display='none';
    document.getElementById('panel').style.display='block';
    const data = await res.json();
    renderStats(data);
  } else {
    document.getElementById('login-error').textContent = 'Falsches Passwort';
  }
};

function renderStats(data){
  document.getElementById('stat-available').textContent = data.available;
  document.getElementById('stat-used').textContent = data.used;
  document.getElementById('stat-total').textContent = data.totalEver;
}

document.getElementById('refresh-btn').onclick = async () => {
  const res = await fetch('/api/admin/stats', { headers: { 'X-Admin-Pass': pass } });
  if(res.ok) renderStats(await res.json());
};

document.getElementById('upload-btn').onclick = async () => {
  const fileInput = document.getElementById('file-input');
  const errEl = document.getElementById('upload-error');
  const okEl = document.getElementById('upload-success');
  errEl.textContent=''; okEl.textContent='';
  if(!fileInput.files.length){ errEl.textContent = 'Bitte eine Datei wählen'; return; }
  const text = await fileInput.files[0].text();
  const res = await fetch('/api/admin/upload-keys', {
    method:'POST',
    headers: { 'X-Admin-Pass': pass, 'Content-Type':'application/json' },
    body: JSON.stringify({ text })
  });
  const data = await res.json();
  if(res.ok){
    okEl.textContent = data.added + ' Keys hinzugefügt (Duplikate übersprungen).';
    const statsRes = await fetch('/api/admin/stats', { headers: { 'X-Admin-Pass': pass } });
    if(statsRes.ok) renderStats(await statsRes.json());
  } else {
    errEl.textContent = data.error || 'Fehler beim Hochladen';
  }
};
</script>
</body>
</html>`;
}

// ---------- Worker entry ----------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // --- Public pages ---
    if (path === "/" && request.method === "GET") {
      return html(publicPage(env));
    }
    if (path === "/admin" && request.method === "GET") {
      return html(adminPage());
    }

    // --- Public API ---
    if (path === "/api/verify-turnstile" && request.method === "POST") {
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

    if (path === "/api/ad-step" && request.method === "POST") {
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

    if (path === "/api/claim-key" && request.method === "POST") {
      const { sessionId } = await request.json().catch(() => ({}));
      if (!sessionId) return json({ error: "Keine Session" }, 400);
      const raw = await env.KV.get("session:" + sessionId);
      if (!raw) return json({ error: "Session abgelaufen, bitte neu starten" }, 400);
      const session = JSON.parse(raw);
      if (session.claimed) return json({ error: "Key bereits abgeholt" }, 400);
      if (session.steps < AD_STEPS_REQUIRED) {
        return json({ error: "Noch nicht alle Schritte abgeschlossen" }, 400);
      }

      // Key aus dem Pool ziehen (atomar genug für KV-Nutzung im kleinen Maßstab)
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

    // --- Admin API (geschützt durch ADMIN_PASS Header) ---
    if (path.startsWith("/api/admin/")) {
      const pass = request.headers.get("X-Admin-Pass") || "";
      if (!env.ADMIN_PASS || pass !== env.ADMIN_PASS) {
        return json({ error: "Nicht autorisiert" }, 401);
      }

      if (path === "/api/admin/stats" && request.method === "GET") {
        return json(await getStats(env));
      }

      if (path === "/api/admin/upload-keys" && request.method === "POST") {
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

      return json({ error: "Unbekannter Endpunkt" }, 404);
    }

    return new Response("Not found", { status: 404 });
  },
};
