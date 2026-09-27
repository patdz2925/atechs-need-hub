/* Demo data — Recent organizational activity (development milestone). */

export interface DemoActivity {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
}

export const demoActivity: DemoActivity[] = [
  { id: "a-1", actor: "Test President", action: "approved", target: "Foundation Day after-action report", time: "2h ago" },
  { id: "a-2", actor: "Test Member", action: "submitted", target: "Tech Talk prep progress report", time: "4h ago" },
  { id: "a-3", actor: "M. Santos", action: "uploaded", target: "6 photos to Media Coverage Drive", time: "Yesterday" },
  { id: "a-4", actor: "J. Reyes", action: "updated progress on", target: "Hub Platform Revamp → 60%", time: "Yesterday" },
  { id: "a-5", actor: "D. Ramos", action: "scheduled", target: "Freshman Orientation booths briefing", time: "2 days ago" },
  { id: "a-6", actor: "A. Villanueva", action: "commented on", target: "Employees' Week program flow", time: "3 days ago" },
];
