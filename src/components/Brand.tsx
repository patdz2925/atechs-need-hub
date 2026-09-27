import type { ReactNode } from "react";

/* ------------------------------------------------------------------
   ATecHS Society — brand primitives.

   The single place that knows the canonical logo asset and the
   wordmark, so rebranding means replacing one file in /public (plus
   BRAND_LOGO below if the filename ever changes) instead of hunting
   through components.

   Asset: public/atechs-logo.png
     · official ATecHS Society seal, 2048 × 2048, transparent corners
     · copied byte-for-byte from the source artwork — never redraw,
       re-encode, recolor, or crop it
     · rendered from a square source into a square box via
       object-fit: contain, so it can never be distorted
   ------------------------------------------------------------------ */

/** Canonical logo asset (files in /public are served from the site root). */
export const BRAND_LOGO = "/atechs-logo.png";

/** Canonical organization name. */
export const BRAND_NAME = "ATecHS Society";

/** Alt text for a standalone logo — omit where the copy already says the name. */
export const BRAND_ALT = `${BRAND_NAME} logo`;

interface BrandLogoProps {
  /**
   * Accessible name for the image. Defaults to "" (decorative): every lockup
   * in the app already exposes the organization name as text or aria-label,
   * so a non-empty alt would only repeat it. Pass BRAND_ALT when the logo
   * stands on its own.
   */
  alt?: string;
  className?: string;
}

/**
 * The official seal. Display size comes from `--logo-size` (set per context
 * in CSS, default 1.75rem), so each placement scales without new assets.
 */
export function BrandLogo({ alt = "", className }: BrandLogoProps) {
  return (
    <img
      src={BRAND_LOGO}
      alt={alt}
      decoding="async"
      className={className ? `brand-logo ${className}` : "brand-logo"}
    />
  );
}

interface BrandMarkProps {
  /** Trailing text after the wordmark (the Hub shell appends " workspace"). */
  suffix?: ReactNode;
}

/** The ATecHS Hub wordmark: <ATecHS.hub/> */
export function BrandMark({ suffix }: BrandMarkProps) {
  return (
    <span className="brand-mark">
      <span className="accent">&lt;</span>ATecHS<span className="accent">.</span>hub
      <span className="accent">/&gt;</span>
      {suffix ? (
        <>
          {" "}
          {suffix}
        </>
      ) : null}
    </span>
  );
}
