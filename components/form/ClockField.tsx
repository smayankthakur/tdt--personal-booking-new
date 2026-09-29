"use client";
import { useRef, useState } from "react";
const pad = (n: number) => String(n).padStart(2, "0");

/** Analog clock popover (drag or tap the face: hour, then minute). Writes hidden inputs <p>h/<p>min/<p>ap; leave empty to skip. */
export default function ClockField({ p }: { p: string }) {
  const [h, setH] = useState(0), [m, setM] = useState(0), [ap, setAp] = useState("AM"), [open, setOpen] = useState(false), [mode, setMode] = useState<"h" | "m">("h");
  const svg = useRef<SVGSVGElement>(null), drag = useRef(false);
  const angle = mode === "h" ? (h % 12) * 30 : m * 6, R = 84;
  const pt = (deg: number, r: number) => [100 + r * Math.sin((deg * Math.PI) / 180), 100 - r * Math.cos((deg * Math.PI) / 180)];
  const [hx, hy] = pt(angle, R - 8);

  function aim(e: React.PointerEvent) {
    const b = svg.current!.getBoundingClientRect(), x = e.clientX - b.left - b.width / 2, y = e.clientY - b.top - b.height / 2;
    const deg = (Math.atan2(x, -y) * 180) / Math.PI, a = (deg + 360) % 360;
    if (mode === "h") setH(Math.round(a / 30) % 12 || 12); else setM(Math.round(a / 6) % 60);
  }
  const shown = h ? `${h}:${pad(m)} ${ap}` : "";

  return (
    <div>
      <input type="hidden" name={p + "h"} value={h || ""} /><input type="hidden" name={p + "min"} value={h ? pad(m) : ""} /><input type="hidden" name={p + "ap"} value={ap} />
      <button type="button" className={`pick-btn${shown ? " has" : ""}`} onClick={() => { setOpen(!open); if (!h) { setH(12); setM(0); } }}>
        <span>🕐</span>{shown || "Time chunein (optional)"}<i>{open ? "▲" : "▼"}</i>
      </button>
      {open && (
        <div className="pop clock">
          <div className="clock-digital">
            <button type="button" className={mode === "h" ? "on" : ""} onClick={() => setMode("h")}>{pad(h || 12)}</button>:
            <button type="button" className={mode === "m" ? "on" : ""} onClick={() => setMode("m")}>{pad(m)}</button>
            <div className="ampm">{["AM", "PM"].map((x) => <button type="button" key={x} className={ap === x ? "on" : ""} onClick={() => setAp(x)}>{x}</button>)}</div>
          </div>
          <svg ref={svg} viewBox="0 0 200 200" className="clock-face" style={{ touchAction: "none" }}
            onPointerDown={(e) => { drag.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); aim(e); }}
            onPointerMove={(e) => drag.current && aim(e)}
            onPointerUp={() => { drag.current = false; if (mode === "h") setMode("m"); }}>
            <circle cx="100" cy="100" r="98" className="clock-bg" />
            <line x1="100" y1="100" x2={hx} y2={hy} className="clock-hand" style={{ transition: drag.current ? "none" : "all .25s" }} />
            <circle cx="100" cy="100" r="4" className="clock-dot" /><circle cx={hx} cy={hy} r="15" className="clock-knob" />
            {Array.from({ length: 12 }, (_, i) => { const [x, y] = pt(i * 30, R - 8), n = mode === "h" ? i || 12 : i * 5, on = mode === "h" ? (h % 12) === i : m === n; return <text key={i} x={x} y={y + 4} textAnchor="middle" className={`clock-n${on ? " on" : ""}`}>{n}</text>; })}
          </svg>
          <div className="clock-foot">
            <button type="button" className="link-btn" onClick={() => { setH(0); setM(0); setOpen(false); }}>Skip / Clear</button>
            <button type="button" className="btn gold" style={{ padding: "8px 22px" }} onClick={() => setOpen(false)}>OK</button>
          </div>
        </div>)}
    </div>);
}
