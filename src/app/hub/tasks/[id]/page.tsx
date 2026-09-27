import { notFound, redirect } from "next/navigation";
import { requireHubUser } from "@/lib/auth";
import { getMemberDirectory } from "@/lib/projects/queries";
import { getTask } from "@/lib/tasks/queries";
import { getTaskReports } from "@/lib/reports/queries";
import { resolveReportNames } from "@/lib/reports/types";
import TaskDetail from "@/components/tasks/TaskDetail";

interface Params {
  params: { id: string };
}

export async function generateMetadata({ params }: Params) {
  const { task } = await getTask(params.id);
  return {
    title: task ? `${task.title} — ATecHS Hub` : "Task — ATecHS Hub",
  };
}

/* Task detail — real Supabase record; unknown id → 404. */
export default async function TaskDetailPage({ params }: Params) {
  const hub = await requireHubUser();
  if (!hub) redirect("/login");

  const [{ task, error }, directory, reportRes] = await Promise.all([
    getTask(params.id),
    getMemberDirectory(),
    getTaskReports(params.id),
  ]);

  if (error) throw new Error(error); // → hub/tasks/error.tsx boundary
  if (!task) notFound();

  return (
    <TaskDetail
      role={hub.profile.role}
      viewerId={hub.profile.id}
      task={task}
      directory={directory}
      reports={resolveReportNames(reportRes.reports, directory)}
    />
  );
}
