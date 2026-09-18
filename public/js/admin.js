let pass = null;
let allKeys = [];
let currentFilter = "all";
let pendingFile = null;

// ---------- Login ----------

document.getElementById("login-btn").onclick = async () => {
  const val = document.getElementById("pass").value;
  const res = await fetch("/api/admin/stats", { headers: { "X-Admin-Pass": val } });
  if (res.ok) {
    pass = val;
    document.getElementById("login-card").style.display = "none";
    document.getElementById("panel").style.display = "block";
    renderStats(await res.json());
    loadKeys();
  } else {
    document.getElementById("login-error").textContent = "Wrong password";
  }
};

// ---------- Stats ----------

function renderStats(data) {
  document.getElementById("stat-available").textContent = data.available;
  document.getElementById("stat-used").textContent = data.used;
  document.getElementById("stat-total").textContent = data.totalEver;
}

document.getElementById("refresh-btn").onclick = async () => {
  const res = await fetch("/api/admin/stats", { headers: { "X-Admin-Pass": pass } });
  if (res.ok) renderStats(await res.json());
  loadKeys();
};

// ---------- Drag & drop upload ----------

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const selectedFileBox = document.getElementById("selected-file");
const selectedFileName = document.getElementById("selected-file-name");
const uploadBtn = document.getElementById("upload-btn");

dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  if (e.dataTransfer.files.length) {
    setSelectedFile(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) setSelectedFile(fileInput.files[0]);
});

function setSelectedFile(file) {
  if (!file.name.toLowerCase().endsWith(".txt")) {
    document.getElementById("upload-error").textContent = "Please select a .txt file";
    return;
  }
  document.getElementById("upload-error").textContent = "";
  pendingFile = file;
  selectedFileName.textContent = file.name;
  selectedFileBox.style.display = "flex";
  uploadBtn.disabled = false;
}

document.getElementById("clear-file-btn").onclick = () => {
  pendingFile = null;
  fileInput.value = "";
  selectedFileBox.style.display = "none";
  uploadBtn.disabled = true;
};

uploadBtn.onclick = async () => {
  const errEl = document.getElementById("upload-error");
  const okEl = document.getElementById("upload-success");
  errEl.textContent = "";
  okEl.textContent = "";
  if (!pendingFile) {
    errEl.textContent = "Please select a file first";
    return;
  }
  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";
  try {
    const text = await pendingFile.text();
    const res = await fetch("/api/admin/upload-keys", {
      method: "POST",
      headers: { "X-Admin-Pass": pass, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (res.ok) {
      okEl.textContent = data.added + " keys added (duplicates skipped).";
      pendingFile = null;
      fileInput.value = "";
      selectedFileBox.style.display = "none";
      const statsRes = await fetch("/api/admin/stats", { headers: { "X-Admin-Pass": pass } });
      if (statsRes.ok) renderStats(await statsRes.json());
      loadKeys();
    } else {
      errEl.textContent = data.error || "Upload failed";
    }
  } finally {
    uploadBtn.disabled = pendingFile === null;
    uploadBtn.textContent = "Upload keys";
  }
};

// ---------- Key list ----------

async function loadKeys() {
  const listEl = document.getElementById("key-list");
  const res = await fetch("/api/admin/list-keys", { headers: { "X-Admin-Pass": pass } });
  if (!res.ok) {
    listEl.innerHTML = '<div class="error">Failed to load keys.</div>';
    return;
  }
  const data = await res.json();
  allKeys = data.keys || [];
  renderKeyList();
}

function renderKeyList() {
  const listEl = document.getElementById("key-list");
  const filtered = allKeys.filter((k) => currentFilter === "all" || k.status === currentFilter);

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="muted" style="padding:12px 0;">No keys to show.</div>';
    return;
  }

  listEl.innerHTML = filtered
    .map(
      (k) => `
      <div class="key-row">
        <span class="key-text">${escapeHtml(k.key)}</span>
        <span class="tag ${k.status === "available" ? "tag-available" : "tag-used"}">
          ${k.status === "available" ? "Available" : "Used"}
        </span>
      </div>`
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderKeyList();
  };
});
