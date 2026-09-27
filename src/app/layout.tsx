import type { Metadata, Viewport } from "next";
import "../styles/tokens.css";
import "../styles/main.css";
import "../styles/hub.css";

export const metadata: Metadata = {
  title: "ATecHS Hub — The Digital Home of ATecHS Society",
  description:
    "ATecHS Hub — the digital home of ATecHS Society. Current events, upcoming plans, accomplished work, media bank, organization, timeline, and member evaluations.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
