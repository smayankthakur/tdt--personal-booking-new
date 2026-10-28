import Landing from "@/components/Landing";
import { publicPricing } from "@/lib/pricing";

// Prices, seasonal offer and coupons are set in /admin. The page re-renders at most every 60 seconds,
// so a price change shows within a minute (and an offer ends by itself on its end date).
export const revalidate = 60;

export default async function Home() {
  return <Landing pricing={await publicPricing()} />;
}
