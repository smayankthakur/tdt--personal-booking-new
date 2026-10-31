/* Service worker for /admin only: shows admin push notifications (new payment, new booking, feedback). No caching. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "The Divine Tarot", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "The Divine Tarot", {
    body: d.body || "", icon: "/admin-icon-192.png", badge: "/favicon-32.png", data: { url: d.url || "/admin" }, tag: d.tag || undefined,
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/admin", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(self.location.origin + "/admin")) { c.focus(); return; }
    return self.clients.openWindow(url);
  }));
});
