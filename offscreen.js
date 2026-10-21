// Membaca status baterai (Service Worker tidak punya akses Battery API)
if (navigator.getBattery) {
  navigator.getBattery().then((b) => {
    const send = () => chrome.runtime.sendMessage({ type: "battery", charging: b.charging, level: b.level });
    send();
    b.addEventListener("chargingchange", send);
    b.addEventListener("levelchange", send);
  }).catch(() => {});
}
