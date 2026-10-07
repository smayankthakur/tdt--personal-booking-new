import Landing from "@/components/Landing";
import { offerActive } from "@/lib/offer";

// Re-rendered every 5 minutes, so the Diwali offer disappears by itself after 11 November.
export const revalidate = 300;

export default function Home() {
  return <Landing offer={offerActive()} />;
}
