import { redirect } from "next/navigation";
import { requireHubUser } from "@/lib/auth";
import { getProjects } from "@/lib/projects/queries";
import { getTasks } from "@/lib/tasks/queries";
import ReportForm from "@/components/reports/ReportForm";

export const metadata = {
  title: "New Report — ATecHS Hub",
};

interface NewReportPageProps {
  searchParams?: { task?: string };
}

/* File a report — the task picker lists tasks assigned to the viewer
   (server-session id); an optional ?task= deep link preselects one. */
export default async function NewReportPage({ searchParams }: NewReportPageProps) {
  const hub = await requireHubUser();
  if (!hub) redirect("/login");

  const [taskRes, projRes] = await Promise.all([getTasks(), getProjects()]);

  return (
    <>
      <div className="pj-head">
        <div>
          <h1>New report</h1>
          <p className="pj-head-sub">Report on work assigned to you</p>
        </div>
      </div>
      {taskRes.error ? (
        <div className="pj-alert" role="alert">
          <span>
            Couldn&rsquo;t load your tasks: <strong>{taskRes.error}</strong>
          </span>
        </div>
      ) : (
        <ReportForm
          mode="create"
          viewerId={hub.profile.id}
          role={hub.profile.role}
          tasks={taskRes.tasks}
          projects={projRes.projects}
          initialTaskId={searchParams?.task}
          initial={null}
        />
      )}
    </>
  );
}
