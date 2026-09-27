import { notFound, redirect } from "next/navigation";
import { requireHubUser } from "@/lib/auth";
import { getMemberDirectory } from "@/lib/projects/queries";
import { getProjects } from "@/lib/projects/queries";
import { getTasks } from "@/lib/tasks/queries";
import { getReport } from "@/lib/reports/queries";
import { resolveReportNames } from "@/lib/reports/types";
import ReportDetail from "@/components/reports/ReportDetail";

interface Params {
  params: { id: string };
}

export async function generateMetadata({ params }: Params) {
  const { report } = await getReport(params.id);
  return {
    title: report ? `${report.title} — ATecHS Hub` : "Report — ATecHS Hub",
  };
}

/* Report detail + review — real Supabase record; unknown id → 404.
   Reporter/reviewer names resolve via the member directory. */
export default async function ReportDetailPage({ params }: Params) {
  const hub = await requireHubUser();
  if (!hub) redirect("/login");

  const [{ report, error }, directory, taskRes, projRes] = await Promise.all([
    getReport(params.id),
    getMemberDirectory(),
    getTasks(),
    getProjects(),
  ]);

  if (error) throw new Error(error); // → hub/reports/error.tsx boundary
  if (!report) notFound();

  const [named] = resolveReportNames([report], directory);

  return (
    <ReportDetail
      role={hub.profile.role}
      viewerId={hub.profile.id}
      viewerDeptId={hub.profile.department_id}
      report={named}
      tasks={taskRes.tasks}
      projects={projRes.projects}
    />
  );
}
