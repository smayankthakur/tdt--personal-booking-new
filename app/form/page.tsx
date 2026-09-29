import ReadingForm from "@/components/ReadingForm";
export const metadata = { title: "Personal Reading Form | The Divine Tarot", robots: { index: false } };

export default function FormPage() {
  return (
    <main className="form-page">
      <div className="container form-wrap">
        <a href="https://thedivinetarotonline.com/" className="form-brand"><img src="/logo.png" alt="The Divine Tarot" /><span>The Divine Tarot</span></a>
        <ReadingForm />
      </div>
    </main>
  );
}
