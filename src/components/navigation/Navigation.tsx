"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BrandLogo, BrandMark } from "@/components/Brand";

const LINKS = [
  { label: "Events", href: "#events" },
  { label: "Media", href: "#media" },
  { label: "Organization", href: "#organization" },
  { label: "Timeline", href: "#timeline" },
  { label: "Evaluation", href: "#evaluation" },
];

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open ]);

  return (
    <>
      <header className={`nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="container nav-inner">
          <Link
            className="brand"
            href="#top"
            aria-label="ATecHS Hub home"
            onClick={() => setOpen(false)}
          >
            <BrandLogo />
            <BrandMark />
          </Link>
          <nav className="nav-links" aria-label="Primary">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
            <Link className="nav-signin" href="/login">
              Sign In
            </Link>
          </nav>
          <button
            className="nav-toggle"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="mobileMenu"
            onClick={() => setOpen(true)}
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      <div
        className={`mobile-menu${open ? " is-open" : ""}`}
        id="mobileMenu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <button className="mobile-close" aria-label="Close menu" onClick={() => setOpen(false)}>
          <X size={24} />
        </button>
        {LINKS.map((l, i) => (
          <a
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            style={open ? { transitionDelay: `${80 + i * 70}ms` } : undefined}
          >
            {l.label}
          </a>
        ))}
        <Link
          className="nav-signin"
          href="/login"
          onClick={() => setOpen(false)}
          style={open ? { transitionDelay: `${80 + LINKS.length * 70}ms` } : undefined}
        >
          Sign In
        </Link>
      </div>
    </>
  );
}
