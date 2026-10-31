import FeedbackForm from "@/components/FeedbackForm";
import { db } from "@/lib/db";
import { openFeedback } from "@/lib/session";
export const metadata = { title: "Feedback | The Divine Tarot", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function FeedbackPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const t = typeof searchParams.t === "string" ? searchParams.t : "", bid = openFeedback(t);
  const o = bid ? (await db.doc(`orders/${bid}`).get()).data() : null, fb = bid ? (await db.doc(`feedback/${bid}`).get()).data() : null;
  const r = Number(searchParams.r);
  const day = o?.slot ? new Date(`${o.slot}:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }) : "";
  return (
    <main className="form-page">
      <div className="container form-wrap">
        <a href="https://thedivinetarotonline.com/" className="form-brand"><img src="/logo.png" alt="The Divine Tarot" /><span>The Divine Tarot</span></a>
        {!o || !o.formDone ? <div className="rf-card"><h1>Link sahi nahi hai</h1><p>Feedback ka link email se dobara kholein.</p></div>
          : <FeedbackForm t={t} name={String(o.name || "")} day={day} initial={fb ? fb.rating : r >= 1 && r <= 5 ? Math.round(r) : 0} comment={fb?.comment || ""} done={!!fb} />}
      </div>
    </main>
  );
}
