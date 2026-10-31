"use client";
import { useEffect, useState } from "react";
import { type Api, fmtTime } from "./ui";

const b64ToBytes = (s: string) => { const p = "=".repeat((4 - (s.length % 4)) % 4), raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };
const deviceName = () => { const u = navigator.userAgent; const os = /iPhone|iPad/.test(u) ? "iPhone/iPad" : /Android/.test(u) ? "Android" : /Mac/.test(u) ? "Mac" : /Windows/.test(u) ? "Windows" : "Device"; const br = /Edg\//.test(u) ? "Edge" : /Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : /Firefox\//.test(u) ? "Firefox" : ""; return `${os}${br ? ` · ${br}` : ""}`; };

/** Own password, other admins, and phone notifications for this device. */
export default function Account({ api, me, onNote, onToken }: { api: Api; me: string; onNote: (m: string) => void; onToken: (t: string) => void }) {
  const [admins, setAdmins] = useState<string[]>([]), [pw, setPw] = useState({ current: "", next: "", again: "" }), [na, setNa] = useState({ email: "", password: "" });
  const [resetFor, setResetFor] = useState(""), [resetPw, setResetPw] = useState(""), [delFor, setDelFor] = useState(""), [busy, setBusy] = useState("");
  const [push, setPush] = useState<{ publicKey: string; devices: any[] } | null>(null), [mine, setMine] = useState<string | null>(null), [perm, setPerm] = useState("");
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const ios = typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent), standalone = typeof window !== "undefined" && (matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone);

  const loadAdmins = () => api("/api/admin/account").then((j) => setAdmins(j.admins || []));
  const loadPush = async () => {
    const j = await api("/api/admin/push"); setPush(j);
    if (!supported) return;
    setPerm(Notification.permission);
    const reg = await navigator.serviceWorker.getRegistration("/admin");
    const sub = await reg?.pushManager.getSubscription();
    setMine(sub?.endpoint || null);
  };
  useEffect(() => { loadAdmins(); loadPush(); }, []);

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.again) return onNote("Naya password dono jagah same likhein — galat");
    setBusy("pw"); const j = await api("/api/admin/account", "POST", { action: "password", current: pw.current, next: pw.next }); setBusy("");
    if (j.error) return onNote(j.error);
    onToken(j.token); setPw({ current: "", next: "", again: "" });
    onNote("Password badal gaya ✓ — doosre devices par purana login band ho gaya, wahan naye password se login karein.");
  };
  const admin = async (body: object, ok: string) => {
    setBusy("adm"); const j = await api("/api/admin/account", "POST", body); setBusy("");
    if (j.error) return onNote(j.error);
    setAdmins(j.admins || admins); setResetFor(""); setResetPw(""); setDelFor(""); setNa({ email: "", password: "" }); onNote(ok);
  };
  const enable = async () => {
    try {
      setBusy("push");
      const p = await Notification.requestPermission(); setPerm(p);
      if (p !== "granted") { setBusy(""); return onNote("Notification permission nahi mili — browser settings mein is site ke liye Notifications 'Allow' karein."); }
      const reg = await navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" });
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(push!.publicKey) });
      const j = await api("/api/admin/push", "POST", { sub: sub.toJSON(), device: deviceName() });
      onNote(j.ok ? "Is device par notifications on ho gaye ✓ — ab 'Test bhejo' dabakar check karein." : j.error || "On nahi hua");
    } catch (e: any) { onNote(`Notifications on nahi hue: ${String(e?.message || e).slice(0, 120)}`); }
    setBusy(""); loadPush();
  };
  const disable = async (id?: string) => {
    setBusy("push");
    if (!id) { const reg = await navigator.serviceWorker.getRegistration("/admin"), sub = await reg?.pushManager.getSubscription(); if (sub) { await api("/api/admin/push", "DELETE", { endpoint: sub.endpoint }); await sub.unsubscribe(); } }
    else await api(`/api/admin/push?id=${id}`, "DELETE");
    setBusy(""); onNote("Notifications band ✓"); loadPush();
  };
  const test = async () => { setBusy("push"); const j = await api("/api/admin/push", "POST", { test: true }); setBusy(""); onNote(j.result || j.error); };

  return (<>
    <div className="wpa-cols">
      <div className="wpa-postbox"><h2>🔑 Mera password badlein</h2><div className="inside">
        <form onSubmit={changePw}><table className="wpa-form-table"><tbody>
          <tr><th>Email</th><td><b>{me}</b></td></tr>
          <tr><th>Purana password</th><td><input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></td></tr>
          <tr><th>Naya password</th><td><input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /><p className="description">Kam se kam 10 characters, letters + numbers.</p></td></tr>
          <tr><th>Naya password dobara</th><td><input type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} /></td></tr>
        </tbody></table>
        <p><button className="wpa-btn primary" disabled={busy === "pw" || !pw.current || !pw.next || !pw.again}>{busy === "pw" ? "Badal raha hai…" : "Password badlein"}</button></p></form>
        <p className="description">Har admin ka apna password hai. Aapka password badalne se sirf aapke doosre logins band honge.</p>
      </div></div>

      <div className="wpa-postbox"><h2>🔔 Phone notifications</h2><div className="inside">
        <p>Naya payment, nayi booking aur naya feedback aate hi is device par notification aayega.</p>
        {!supported ? <div className="wpa-notice warning inline"><p>{ios && !standalone
          ? <>iPhone par: Safari mein yeh page kholein → Share button → <b>&quot;Add to Home Screen&quot;</b> → Home Screen wale <b>TDT Admin</b> app se login karke yahan wapas aayein.</>
          : "Is browser mein notifications support nahi hain. Android par Chrome, computer par Chrome/Edge use karein."}</p></div>
          : mine ? <p><span className="wpa-status ok">Is device par ON ✓</span> <button className="wpa-btn" disabled={!!busy} onClick={test}>Test bhejo</button> <button className="wpa-btn" disabled={!!busy} onClick={() => disable()}>Band karein</button></p>
          : <p><button className="wpa-btn primary" disabled={!!busy || !push} onClick={enable}>{busy === "push" ? "On ho raha hai…" : "Is device par notifications on karein"}</button>{perm === "denied" && <span style={{ color: "#d63638" }}> Browser ne block kiya hai — site settings mein Notifications Allow karein.</span>}</p>}
        {ios && standalone === false && supported && <p className="description">iPhone par notifications sirf Home Screen app se chalte hain.</p>}
        {push && push.devices.length > 0 && <table className="wpa-table compact" style={{ marginTop: 10 }}><thead><tr><th>Device</th><th>Admin</th><th>Kab se</th><th /></tr></thead><tbody>
          {push.devices.map((d) => <tr key={d.id}><td>{d.device || "Device"}</td><td>{d.email}</td><td>{fmtTime(d.at)}</td>
            <td style={{ textAlign: "right" }}><a className="wpa-link-delete" onClick={() => disable(d.id)}>Hatao</a></td></tr>)}
        </tbody></table>}
      </div></div>
    </div>

    <div className="wpa-postbox"><h2>👥 Admins</h2><div className="inside">
      <table className="wpa-table compact" style={{ marginTop: 12 }}><thead><tr><th>Email</th><th>Role</th><th style={{ width: 380 }} /></tr></thead><tbody>
        {admins.map((a) => <tr key={a}><td><b>{a}</b>{a === me && <span className="wpa-tag blue">Aap</span>}</td><td>Full admin</td>
          <td style={{ textAlign: "right" }}>{a === me ? <span className="wpa-muted">Upar se apna password badlein</span>
            : resetFor === a ? <><input type="text" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="Naya temporary password" /> <button className="wpa-btn primary" disabled={busy === "adm" || !resetPw} onClick={() => admin({ action: "reset", email: a, password: resetPw }, `${a} ka password reset ✓ — unhe naya password batayein aur login ke baad badalne ko kahein.`)}>Save</button> <a onClick={() => setResetFor("")}>✕</a></>
            : delFor === a ? <><button className="wpa-btn danger" disabled={busy === "adm"} onClick={() => admin({ action: "remove", email: a }, `${a} ko admin se hata diya ✓`)}>Pakka hatayein?</button> <button className="wpa-btn" onClick={() => setDelFor("")}>Nahi</button></>
            : <><a onClick={() => { setResetFor(a); setDelFor(""); }}>Password reset</a> | <a className="wpa-link-delete" onClick={() => { setDelFor(a); setResetFor(""); }}>Hatao</a></>}</td></tr>)}
      </tbody></table>
      <div className="wpa-inline-form" style={{ marginTop: 14 }}>
        <b>Naya admin:</b>
        <input type="email" value={na.email} onChange={(e) => setNa({ ...na, email: e.target.value })} placeholder="email@gmail.com" />
        <input type="text" value={na.password} onChange={(e) => setNa({ ...na, password: e.target.value })} placeholder="Temporary password (10+ chars)" autoComplete="off" />
        <button className="wpa-btn primary" disabled={busy === "adm" || !na.email || !na.password} onClick={() => admin({ action: "add", ...na }, `${na.email} admin ban gaye ✓ — unhe password batayein aur login ke baad badalne ko kahein.`)}>Add Admin</button>
      </div>
      <p className="description">Sabhi admins ke paas poora access hai. Password kabhi kisi log ya email mein save nahi hota.</p>
    </div></div>
  </>);
}
