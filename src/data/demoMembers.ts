/* Demo data — Members (development milestone; swapped for Supabase later).
   First two rows are the dedicated TEST accounts from the auth setup. */

import type { Role } from "@/lib/roles";

export interface DemoMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
}

export const demoMembers: DemoMember[] = [
  {
    id: "u-test-president",
    name: "Test President",
    email: "president.test@atecshub.local",
    role: "president",
    department: "Executive Board",
  },
  {
    id: "u-test-member",
    name: "Test Member",
    email: "member.test@atecshub.local",
    role: "member",
    department: "Technical Division",
  },
  { id: "u-3", name: "A. Villanueva", email: "a.villanueva@atecshub.local", role: "vice_president", department: "Executive Board" },
  { id: "u-4", name: "D. Ramos", email: "d.ramos@atecshub.local", role: "officer", department: "Events & Ceremonies" },
  { id: "u-5", name: "Prof. E. Garcia", email: "e.garcia@atecshub.local", role: "adviser", department: "Executive Board" },
  { id: "u-6", name: "J. Reyes", email: "j.reyes@atecshub.local", role: "department_head", department: "Technical Division" },
  { id: "u-7", name: "M. Santos", email: "m.santos@atecshub.local", role: "department_head", department: "Social Development" },
  { id: "u-8", name: "R. Cruz", email: "r.cruz@atecshub.local", role: "officer", department: "Community Relations" },
  { id: "u-9", name: "L. Mendoza", email: "l.mendoza@atecshub.local", role: "member", department: "Technical Division" },
  { id: "u-10", name: "K. Panganiban", email: "k.panganiban@atecshub.local", role: "member", department: "Events & Ceremonies" },
];
