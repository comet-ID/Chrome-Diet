// Chrome Diet 1.1 - background service worker (MV3)
importScripts("shared.js");

const BASE_OVERHEAD_MB = 30;   // perkiraan kasar overhead per tab
const DEFAULT_HEAP_MB = 50;    // dipakai kalau ukuran heap belum diketahui

const hostOf = (url) => { try { return new URL(url).hostname; } catch { return ""; } };
const isWhitelisted = (url, list) => {
  const h = hostOf(url);
  return list.some((d) => d && (h === d || h.endsWith("." + d)));
};

function inWindow(sc, d) {
  const cur = d.getHours() * 60 + d.getMinutes();
  const [fh, fm] = sc.from.split(":").map(Number);
  const [th, tm] = sc.to.split(":").map(Number);
  const f = fh * 60 + fm, t = th * 60 + tm;
  return f <= t ? cur >= f && cur < t : cur >= f || cur < t; // dukung jadwal lewat tengah malam
}

async function getPolicy(s) {
  let minutes = s.minutes, reason = "", paused = false;
  const { battery } = await chrome.storage.session.get("battery");
  if (s.batteryMode && battery && battery.charging === false && s.batteryMinutes < minutes) {
    minutes = s.batteryMinutes; reason = "mode baterai";
  }
  const sc = s.schedule;
  if (sc.enabled && inWindow(sc, new Date())) {
    if (sc.mode === "pause") { paused = true; reason = "jeda sesuai jadwal"; }
    else if (sc.minutes < minutes) { minutes = sc.minutes; reason = "jadwal agresif"; }
  }
  return { enabled: s.enabled, minutes, paused, reason, battery: battery || null };
}

async function groupTitle(id, cache) {
  if (id == null || id === -1) return "";
  if (cache.has(id)) return cache.get(id);
  let title = "";
  try { title = ((await chrome.tabGroups.get(id)).title || "").trim().toLowerCase(); } catch {}
  cache.set(id, title);
  return title;
}

async function updateBadge() {
  const sleeping = await chrome.tabs.query({ discarded: true });
  chrome.action.setBadgeBackgroundColor({ color: "#2f6f5e" });
  chrome.action.setBadgeText({ text: sleeping.length ? String(sleeping.length) : "" });
}

// mode: "auto" (terjadwal), "now" (abaikan batas waktu), "focus" (semua kecuali tab aktif)
async function sweep(mode = "auto") {
  const s = await getSettings();
  const pol = await getPolicy(s);
  if (mode === "auto" && (!s.enabled || pol.paused)) return { count: 0, savedMB: 0 };

  const session = await chrome.storage.session.get(null);
  const limit = pol.minutes * 60000, now = Date.now();
  const cache = new Map();
  const tabs = await chrome.tabs.query({ active: false, discarded: false });
  let count = 0, savedMB = 0;

  for (const t of tabs) {
    if (!/^https?:/.test(t.url || "")) continue;
    if (t.autoDiscardable === false || session["dirty:" + t.id]) continue; // ada ketikan belum tersimpan
    if (t.audible && (s.skipAudible || mode === "focus")) continue;
    if (mode !== "focus") {
      if (t.pinned && s.skipPinned) continue;
      if (isWhitelisted(t.url, s.whitelist)) continue;
      const g = await groupTitle(t.groupId, cache);
      if (g && s.whitelistGroups.includes(g)) continue;
    }
    if (mode === "auto" && now - (t.lastAccessed || now) < limit) continue;
    try {
      await chrome.tabs.discard(t.id);
      count++;
      savedMB += (session["heap:" + t.id] ?? DEFAULT_HEAP_MB) + BASE_OVERHEAD_MB;
    } catch (e) { /* tab sudah hilang */ }
  }

  if (count) {
    await chrome.storage.local.set({
      totalSlept: s.totalSlept + count,
      totalSavedMB: s.totalSavedMB + savedMB
    });
  }
  await updateBadge();
  return { count, savedMB };
}

async function sampleMemory() {
  const m = await chrome.system.memory.getInfo();
  const used = Math.round((1 - m.availableCapacity / m.capacity) * 100);
  const { memHist = [] } = await chrome.storage.session.get("memHist");
  memHist.push(used);
  while (memHist.length > 120) memHist.shift(); // 2 jam
  await chrome.storage.session.set({ memHist });
}

async function ensureOffscreen() {
  try {
    const ctx = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
    if (ctx.length) return;
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["BATTERY_STATUS"],
      justification: "Membaca status baterai untuk mode hemat baterai"
    });
  } catch (e) { /* tidak fatal */ }
}

chrome.alarms.get("tick", (a) => { if (!a) chrome.alarms.create("tick", { periodInMinutes: 1 }); });
chrome.runtime.onInstalled.addListener(() => { ensureOffscreen(); sampleMemory(); updateBadge(); });
chrome.runtime.onStartup.addListener(() => { ensureOffscreen(); sampleMemory(); updateBadge(); });
chrome.alarms.onAlarm.addListener(async () => {
  await ensureOffscreen();
  await sampleMemory();
  await sweep("auto");
});

chrome.tabs.onActivated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener((id) => chrome.storage.session.remove(["heap:" + id, "dirty:" + id]));
chrome.tabs.onUpdated.addListener(async (id, info) => {
  if (info.status !== "loading") return;
  const k = "dirty:" + id;
  const r = await chrome.storage.session.get(k);
  if (r[k]) {
    await chrome.storage.session.remove(k);
    chrome.tabs.update(id, { autoDiscardable: true }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  switch (msg.type) {
    case "sweep":
      sweep(msg.mode || "now").then(reply);
      return true;
    case "policy":
      getSettings().then(getPolicy).then(reply);
      return true;
    case "battery":
      chrome.storage.session.set({ battery: { charging: msg.charging, level: msg.level } });
      break;
    case "heap":
      if (sender.tab && msg.heapMB != null) chrome.storage.session.set({ ["heap:" + sender.tab.id]: msg.heapMB });
      break;
    case "dirty":
      if (sender.tab) {
        const id = sender.tab.id;
        chrome.tabs.update(id, { autoDiscardable: !msg.dirty }).catch(() => {});
        if (msg.dirty) chrome.storage.session.set({ ["dirty:" + id]: true });
        else chrome.storage.session.remove("dirty:" + id);
      }
      break;
  }
});
