import { marqueeItems } from "@/data/events";

function Track({ hidden }: { hidden?: boolean }) {
  return (
    <div className="marquee-track" aria-hidden={hidden || undefined}>
      {marqueeItems.map((item) => (
        <span className="marquee-item" key={item}>
          <span>{item}</span>
          <span className="marquee-star">✦</span>
        </span>
      ))}
    </div>
  );
}

/** Seamless loop: two identical tracks, each translating -100%. */
export default function Marquee() {
  return (
    <div className="marquee" aria-label="ATecHS Society focus areas">
      <Track />
      <Track hidden />
    </div>
  );
}
