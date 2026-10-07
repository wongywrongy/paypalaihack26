import { createRef, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { AnimatedBeam } from "./magicui/animated-beam";
import { NumberTicker } from "./magicui/number-ticker";
import Icon from "./Icon";
import type { PaymentMember } from "../api";

export default function CommitmentTrack({ count, capacity, pending, closed, members }: {
  count: number; capacity: number; pending: boolean; closed: boolean; members: PaymentMember[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const origin = useRef<HTMLSpanElement>(null);
  const positions = useRef(Array.from({ length: capacity }, () => createRef<HTMLSpanElement>()));
  const previous = useRef(count);
  const [pulse, setPulse] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (count > previous.current && !reducedMotion) setPulse(count);
    previous.current = count;
    const timer = setTimeout(() => setPulse(null), 850);
    return () => clearTimeout(timer);
  }, [count, reducedMotion]);
  return (
    <div className="commitment-progress">
      <div className="commitment-heading">
        <strong><NumberTicker value={count} /> of {capacity} committed</strong>
        <span>{closed ? "Participation closed" : `${Math.max(0, capacity - count)} ${capacity - count === 1 ? "place" : "places"} open`}</span>
      </div>
      {capacity > 10 ? <progress aria-label="Verified authorizations" value={count} max={capacity} /> : <div className="commitment-track" ref={container}>
        <span className="track-origin" ref={origin} aria-hidden="true" />
        <ol aria-label="Buyer authorization positions">
          {Array.from({ length: capacity }, (_, i) => {
            const member = members.find(m => m.position === i + 1);
            const confirmed = !!member && ["CREATED", "CAPTURED"].includes(member.authorization_status || "") && member.void_status !== "VOIDED" && !member.refund_status && member.capture_status !== "REVERSED";
            const label = member?.refund_status === "COMPLETED" ? "Refunded" : member?.refund_status === "FAILED" ? "Refund failed" : member?.refund_status ? "Refund pending" : member?.void_status === "VOIDED" ? "Canceled" : member?.capture_status === "REVERSED" ? "Reversed" : member?.capture_status === "COMPLETED" ? "Paid" : member?.capture_status === "PENDING" ? "Pending" : ["DECLINED", "DENIED", "FAILED"].includes(member?.capture_status || "") ? "Failed" : confirmed ? "Authorized" : pending && i === count && !closed ? "Approval pending" : closed ? "Closed" : "Open";
            return <li key={i} className={confirmed ? "authorized" : pending && i === count && !closed ? "pending" : ""}>
              <span className="position-number" ref={positions.current[i]}>{i + 1}</span>
              <span className="position-state">{confirmed && <Icon name="check" size={12} />}{label}</span>
              <span className="position-owner">{member?.is_you ? "You" : ""}</span>
            </li>;
          })}
        </ol>
        {pulse !== null && !reducedMotion && (
          <AnimatedBeam key={pulse} containerRef={container} fromRef={pulse === 1 ? origin : positions.current[Math.min(pulse - 2, capacity - 2)]}
            toRef={positions.current[Math.min(pulse - 1, capacity - 1)]} duration={0.65} repeat={0}
            pathColor="transparent" pathWidth={2} gradientStartColor="#4338ca" gradientStopColor="#4338ca" />
        )}
      </div>}
      <p className="commitment-caption">{closed ? "Participation is closed. Payment outcomes remain in your record." : "Only confirmed authorizations count. The final tier is selected at closing."}</p>
    </div>
  );
}
