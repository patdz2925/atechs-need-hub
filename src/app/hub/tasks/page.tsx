import { redirect } from "next/navigation";
import { requireHubUser } from "@/lib/auth";
import { getMemberDirectory } from "@/lib/projects/queries";
import { getTasks } from "@/lib/tasks/queries";
import MyTasksView from "@/components/tasks/MyTasksView";

export const metadata = {
  title: "My Tasks — ATecHS Hub",
};

/* Personal task queue — real Supabase rows (RLS: what you may see).
   Rows are filtered to "assigned to me" client-side by default; the
   viewer id comes from the server session, never from the client. */
export default async function MyTasksPage() {
  const hub = await requireHubUser();
  if (!hub) redirect("/login");

  const [res, directory] = await Promise.all([getTasks(), getMemberDirectory()]);

  return (
    <MyTasksView
      role={hub.profile.role}
      viewerId={hub.profile.id}
      viewerName={hub.profile.name}
      tasks={res.tasks}
      directory={directory}
      loadError={res.error}
    />
  );
}
