/* Demo data — Tasks (development milestone; swapped for Supabase later).
   assignees: member emails, or "all" for department/society-wide tasks. */

export interface DemoTask {
  id: string;
  title: string;
  project: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  assignees: string[];
  due: string;
}

export const demoTasks: DemoTask[] = [
  {
    id: "t-1",
    title: "Finalize Employees' Week program flow",
    project: "Employees' Week",
    status: "in_progress",
    priority: "high",
    assignees: ["president.test@atecshub.local"],
    due: "Oct 3, 2026",
  },
  {
    id: "t-2",
    title: "Publish Tech Talk speaker lineup",
    project: "ATecHS Tech Talk",
    status: "in_progress",
    priority: "medium",
    assignees: ["all"],
    due: "Oct 8, 2026",
  },
  {
    id: "t-3",
    title: "Optimize Hub event card loading",
    project: "Hub Platform Revamp",
    status: "in_progress",
    priority: "medium",
    assignees: ["member.test@atecshub.local"],
    due: "Oct 1, 2026",
  },
  {
    id: "t-4",
    title: "Collect media consent forms for Q4",
    project: "Media Coverage Drive",
    status: "todo",
    priority: "low",
    assignees: ["member.test@atecshub.local", "all"],
    due: "Oct 12, 2026",
  },
  {
    id: "t-5",
    title: "Draft orientation department booths plan",
    project: "Freshman Orientation",
    status: "todo",
    priority: "medium",
    assignees: ["all"],
    due: "Oct 20, 2026",
  },
  {
    id: "t-6",
    title: "Archive Foundation Day media assets",
    project: "Foundation Day",
    status: "done",
    priority: "low",
    assignees: ["member.test@atecshub.local"],
    due: "Sep 12, 2026",
  },
  {
    id: "t-7",
    title: "Submit outreach impact summary",
    project: "Community Outreach Day",
    status: "done",
    priority: "medium",
    assignees: ["president.test@atecshub.local"],
    due: "Sep 5, 2026",
  },
];
