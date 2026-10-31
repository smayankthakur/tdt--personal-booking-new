import type { Metadata, Viewport } from "next";

// /admin can be installed as an app ("Add to Home Screen") so admins get push notifications on their phone.
export const metadata: Metadata = {
  title: "Booking Admin | The Divine Tarot",
  robots: { index: false, follow: false },
  manifest: "/admin-manifest.webmanifest",
  appleWebApp: { capable: true, title: "TDT Admin", statusBarStyle: "black" },
  icons: { apple: [{ url: "/admin-icon-192.png", sizes: "192x192" }] },
};
export const viewport: Viewport = { themeColor: "#1d2327" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
