const $ = (id) => document.getElementById(id);
const gb = (b) => (b / 1073741824).toFixed(1);
const lines = (v) => v.split("\n").map((x) => x.trim().toLowerCase()).filter(Boolean);
let msgTimer;
function say(t) { $("msg").textContent = t; clearTimeout(msgTimer); msgTimer = setTimeout(() => ($("msg").textContent = ""), 4000); }

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function btn(label, fn) { const b = el("button", "sm", label); b.addEventListener("click", fn); return b; }

/* ---------- navigasi ---------- */
document.querySelectorAll("nav button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll("nav button").forEach((x) => x.classList.toggle("on", x === b));
  document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.id !== b.dataset.panel));
  if (b.dataset.panel === "tabs") renderTabs();
}));

/* ---------- grafik ---------- */
function spark(canvas, data) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  c.strokeStyle = css.getPropertyValue("--line"); c.lineWidth = dpr;
  [0.25, 0.5, 0.75].forEach((f) => { c.beginPath(); c.moveTo(0, h * f); c.lineTo(w, h * f); c.stroke(); });
  if (data.length < 2) return;
  c.beginPath();
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * w, y = h - (v / 100) * h;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  });
  c.strokeStyle = css.getPropertyValue("--accent"); c.lineWidth = 1.6 * dpr; c.stroke();
}

/* ---------- RAM realtime ---------- */
const live = [];
async function tickMem() {
  const m = await chrome.system.memory.getInfo();
  const used = m.capacity - m.availableCapacity;
  const pct = Math.round((used / m.capacity) * 100);
  $("memText").textContent = `${gb(used)} / ${gb(m.capacity)} GB`;
  $("memPct").textContent = pct + "%";
  $("memBar").style.width = pct + "%";
  $("memBar").classList.toggle("hot", pct >= 85);
  live.push(pct); if (live.length > 60) live.shift();
  spark($("live"), live);
}

async function renderHome() {
  const [awake, asleep, ses, st, pol] = await Promise.all([
    chrome.tabs.query({ discarded: false }),
    chrome.tabs.query({ discarded: true }),
    chrome.storage.session.get(null),
    getSettings(),
    chrome.runtime.sendMessage({ type: "policy" })
  ]);
  $("open").textContent = awake.length;
  $("sleeping").textContent = asleep.length;
  const est = asleep.reduce((a, t) => a + (ses["heap:" + t.id] ?? 50) + 30, 0);
  $("saved").textContent = est >= 1024 ? (est / 1024).toFixed(1) + " GB" : est + " MB";
  spark($("hist"), ses.memHist || []);
  $("total").textContent = `Total pernah ditidurkan: ${st.totalSlept} tab (≈ ${Math.round(st.totalSavedMB)} MB, perkiraan kasar)`;
  const why = pol.reason ? ` (${pol.reason})` : "";
  $("policy").textContent = !pol.enabled ? "Otomatis nonaktif."
    : pol.paused ? `Otomatis dijeda${why}.`
    : `Otomatis: tab idle ${pol.minutes} menit akan ditidurkan${why}.`
      + (pol.battery ? ` Baterai ${Math.round(pol.battery.level * 100)}%${pol.battery.charging ? ", dicas" : ""}.` : "");
}

async function doSweep(mode) {
  $("sweep").disabled = $("focus").disabled = true;
  const r = await chrome.runtime.sendMessage({ type: "sweep", mode });
  say(r.count ? `${r.count} tab ditidurkan (≈ ${r.savedMB} MB).` : "Tidak ada tab yang bisa ditidurkan.");
  $("sweep").disabled = $("focus").disabled = false;
  renderHome();
}
$("sweep").addEventListener("click", () => doSweep("now"));
$("focus").addEventListener("click", () => doSweep("focus"));

/* ---------- daftar tab ---------- */
function ask(tabId) {
  return new Promise((res) => {
    const to = setTimeout(() => res(null), 400);
    chrome.tabs.sendMessage(tabId, { type: "stats" }, (r) => { clearTimeout(to); void chrome.runtime.lastError; res(r || null); });
  });
}
const normUrl = (u) => { try { const x = new URL(u); x.hash = ""; return x.href.replace(/\/$/, ""); } catch { return null; } };

async function renderTabs() {
  const [awake, asleep, ses] = await Promise.all([
    chrome.tabs.query({ discarded: false }), chrome.tabs.query({ discarded: true }), chrome.storage.session.get(null)
  ]);

  // paling boros
  const stats = await Promise.all(awake.map((t) => (/^https?:/.test(t.url || "") ? ask(t.id) : null)));
  const rows = awake.map((t, i) => ({ t, st: stats[i], heap: stats[i]?.heapMB ?? ses["heap:" + t.id] ?? null }))
    .sort((a, b) => (b.heap ?? -1) - (a.heap ?? -1)).slice(0, 8);
  const heavy = $("heavy"); heavy.replaceChildren();
  rows.forEach(({ t, st, heap }) => {
    const r = el("div", "row");
    const title = el("span", "t", (st?.playing ? "▶ " : "") + (t.title || t.url));
    title.title = t.url;
    r.append(title, el("span", "m", heap != null ? heap + " MB" : "–"));
    if (!t.active) r.append(btn("Tidurkan", async () => { await chrome.tabs.discard(t.id).catch(() => {}); renderTabs(); renderHome(); }));
    r.append(btn("Tutup", async () => { await chrome.tabs.remove(t.id); renderTabs(); renderHome(); }));
    heavy.append(r);
  });
  if (!rows.length) heavy.append(el("div", "empty", "Tidak ada tab."));

  // tab tidur
  $("sleepCount").textContent = asleep.length ? `(${asleep.length})` : "";
  const sl = $("sleepList"); sl.replaceChildren();
  asleep.forEach((t) => {
    const r = el("div", "row");
    const title = el("span", "t", t.title || t.url); title.title = t.url;
    r.append(title, el("span", "m", "≈ " + ((ses["heap:" + t.id] ?? 50) + 30) + " MB"),
      btn("Bangunkan", async () => { await chrome.tabs.reload(t.id); renderTabs(); renderHome(); }));
    sl.append(r);
  });
  if (!asleep.length) sl.append(el("div", "empty", "Belum ada tab yang tidur."));

  // duplikat
  const groups = new Map();
  [...awake, ...asleep].forEach((t) => {
    const k = /^https?:/.test(t.url || "") ? normUrl(t.url) : null;
    if (k) groups.set(k, [...(groups.get(k) || []), t]);
  });
  const toClose = [];
  groups.forEach((list) => {
    if (list.length < 2) return;
    list.sort((a, b) => (b.pinned - a.pinned) || (b.active - a.active) || ((b.lastAccessed || 0) - (a.lastAccessed || 0)));
    toClose.push(...list.slice(1).map((t) => t.id));
  });
  const dup = $("dupBox"); dup.replaceChildren();
  if (!toClose.length) dup.append(el("div", "empty", "Tidak ada tab duplikat."));
  else {
    const b = el("button", "wide", `Tutup ${toClose.length} tab duplikat`);
    let armed = false;
    b.addEventListener("click", async () => {
      if (!armed) { armed = true; b.textContent = `Yakin? Klik lagi untuk menutup ${toClose.length} tab`; setTimeout(() => { armed = false; b.textContent = `Tutup ${toClose.length} tab duplikat`; }, 4000); return; }
      await chrome.tabs.remove(toClose);
      say(`${toClose.length} tab duplikat ditutup.`);
      renderTabs(); renderHome();
    });
    dup.append(b);
  }
}

/* ---------- pengaturan ---------- */
function fill(s) {
  $("enabled").checked = s.enabled;
  $("minutes").value = String(s.minutes);
  $("skipPinned").checked = s.skipPinned;
  $("skipAudible").checked = s.skipAudible;
  $("batteryMode").checked = s.batteryMode;
  $("batteryMinutes").value = String(s.batteryMinutes);
  $("scEnabled").checked = s.schedule.enabled;
  $("scFrom").value = s.schedule.from;
  $("scTo").value = s.schedule.to;
  $("scMode").value = s.schedule.mode;
  $("scMinutes").value = String(s.schedule.minutes);
  $("scMinutesRow").hidden = s.schedule.mode !== "aggressive";
  $("whitelist").value = s.whitelist.join("\n");
  $("whitelistGroups").value = s.whitelistGroups.join("\n");
}

function collect() {
  return {
    enabled: $("enabled").checked,
    minutes: Number($("minutes").value),
    skipPinned: $("skipPinned").checked,
    skipAudible: $("skipAudible").checked,
    batteryMode: $("batteryMode").checked,
    batteryMinutes: Number($("batteryMinutes").value),
    schedule: {
      enabled: $("scEnabled").checked,
      from: $("scFrom").value || "09:00",
      to: $("scTo").value || "17:00",
      mode: $("scMode").value,
      minutes: Number($("scMinutes").value)
    },
    whitelist: lines($("whitelist").value),
    whitelistGroups: lines($("whitelistGroups").value)
  };
}

function save() {
  $("scMinutesRow").hidden = $("scMode").value !== "aggressive";
  chrome.storage.local.set(collect()).then(renderHome);
}
document.querySelectorAll("#settings select, #settings input, #enabled").forEach((x) => x.addEventListener("change", save));
$("whitelist").addEventListener("input", save);
$("whitelistGroups").addEventListener("input", save);

$("addSite").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const host = new URL(tab.url).hostname.toLowerCase();
    const l = lines($("whitelist").value);
    if (!l.includes(host)) l.push(host);
    $("whitelist").value = l.join("\n"); save(); say(`${host} ditambahkan.`);
  } catch { say("Halaman ini tidak bisa ditambahkan."); }
});

$("addGroup").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.groupId === -1) return say("Tab ini tidak ada di grup.");
  const g = await chrome.tabGroups.get(tab.groupId);
  const name = (g.title || "").trim().toLowerCase();
  if (!name) return say("Beri nama dulu pada grup tab ini.");
  const l = lines($("whitelistGroups").value);
  if (!l.includes(name)) l.push(name);
  $("whitelistGroups").value = l.join("\n"); save(); say(`Grup "${name}" ditambahkan.`);
});

$("export").addEventListener("click", async () => {
  const j = JSON.stringify(collect(), null, 2);
  $("backup").value = j;
  try { await navigator.clipboard.writeText(j); say("Disalin ke clipboard."); } catch { say("Salin teks dari kotak."); }
});

$("import").addEventListener("click", async () => {
  try {
    const o = JSON.parse($("backup").value);
    const d = DEFAULTS, out = {};
    for (const k of ["enabled", "skipPinned", "skipAudible", "batteryMode"]) if (typeof o[k] === "boolean") out[k] = o[k];
    for (const k of ["minutes", "batteryMinutes"]) if (Number.isFinite(o[k]) && o[k] > 0) out[k] = o[k];
    for (const k of ["whitelist", "whitelistGroups"]) if (Array.isArray(o[k])) out[k] = o[k].map(String).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (o.schedule && typeof o.schedule === "object") out.schedule = { ...d.schedule, ...o.schedule };
    await chrome.storage.local.set(out);
    fill(await getSettings()); renderHome(); say("Impor berhasil.");
  } catch { say("JSON tidak valid."); }
});

/* ---------- mulai ---------- */
(async () => {
  fill(await getSettings());
  await tickMem();
  setInterval(tickMem, 1000);
  renderHome();
})();
