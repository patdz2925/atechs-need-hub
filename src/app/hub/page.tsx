import { redirect } from "next/navigation";
import { requireHubUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard/data";
import Dashboard from "@/components/hub/Dashboard";

/* First page after sign-in: the role-aware Hub Dashboard. */
export default async function HubPage() {
  const hub = await requireHubUser();
  if (!hub) redirect("/login");

  const data = await getDashboardData();

  return (
    <Dashboard
      role={hub.profile.role}
      viewerName={hub.profile.name}
      viewerEmail={hub.user.email ?? ""}
      viewerId={hub.profile.id}
      data={data}
    />
  );
}
