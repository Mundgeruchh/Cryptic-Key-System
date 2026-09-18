const AD_WAIT_SECONDS = 20;
const AD_STEPS_REQUIRED = 3;
const DIRECT_LINK = "https://omg10.com/4/11830115";

let sessionId = null;
let currentStep = 0;
let sitekey = "";

function setDot(i, cls) {
  document.getElementById("dot-" + i).className = "step-dot " + cls;
}
setDot(0, "active");

async function loadConfig() {
  const res = await fetch("/api/config");
  const data = await res.json();
  sitekey = data.turnstileSitekey;
  renderTurnstile();
}

function renderTurnstile() {
  if (window.turnstile && sitekey) {
    turnstile.render("#turnstile-container", {
      sitekey,
      theme: "dark",
      callback: onTurnstileSuccess,
    });
  } else {
    setTimeout(renderTurnstile, 300);
  }
}

async function onTurnstileSuccess(token) {
  document.getElementById("verify-error").textContent = "";
  try {
    const res = await fetch("/api/verify-turnstile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Verifizierung fehlgeschlagen");
    sessionId = data.sessionId;
    setDot(0, "done");
    document.getElementById("stage-verify").style.display = "none";
    document.getElementById("stage-ads").style.display = "block";
    startAdStep();
  } catch (e) {
    document.getElementById("verify-error").textContent = e.message;
  }
}

function startAdStep() {
  currentStep++;
  setDot(currentStep, "active");
  document.getElementById("ad-title").textContent =
    "2. Werbung ansehen (" + currentStep + "/" + AD_STEPS_REQUIRED + ")";

  // Direct-Link-Werbung: öffnet sich in einem neuen Tab, während der Timer hier läuft
  window.open(DIRECT_LINK, "_blank");

  const btn = document.getElementById("ad-continue-btn");
  btn.disabled = true;
  btn.textContent = "Warte...";

  let remaining = AD_WAIT_SECONDS;
  document.getElementById("ad-timer").textContent = remaining;
  const iv = setInterval(() => {
    remaining--;
    document.getElementById("ad-timer").textContent = Math.max(remaining, 0);
    if (remaining <= 0) {
      clearInterval(iv);
      btn.disabled = false;
      btn.textContent = currentStep < AD_STEPS_REQUIRED ? "Weiter" : "Key erhalten";
    }
  }, 1000);

  btn.onclick = async () => {
    btn.disabled = true;
    try {
      const res = await fetch("/api/ad-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      setDot(currentStep, "done");
      if (data.steps >= AD_STEPS_REQUIRED) {
        await claimKey();
      } else {
        startAdStep();
      }
    } catch (e) {
      document.getElementById("ad-error").textContent = e.message;
      btn.disabled = false;
    }
  };
}

async function claimKey() {
  try {
    const res = await fetch("/api/claim-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Kein Key verfügbar");
    document.getElementById("stage-ads").style.display = "none";
    document.getElementById("stage-key").style.display = "block";
    document.getElementById("key-value").textContent = data.key;
    setDot(AD_STEPS_REQUIRED + 1, "done");
  } catch (e) {
    document.getElementById("ad-error").textContent = e.message;
  }
}

document.getElementById("copy-btn").onclick = () => {
  navigator.clipboard.writeText(document.getElementById("key-value").textContent);
  document.getElementById("copy-msg").textContent = "Kopiert!";
};

loadConfig();
