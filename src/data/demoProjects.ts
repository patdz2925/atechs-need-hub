/* ============================================================
   Demo data — Projects (development milestone)
   Swapped later for a Supabase `projects` query inside
   src/lib/dashboard/data.ts — UI components never import this.
   ============================================================ */

export interface DemoProject {
  id: string;
  name: string;
  status: "active" | "upcoming" | "accomplished";
  progress: number; // 0–100
  department: string;
  owner: string;
  due: string;
  description: string;
}

export const demoProjects: DemoProject[] = [
  {
    id: "p-employees-week",
    name: "Employees' Week",
    status: "active",
    progress: 82,
    department: "Executive Board",
    owner: "Test President",
    due: "November 2026",
    description: "Annual celebration of ATecHS Society members — programs, awards, and community day.",
  },
  {
    id: "p-media-drive",
    name: "Media Coverage Drive",
    status: "active",
    progress: 45,
    department: "Social Development",
    owner: "M. Santos",
    due: "October 2026",
    description: "Photo, video, and graphic coverage for all Q4 events across departments.",
  },
  {
    id: "p-web-revamp",
    name: "Hub Platform Revamp",
    status: "active",
    progress: 60,
    department: "Technical Division",
    owner: "Test Member",
    due: "October 2026",
    description: "Improve the ATecHS Hub experience: performance, accessibility, and member tools.",
  },
  {
    id: "p-tech-talk",
    name: "ATecHS Tech Talk",
    status: "upcoming",
    progress: 0,
    department: "Technical Division",
    owner: "J. Reyes",
    due: "October 2026",
    description: "Industry speaker series on modern full-stack and mobile development.",
  },
  {
    id: "p-orientation",
    name: "Freshman Orientation",
    status: "upcoming",
    progress: 0,
    department: "Events & Ceremonies",
    owner: "A. Lim",
    due: "December 2026",
    description: "Onboarding program introducing new members to society programs and departments.",
  },
  {
    id: "p-foundation-day",
    name: "Foundation Day",
    status: "accomplished",
    progress: 100,
    department: "Events & Ceremonies",
    owner: "Test President",
    due: "2026",
    description: "Society founding anniversary celebration with exhibits and community outreach.",
  },
  {
    id: "p-outreach",
    name: "Community Outreach Day",
    status: "accomplished",
    progress: 100,
    department: "Community Relations",
    owner: "R. Cruz",
    due: "2026",
    description: "Literacy and digital-literacy outreach with partner communities.",
  },
];
