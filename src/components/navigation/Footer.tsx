import Reveal from "@/components/ui/Reveal";
import { BrandLogo, BrandMark } from "@/components/Brand";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <p className="footer-brand">
              <BrandLogo />
              <BrandMark />
            </p>
            <p>
              The digital home of ATecHS Society — bringing together organizational activities,
              projects, media, accomplishments, and current work.
            </p>
          </div>
          <nav aria-label="Explore">
            <h4>Explore</h4>
            <div className="footer-links">
              <a href="#events">Current Events</a>
              <a href="#media">Media Bank</a>
              <a href="#timeline">Timeline</a>
              <a href="#organization">Organization</a>
            </div>
          </nav>
          <nav aria-label="Society">
            <h4>Society</h4>
            <div className="footer-links">
              <a href="#evaluation">Share Feedback</a>
            </div>
          </nav>
        </div>
        <Reveal direction="fade" className="footer-bottom">
          <span>© {year} ATecHS Society. All rights reserved.</span>
          <span className="mock-badge">
            <i />
            Phase 1 preview · mock data
          </span>
          <span className="status-pill">
            <i />
            System Online
          </span>
          <span>GMT+7 (WIB Zone)</span>
        </Reveal>
      </div>
    </footer>
  );
}
