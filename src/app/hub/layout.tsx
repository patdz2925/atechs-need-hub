import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireHubUser } from "@/lib/auth";
import HubShell from "@/components/hub/HubShell";

export const metadata = {
  title: "Workspace — ATecHS Hub",
};

/* Protected shell: valid session required (middleware guards too). */
export default async function HubLayout({ children }: { children: ReactNode }) {
  const hub = await requireHubUser();
  if (!hub) redirect("/login");
  return <HubShell profile={hub.profile}>{children}</HubShell>;
}
