"use client";
import { useRef, useState } from "react";

/** Compressed photos, keyed by field name, attached to the request on submit. */
export const photoStore: Record<string, File> = {};

async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Sirf image (JPG/PNG) chunein.");
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.82));
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

export default function FileDrop({ name, onChange }: { name: string; onChange?: (has: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false), [pct, setPct] = useState(0), [prev, setPrev] = useState(""), [info, setInfo] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);

  async function take(f?: File) {
    if (!f) return; setErr(""); setBusy(true); setPct(0); delete photoStore[name]; onChange?.(false);
    const t0 = performance.now(), tick = () => { const p = Math.min(90, ((performance.now() - t0) / 700) * 90); setPct(p); if (p < 90) raf = requestAnimationFrame(tick); };
    let raf = requestAnimationFrame(tick);
    try {
      const small = await shrink(f);
      await new Promise((r) => setTimeout(r, Math.max(0, 700 - (performance.now() - t0)))); cancelAnimationFrame(raf);
      photoStore[name] = small; setPrev(URL.createObjectURL(small)); setInfo(`${Math.round(small.size / 1024)} KB`); setPct(100); onChange?.(true);
    } catch (e: any) { cancelAnimationFrame(raf); setErr(e.message || "Photo padh nahi paye."); setPct(0); }
    setBusy(false);
  }
  const clear = () => { delete photoStore[name]; setPrev(""); setPct(0); onChange?.(false); if (input.current) input.current.value = ""; };
  const R = 26, C = 2 * Math.PI * R;

  return (
    <div>
      <div className={`fd${over ? " over" : ""}${prev ? " done" : ""}`} onClick={() => !prev && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => take(e.target.files?.[0])} />
        {prev ? (<>
          <img src={prev} alt="" className="fd-img" />
          <div className="fd-meta"><b>✓ Photo ready</b><span>{info}</span></div>
          <button type="button" className="fd-x" onClick={(e) => { e.stopPropagation(); clear(); }} aria-label="Remove">✕</button>
        </>) : busy ? (
          <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r={R} className="fd-track" /><circle cx="32" cy="32" r={R} className="fd-ring" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} /><text x="32" y="36" textAnchor="middle" className="fd-pct">{Math.round(pct)}%</text></svg>
        ) : (<>
          <div className="fd-icon">⇪</div>
          <div className="fd-t"><b>Photo yahan drop karein</b> ya tap karke chunein</div>
          <small>JPG / PNG · auto-compress</small>
        </>)}
      </div>
      {err && <p className="rf-err">{err}</p>}
    </div>);
}
