import Reveal from "@/components/ui/Reveal";

interface SectionHeadProps {
  eyebrow: string;
  title: string;
  titleId: string;
  sub: string;
}

/**
 * Reference sequence (framer whileInView stagger): eyebrow rises y+20 →
 * title rises y+24 → sub fades in — three sequenced reveals, never one
 * simultaneous block. Delays: 0 / 100 / 200ms after entering view.
 */
export default function SectionHead({ eyebrow, title, titleId, sub }: SectionHeadProps) {
  return (
    <div className="section-head">
      <Reveal direction="up" distance={20} delay={0}>
        <p className="eyebrow">{eyebrow}</p>
      </Reveal>
      <Reveal direction="up" distance={24} delay={100}>
        <h2 className="section-title" id={titleId}>
          {title}
        </h2>
      </Reveal>
      <Reveal direction="fade" delay={200}>
        <p className="section-sub">{sub}</p>
      </Reveal>
    </div>
  );
}
