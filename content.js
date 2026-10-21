// Content script ringan: deteksi form yang belum tersimpan + laporan ukuran JS heap.
(() => {
  if (window.__chromeDiet) return;
  window.__chromeDiet = true;

  const dirty = new Set();
  const send = (m) => { try { chrome.runtime.sendMessage(m).catch(() => {}); } catch (e) {} };
  const heapMB = () =>
    performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;

  function hasText(el) {
    if (el.isContentEditable) return el.textContent.trim().length > 0;
    return typeof el.value === "string" && el.value.trim().length > 0;
  }

  document.addEventListener("input", (e) => {
    const el = e.target;
    if (!el || !el.tagName) return;
    const tag = el.tagName;
    const type = (el.type || "").toLowerCase();
    const ok = tag === "TEXTAREA" || el.isContentEditable ||
      (tag === "INPUT" && !["checkbox", "radio", "button", "submit", "range", "color", "file"].includes(type));
    if (!ok) return;
    const before = dirty.size > 0;
    if (hasText(el)) dirty.add(el); else dirty.delete(el);
    const after = dirty.size > 0;
    if (before !== after) send({ type: "dirty", dirty: after });
  }, true);

  document.addEventListener("submit", () => {
    if (dirty.size) { dirty.clear(); send({ type: "dirty", dirty: false }); }
  }, true);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      const h = heapMB();
      if (h !== null) send({ type: "heap", heapMB: h });
    }
  });

  chrome.runtime.onMessage.addListener((m, _s, reply) => {
    if (m && m.type === "stats") {
      const playing = [...document.querySelectorAll("video")].some((v) => !v.paused && !v.ended);
      reply({ heapMB: heapMB(), playing, dirty: dirty.size > 0 });
    }
  });
})();
