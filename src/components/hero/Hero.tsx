"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Image as ImageIcon, Mail } from "lucide-react";
import { organization } from "@/data/events";
import HeroBadge from "@/components/hero/HeroBadge";
import { BrandLogo } from "@/components/Brand";

export default function Hero() {
  const [loaded, setLoaded] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const words = organization.pillars;

  useEffect(() => {
    const raf = window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => setLoaded(true))
    );
    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (words.length < 2) return;
    const id = window.setInterval(() => {
      setFading(true);
      window.setTimeout(() => {
        setWordIndex((i) => (i + 1) % words.length);
        setFading(false);
      }, 380);
    }, 2600);
    return () => window.clearInterval(id);
  }, [words]);

  return (
    <section className={`hero${loaded ? " is-loaded" : ""}`} aria-label="ATecHS Hub introduction">
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-grid" />
        <div className="hero-fade" />
        <div className="hero-blob" />
      </div>

      <div className="hero-inner" id="top">
        <div className="container hero-grid-cols">
          <div className="hero-copy">
            <div className="hero-quicklinks" data-enter="fade" style={{ animationDelay: ".2s" }}>
              <a href="#events" aria-label="Jump to events">
                <CalendarDays />
              </a>
              <a href="#media" aria-label="Jump to media bank">
                <ImageIcon />
              </a>
              <a href="#evaluation" aria-label="Jump to evaluation">
                <Mail />
              </a>
            </div>

            <p className="hero-eyebrow" data-enter="left" style={{ animationDelay: ".4s" }}>
              <BrandLogo />
              ATecHS Society · Assumpta Technical High School
            </p>

            <h1 className="hero-title" data-enter="right" style={{ animationDelay: ".6s" }}>
              ATecHS <span className="accent">Hub.</span>
            </h1>

            <p className="hero-sub" data-enter="fade" style={{ animationDelay: "1s" }}>
              The <strong>digital home</strong> of ATecHS Society —{" "}
              <span className={`hero-rotator${fading ? " is-fading" : ""}`}>{words[wordIndex]}</span>
              <span className="caret" aria-hidden="true" />.
            </p>

            <div className="hero-cta">
              <a
                className="btn btn-primary"
                href="#events"
                data-enter="fade"
                style={{ animationDelay: "1.5s" }}
              >
                Explore Events <ArrowRight size={20} />
              </a>
              <a
                className="btn btn-ghost"
                href="#media"
                data-enter="fade"
                style={{ animationDelay: "1.8s" }}
              >
                Media Bank
              </a>
            </div>
          </div>

          <div className="hero-visual" data-enter="fade" style={{ animationDelay: ".8s" }}>
            <HeroBadge />
          </div>
        </div>
      </div>

      <div className="scroll-hint" data-enter="fade" style={{ animationDelay: "2.2s" }} aria-hidden="true">
        <small>Scroll</small>
        <div className="scroll-mouse">
          <div className="scroll-wheel" />
        </div>
        <div className="scroll-swipe">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 14a8 8 0 0 1-8 8" />
            <path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1" />
            <path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1" />
            <path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10" />
            <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
          </svg>
        </div>
      </div>
    </section>
  );
}
