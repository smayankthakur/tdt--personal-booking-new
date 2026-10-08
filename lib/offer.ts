/** Festival offer on the standard reading. Ends automatically; edit here for the next festival. */
export const OFFER = {
  name: "Diwali Offer",
  price: 5500,
  until: Date.parse("2026-11-30T23:59:59+05:30"), // valid till 30 November 2026 (IST), then the regular price applies again
  untilText: "30 Nov 2026",
};
export const REGULAR_PRICE = 8500;
export const URGENT_PRICE = 17000;
export const offerActive = (now = Date.now()) => now <= OFFER.until;
export const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
