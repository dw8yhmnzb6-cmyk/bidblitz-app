import { CountdownTimer } from "../design/CountdownTimer";

/**
 * Countdown — Auction timer with final-battle pulse + ending-now critical state.
 * Shared between AuctionGridCard and AuctionDetail.
 */
export default function Countdown({ endsAt, status, size = "md" }) {
  return (
    <CountdownTimer
      targetDate={endsAt}
      status={status}
      locale="de"
      className={size === "lg" ? "text-xl sm:text-2xl font-black text-white" : size === "sm" ? "text-sm font-bold text-white/90" : "text-base sm:text-lg font-black text-white/90"}
      testId="auction-countdown"
    />
  );
}
