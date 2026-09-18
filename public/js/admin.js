let pass = null;

document.getElementById("login-btn").onclick = async () => {
  const val = document.getElementById("pass").value;
  const res = await fetch("/api/admin/stats", { headers: { "X-Admin-Pass": val } });
  if (res.ok) {
    pass = val;
    document.getElementById("login-card").style.display = "none";
    document.getElementById("panel").style.display = "block";
    renderStats(await res.json());
  } else {
    document.getElementById("login-error").textContent = "Falsches Passwort";
  }
};

function renderStats(data) {
  document.getElementById("stat-available").textContent = data.available;
  document.getElementById("stat-used").textContent = data.used;
  document.getElementById("stat-total").textContent = data.totalEver;
}

document.getElementById("refresh-btn").onclick = async () => {
  const res = await fetch("/api/admin/stats", { headers: { "X-Admin-Pass": pass } });
  if (res.ok) renderStats(await res.json());
};

document.getElementById("upload-btn").onclick = async () => {
  const fileInput = document.getElementById("file-input");
  const errEl = document.getElementById("upload-error");
  const okEl = document.getElementById("upload-success");
  errEl.textContent = "";
  okEl.textContent = "";
  if (!fileInput.files.length) {
    errEl.textContent = "Bitte eine Datei wählen";
    return;
  }
  const text = await fileInput.files[0].text();
  const res = await fetch("/api/admin/upload-keys", {
    method: "POST",
    headers: { "X-Admin-Pass": pass, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (res.ok) {
    okEl.textContent = data.added + " Keys hinzugefügt (Duplikate übersprungen).";
    const statsRes = await fetch("/api/admin/stats", { headers: { "X-Admin-Pass": pass } });
    if (statsRes.ok) renderStats(await statsRes.json());
  } else {
    errEl.textContent = data.error || "Fehler beim Hochladen";
  }
};
