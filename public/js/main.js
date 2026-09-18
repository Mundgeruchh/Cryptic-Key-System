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
    if (!res.ok) throw new Error(data.error || "Verification failed");
    sessionId = data.sessionId;
    setDot(0, "done");
    document.getElementById("stage-verify").style.display = "none";
    document.getElementById("stage-ads").style.display = "block";
    startAdStep();
  } catch (e) {
    document.getElementById("verify-error").textContent = e.message;
  }
}

// ---------- Mini-tasks ----------
// Each task renders into #ad-slot and calls onSolved() once completed correctly.

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const EMOJI_POOL = ["🍎","🍋","🍇","🍉","🍓","🍒","🍑","🥝","🍍","🥥","⭐","🔥","💎","🎯","🎈","🍀"];

function renderPatternTask(container, onSolved) {
  const base = EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];
  const filler = EMOJI_POOL.filter((e) => e !== base)[Math.floor(Math.random() * (EMOJI_POOL.length - 1))];
  const missingIndex = 2;
  const sequence = [base, base, null, base, base]; // simple repeating pattern with a gap
  sequence[missingIndex] = null;

  const options = shuffle([base, filler, EMOJI_POOL[(EMOJI_POOL.indexOf(base) + 3) % EMOJI_POOL.length]]);

  container.innerHTML = `
    <div class="task-title">Click the emoji that completes the pattern</div>
    <div class="emoji-row">
      ${sequence.map((e) => `<div class="emoji-cell ${e === null ? "empty" : ""}">${e ?? "?"}</div>`).join("")}
    </div>
    <div class="emoji-options">
      ${options.map((e) => `<button class="emoji-option" data-val="${e}">${e}</button>`).join("")}
    </div>
    <div class="task-feedback" id="task-feedback"></div>
  `;

  container.querySelectorAll(".emoji-option").forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.val === base) {
        onSolved();
      } else {
        document.getElementById("task-feedback").textContent = "Not quite, try again.";
        btn.classList.add("shake");
        setTimeout(() => btn.classList.remove("shake"), 300);
      }
    };
  });
}

function renderOddOneOutTask(container, onSolved) {
  const common = EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];
  const odd = EMOJI_POOL.filter((e) => e !== common)[Math.floor(Math.random() * (EMOJI_POOL.length - 1))];
  const cells = shuffle(Array(8).fill(common).concat([odd]));

  container.innerHTML = `
    <div class="task-title">Click the odd emoji out</div>
    <div class="emoji-grid">
      ${cells.map((e) => `<button class="emoji-cell-btn" data-val="${e}">${e}</button>`).join("")}
    </div>
    <div class="task-feedback" id="task-feedback"></div>
  `;

  container.querySelectorAll(".emoji-cell-btn").forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.val === odd) {
        onSolved();
      } else {
        document.getElementById("task-feedback").textContent = "That's not it, keep looking.";
      }
    };
  });
}

function renderMemoryTask(container, onSolved) {
  const chosen = shuffle(EMOJI_POOL).slice(0, 4);
  const gridEmojis = shuffle(chosen.concat(shuffle(EMOJI_POOL.filter((e) => !chosen.includes(e))).slice(0, 4)));
  let clickedOrder = [];

  container.innerHTML = `
    <div class="task-title">Memorize the order, then click them in the same order</div>
    <div class="emoji-row" id="memory-preview">
      ${chosen.map((e) => `<div class="emoji-cell">${e}</div>`).join("")}
    </div>
    <div class="task-feedback" id="task-feedback">Memorizing...</div>
  `;

  setTimeout(() => {
    document.getElementById("memory-preview").innerHTML = chosen.map(() => `<div class="emoji-cell empty">?</div>`).join("");
    document.getElementById("task-feedback").textContent = "Now click the emojis in the order you saw them.";

    const grid = document.createElement("div");
    grid.className = "emoji-grid";
    grid.innerHTML = gridEmojis.map((e) => `<button class="emoji-cell-btn" data-val="${e}">${e}</button>`).join("");
    container.appendChild(grid);

    grid.querySelectorAll(".emoji-cell-btn").forEach((btn) => {
      btn.onclick = () => {
        clickedOrder.push(btn.dataset.val);
        btn.disabled = true;
        btn.classList.add("picked");
        const expected = chosen[clickedOrder.length - 1];
        if (btn.dataset.val !== expected) {
          document.getElementById("task-feedback").textContent = "Wrong order — restarting task.";
          setTimeout(() => renderMemoryTask(container, onSolved), 900);
          return;
        }
        if (clickedOrder.length === chosen.length) {
          onSolved();
        }
      };
    });
  }, 2200);
}

const TASKS = [renderPatternTask, renderOddOneOutTask, renderMemoryTask];

function startAdStep() {
  currentStep++;
  setDot(currentStep, "active");
  document.getElementById("ad-title").textContent =
    "2. Complete the task (" + currentStep + "/" + AD_STEPS_REQUIRED + ")";

  // Direct-link ad opens in a new tab alongside the task
  window.open(DIRECT_LINK, "_blank");

  const container = document.getElementById("ad-slot");
  const btn = document.getElementById("ad-continue-btn");
  btn.disabled = true;
  btn.textContent = "Complete the task above";

  const taskFn = TASKS[(currentStep - 1) % TASKS.length];
  taskFn(container, () => {
    btn.disabled = false;
    btn.textContent = currentStep < AD_STEPS_REQUIRED ? "Continue" : "Get my key";
  });

  btn.onclick = async () => {
    btn.disabled = true;
    try {
      const res = await fetch("/api/ad-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
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
    if (!res.ok) throw new Error(data.error || "No key available");
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
  document.getElementById("copy-msg").textContent = "Copied!";
};

loadConfig();

