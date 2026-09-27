import { Building2, Eye, Target, Users } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/ui/SectionHead";
import { organization } from "@/data/events";

const FEATURES = [
  {
    icon: Building2,
    title: "The Society",
    text: "The official student organization driving technological learning, collaboration, and community engagement.",
  },
  {
    icon: Target,
    title: "Our Mission",
    text: organization.mission,
  },
  {
    icon: Eye,
    title: "Our Vision",
    text: organization.vision,
  },
  {
    icon: Users,
    title: "The Community",
    text: "A growing network of members across departments — open to every student who wants to build.",
  },
];

export default function Organization() {
  const shown = organization.departments.slice(0, 4);
  const extra = organization.departments.length - shown.length;

  return (
    <section className="section" id="organization" aria-labelledby="org-title">
      <div className="giant-word" aria-hidden="true">
        <span>SOCIETY</span>
      </div>
      <div className="container">
        <SectionHead
          eyebrow="Who We Are"
          title="ATecHS Society"
          titleId="org-title"
          sub="The student organization behind the Hub."
        />

        <Reveal direction="up" className="org-hero">
          <div className="org-hero-inner">
            <div className="org-hero-copy">
              <h3>
                <span className="accent">ATecHS</span> Society
              </h3>
              <p className="org-fullname">{organization.fullName}</p>
              <p className="org-desc">{organization.description}</p>
              <div className="dept-pills">
                {shown.map((d) => (
                  <span key={d}>{d}</span>
                ))}
                {extra > 0 && <span className="more">+{extra} more</span>}
              </div>
            </div>
            <div className="org-facts">
              <div className="org-fact">
                <strong>{organization.members}</strong>
                <span>Active Members</span>
              </div>
              <div className="org-fact">
                <strong>{organization.departments.length}</strong>
                <span>Departments</span>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="cards-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} direction="up" delay={i * 120} className="card">
              <div className="feature-icon">
                <f.icon size={24} />
              </div>
              <h4 data-rev-x>{f.title}</h4>
              <p data-rev-fade>{f.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
