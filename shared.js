// Dipakai bersama oleh background.js dan popup.js
const DEFAULTS = {
  enabled: true,
  minutes: 15,
  skipPinned: true,
  skipAudible: true,
  whitelist: ["mail.google.com", "meet.google.com", "docs.google.com", "calendar.google.com"],
  whitelistGroups: [],
  batteryMode: true,
  batteryMinutes: 3,
  schedule: { enabled: false, from: "09:00", to: "17:00", mode: "pause", minutes: 5 },
  totalSlept: 0,
  totalSavedMB: 0
};

async function getSettings() {
  const s = { ...DEFAULTS, ...(await chrome.storage.local.get(DEFAULTS)) };
  s.schedule = { ...DEFAULTS.schedule, ...(s.schedule || {}) };
  return s;
}
