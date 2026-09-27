/* ============================================================
   ATecHS Hub — Content data (mock data for Phase 1 preview)
   Presentation components render from these objects, so real
   data (or future API responses) can replace this file later
   without touching the UI.
   ============================================================ */

export interface EventItem {
  id: string;
  title: string;
  status: "current" | "upcoming" | "completed";
  department: string;
  date: string;
  description: string;
  progress?: number;
  tags?: string[];
  impact?: string;
  media?: string[];
}

export interface MediaCategory {
  id: "photos" | "videos" | "graphics" | "documents";
  title: string;
  count: number;
}

export interface TimelineEntry {
  year: string;
  title: string;
  status: "current" | "completed";
  description: string;
}

export interface Stat {
  value: number;
  suffix: string;
  label: string;
  sub: string;
}

export const currentEvents: EventItem[] = [
  {
    id: "employees-week",
    title: "Employees' Week",
    status: "current",
    department: "ATecHS Society",
    date: "September 2026",
    description:
      "The annual Employees' Week celebration bringing together all ATecHS members for collaboration, team-building, and organizational growth.",
    progress: 82,
    media: [],
  },
  {
    id: "tech-talk-2026",
    title: "Tech Talk 2026",
    status: "current",
    department: "Technical Division",
    date: "September 2026",
    description:
      "An intensive technical workshop series covering modern development practices, architecture patterns, and emerging technologies.",
    progress: 65,
    media: [],
  },
];

export const upcomingEvents: EventItem[] = [
  {
    id: "foundation-day",
    title: "Foundation Day Celebration",
    status: "upcoming",
    department: "Events & Ceremonies",
    date: "October 2026",
    description:
      "Commemorating ATecHS Society's founding anniversary with speeches, awards, and community programs.",
    tags: ["Ceremony", "Awards", "Community"],
  },
  {
    id: "innovation-challenge",
    title: "Innovation Challenge",
    status: "upcoming",
    department: "Technical Division",
    date: "November 2026",
    description:
      "A competition challenging members to build innovative solutions with modern technology and ATecHS principles.",
    tags: ["Competition", "Prototyping", "Teamwork"],
  },
  {
    id: "community-outreach",
    title: "Community Outreach Program",
    status: "upcoming",
    department: "Social Development",
    date: "December 2026",
    description:
      "Extending ATecHS Society's impact through community engagement and technology education initiatives.",
    tags: ["Education", "Volunteering", "Outreach"],
  },
];

export const accomplishedEvents: EventItem[] = [
  {
    id: "employees-week-2025",
    title: "Employees' Week 2025",
    status: "completed",
    department: "ATecHS Society",
    date: "September 2025",
    description:
      "A landmark celebration marking the growth of ATecHS Society, with record participation across every planned activity.",
    tags: ["Celebration", "Team-Building", "Awards"],
    impact: "Record turnout with every planned activity delivered on schedule.",
  },
  {
    id: "tech-talk-2025",
    title: "Tech Talk Series",
    status: "completed",
    department: "Technical Division",
    date: "August 2025",
    description:
      "A successful multi-session technical workshop covering modern stacks and full-stack architecture patterns.",
    tags: ["Flutter", "Next.js", "Golang"],
    impact: "Members shipped demo projects built on modern full-stack patterns.",
  },
  {
    id: "foundation-activity",
    title: "Foundation Support Activity",
    status: "completed",
    department: "Community Relations",
    date: "July 2025",
    description:
      "ATecHS Society supported foundation programs through technical assistance, digital setup, and educational workshops.",
    tags: ["Outreach", "Infrastructure", "Workshops"],
    impact: "Foundation programs moved from paper records to organized digital files.",
  },
  {
    id: "digital-launch",
    title: "Digital Platform Launch",
    status: "completed",
    department: "Executive Board",
    date: "June 2025",
    description:
      "Launched the ATecHS digital platform to streamline communication, project tracking, and organizational workflows.",
    tags: ["Platform", "Workflows", "Hub"],
    impact: "Communication and project tracking centralized in one place.",
  },
];

export const mediaCategories: MediaCategory[] = [
  { id: "photos", title: "Photos", count: 248 },
  { id: "videos", title: "Videos", count: 36 },
  { id: "graphics", title: "Graphics", count: 89 },
  { id: "documents", title: "Documents", count: 124 },
];

export const organization = {
  name: "ATecHS Society",
  fullName: "Association of Technological and Engineering Students",
  description:
    "A student organization uniting future technologists and engineers — learning together, building together, and serving the community through technology.",
  mission: "Empowering future leaders through technology, collaboration, and innovation.",
  vision:
    "To be the premier student organization driving technological advancement and community impact.",
  members: "500+",
  departments: [
    "Technical Division",
    "Events & Ceremonies",
    "Social Development",
    "Executive Board",
    "Community Relations",
  ],
  pillars: ["Events", "Projects", "Media", "Community"],
};

export const stats: Stat[] = [
  { value: 9, suffix: "", label: "Events Tracked", sub: "Current, upcoming & done" },
  { value: 497, suffix: "", label: "Media Items", sub: "Photos, videos & docs" },
  { value: 5, suffix: "", label: "Departments", sub: "Across the society" },
  { value: 500, suffix: "+", label: "Active Members", sub: "And growing" },
];

export const marqueeItems: string[] = [
  "Events",
  "Technical Division",
  "Media Bank",
  "Community",
  "Innovation",
  "Leadership",
  "Workshops",
  "Outreach",
];

export const timeline: TimelineEntry[] = [
  {
    year: "2026",
    title: "Employees' Week",
    status: "current",
    description: "Current program — the annual celebration of ATecHS Society members.",
  },
  {
    year: "2026",
    title: "Tech Talk",
    status: "completed",
    description: "Completed technical workshop series for the year.",
  },
  {
    year: "2026",
    title: "Foundation Activity",
    status: "completed",
    description: "Completed contribution to foundation digital programs.",
  },
  {
    year: "2025",
    title: "Digital Platform Launch",
    status: "completed",
    description: "Launched the official ATecHS digital hub.",
  },
  {
    year: "2025",
    title: "Tech Talk Series",
    status: "completed",
    description: "Multi-session workshops covering modern tech stacks.",
  },
  {
    year: "2025",
    title: "Employees' Week 2025",
    status: "completed",
    description: "Record participation in the annual celebration.",
  },
];
