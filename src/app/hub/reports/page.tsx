import { redirect } from "next/navigation";
import { requireHubUser } from "@/lib/auth";
import { getDepartments, getMemberDirectory, getProjects } from "@/lib/projects/queries";
import { getReports } from "@/lib/reports/queries";
import { resolveReportNames } from "@/lib/reports/types";
import ReportsView from "@/components/reports/ReportsView";

export const metadata = {
  title: "Reports — ATecHS Hub",
};

/* Reports overview — real Supabase rows (RLS: what you may see).
   Reporter/reviewer names resolve via the member directory; the
   directory never exposes emails. */
export default async function ReportsPage() {
  const hub = await requireHubUser();
  if (!hub) redirect("/login");

  const [res, directory, departments, projRes] = await Promise.all([
    getReports(),
    getMemberDirectory(),
    getDepartments(),
    getProjects(),
  ]);

  return (
    <ReportsView
      role={hub.profile.role}
      viewerId={hub.profile.id}
      viewerDeptId={hub.profile.department_id}
      reports={resolveReportNames(res.reports, directory)}
      directory={directory}
      departments={departments}
      projects={projRes.projects}
      loadError={res.error}
    />
  );
}
