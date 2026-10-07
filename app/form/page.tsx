import { redirect } from "next/navigation";
import ReadingForm from "@/components/ReadingForm";
export const metadata = { title: "Personal Reading Form | The Divine Tarot", robots: { index: false } };

export default function FormPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  // Payment links created before this update still return to /form?bid=…&razorpay_…: verify them the new way.
  // A bare ?bid= on its own opens nothing — the form only opens from the signed cookie set after payment.
  if (searchParams.razorpay_signature) {
    const q = new URLSearchParams(Object.entries(searchParams).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    redirect(`/api/pay-return?${q}`);
  }
  return (
    <main className="form-page">
      <div className="container form-wrap">
        <a href="https://thedivinetarotonline.com/" className="form-brand"><img src="/logo.png" alt="The Divine Tarot" /><span>The Divine Tarot</span></a>
        <ReadingForm />
      </div>
    </main>
  );
}
