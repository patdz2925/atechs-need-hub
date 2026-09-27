"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { BrandLogo, BrandMark } from "@/components/Brand";

interface NavItem {
  label: string;
  href: string;
  roles?: Role[]; // hidden unless the viewer's role is listed
  soon?: boolean; // module not built yet — shown disabled
}

/* Role-conditional navigation (visibility = UI only; real enforcement = RLS). */
const NAV: NavItem[] = [
  { label: "Overview", href: "/hub" },
  { label: "Projects", href: "/hub/projects" },
  { label: "Tasks", href: "/hub/tasks" },
  { label: "Reports", href: "/hub/reports" },
  { label: "Media Bank", href: "/hub/media" },
  { label: "Evaluations", href: "/hub/evaluations", soon: true },
  { label: "Activity", href: "/hub/activity", soon: true },
  { label: "Members", href: "/hub/members", roles: ["president", "vice_president"], soon: true },
  { label: "Departments", href: "/hub/departments", roles: ["president", "vice_president"], soon: true },
  { label: "Settings", href: "/hub/settings", roles: ["president"], soon: true },
];

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

interface HubShellProps {
  profile: { name: string; role: Role; department_id: string | null };
  children: ReactNode;
}

export default function HubShell({ profile, children }: HubShellProps) {
  const pathname = usePathname();
  const visible = NAV.filter((i) => !i.roles || i.roles.includes(profile.role));

  /* Overview only matches /hub; nested routes light up their own item. */
  const isActive = (href: string) =>
    href === "/hub"
      ? pathname === "/hub"
      : pathname === href || pathname.startsWith(`${href}/`);

  const onSignOut = async () => {
    const supabase = getBrowserSupabase();
    await supabase?.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="hub">
      <header className="hub-top">
        <div className="container hub-top-inner">
          <Link href="/" className="hub-brand" aria-label="ATecHS Hub — public site">
            <BrandLogo />
            <BrandMark suffix="workspace" />
          </Link>

          <nav className="hub-nav" aria-label="Hub">
            {visible.map((item) =>
              item.soon ? (
                <span key={item.href} className="is-soon" title="Arrives in a later milestone">
                  {item.label}
                </span>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive(item.href) ? "is-active" : undefined}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          <div className="hub-right">
            <div className="hub-chip">
              <span className="hub-initials" aria-hidden="true">
                {initials(profile.name)}
              </span>
              <span className="hub-meta">
                <strong>{profile.name}</strong>
                <span>{ROLE_LABEL[profile.role]}</span>
              </span>
            </div>
            <button className="hub-signout" onClick={onSignOut}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="container hub-main" id="content">
        {children}
      </main>
    </div>
  );
}
