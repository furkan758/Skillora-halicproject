import type { Employee, Folder, Preset, Skill } from "../types";
import {
  additionalEmployees,
  additionalFolderSkills,
  additionalFolders,
} from "./mockExpansion";

export const initialEmployees: Employee[] = [
  {
    id: 1,
    name: "Elif Yılmaz",
    firstName: "Elif",
    lastName: "Yılmaz",
    gender: "Female",
    role: "Senior Frontend Developer",
    department: "Engineering",
    initials: "EY",
    color: "peach",
    available: true,
    experience: 6,
    projects: 12,
    skills: {
      React: 5,
      TypeScript: 5,
      "Next.js": 4,
      "UI Development": 5,
      JavaScript: 5,
      Git: 4,
    },
  },
  {
    id: 2,
    name: "Mert Demir",
    firstName: "Mert",
    lastName: "Demir",
    gender: "Male",
    role: "Product Designer",
    department: "Design",
    initials: "MD",
    color: "purple",
    available: true,
    experience: 4,
    projects: 9,
    skills: {
      Figma: 5,
      "UI/UX Design": 5,
      Prototyping: 4,
      "User Research": 4,
      "Design System": 5,
    },
  },
  {
    id: 3,
    name: "Zeynep Kaya",
    firstName: "Zeynep",
    lastName: "Kaya",
    gender: "Female",
    role: "Full Stack Developer",
    department: "Engineering",
    initials: "ZK",
    color: "blue",
    available: false,
    experience: 5,
    projects: 14,
    skills: {
      React: 4,
      "Node.js": 5,
      PostgreSQL: 4,
      TypeScript: 4,
      Docker: 3,
      Git: 5,
    },
  },
  {
    id: 4,
    name: "Can Arslan",
    firstName: "Can",
    lastName: "Arslan",
    gender: "Male",
    role: "Backend Developer",
    department: "Engineering",
    initials: "CA",
    color: "sage",
    available: true,
    experience: 7,
    projects: 18,
    skills: {
      Python: 5,
      Django: 5,
      PostgreSQL: 5,
      "API Development": 5,
      Docker: 4,
      Git: 5,
    },
  },
  {
    id: 5,
    name: "Selin Aydın",
    firstName: "Selin",
    lastName: "Aydın",
    gender: "Female",
    role: "Project Manager",
    department: "Management",
    initials: "SA",
    color: "rose",
    available: false,
    experience: 6,
    projects: 21,
    skills: {
      Agile: 5,
      Scrum: 5,
      "Project Management": 5,
      "Client Communication": 5,
      Jira: 4,
    },
  },
  {
    id: 6,
    name: "Emre Çelik",
    firstName: "Emre",
    lastName: "Çelik",
    gender: "Male",
    role: "Frontend Developer",
    department: "Engineering",
    initials: "EÇ",
    color: "sand",
    available: true,
    experience: 3,
    projects: 7,
    skills: { React: 4, JavaScript: 4, "UI Development": 4, CSS: 5, Git: 4 },
  },
  ...additionalEmployees,
];
export const departmentOptions = [
  ...new Set(initialEmployees.map((e) => e.department)),
].sort((a, b) => a.localeCompare(b, "en"));
export const initialFolders: Folder[] = [
  { id: "frontend", name: "Frontend", color: "blue" },
  { id: "backend", name: "Backend", color: "sage" },
  { id: "design", name: "Design", color: "purple" },
  { id: "management", name: "Management", color: "sand" },
  { id: "devops", name: "DevOps", color: "peach" },
  ...additionalFolders,
  { id: "unsorted", name: "Unsorted", color: "sage" },
];
const defaultSkillFolders: Record<string, string[]> = {
  frontend: ["React", "JavaScript", "TypeScript", "CSS", "UI Development"],
  backend: [
    "Next.js",
    "Node.js",
    "Python",
    "Django",
    "PostgreSQL",
    "API Development",
  ],
  design: [
    "Figma",
    "UI/UX Design",
    "Prototyping",
    "User Research",
    "Design System",
  ],
  management: [
    "Agile",
    "Scrum",
    "Project Management",
    "Client Communication",
    "Jira",
  ],
  devops: ["Git", "Docker"],
};
// Keep the original 23 skill IDs stable so existing browser edits still match.
const legacyNames = [
  ...new Set(
    initialEmployees.slice(0, 6).flatMap((e) => Object.keys(e.skills)),
  ),
].sort((a, b) => a.localeCompare(b, "en"));
const folderSkills = Object.fromEntries(
  Object.keys({ ...defaultSkillFolders, ...additionalFolderSkills }).map(
    (id) => [
      id,
      [
        ...(defaultSkillFolders[id] || []),
        ...(additionalFolderSkills[id] || []),
      ],
    ],
  ),
);
export const skillOptions = [
  ...new Set(Object.values(folderSkills).flat()),
].sort((a, b) => a.localeCompare(b, "en"));
export const initialSkillCatalog: Skill[] = skillOptions.map((name) => ({
  id: legacyNames.includes(name)
    ? `skill-${legacyNames.indexOf(name) + 1}`
    : `seed-skill-${encodeURIComponent(name.toLowerCase())}`,
  name,
  folderId:
    Object.keys(folderSkills).find((id) => folderSkills[id].includes(name)) ||
    "unsorted",
}));
export const demoExpansion = {
  revision: 1,
  employees: additionalEmployees,
  folders: additionalFolders,
  skills: initialSkillCatalog.filter((s) => !legacyNames.includes(s.name)),
};
export const presets: Preset[] = [
  {
    name: "Website",
    icon: "web",
    client: "OpenAI",
    title: "Corporate website",
    description:
      "A modern, fast, and accessible corporate website. We are looking for a team member with React and TypeScript experience and a strong eye for interfaces.",
    criteria: [
      { skill: "React", weight: 5 },
      { skill: "TypeScript", weight: 4 },
      { skill: "UI Development", weight: 3 },
    ],
  },
  {
    name: "Product design",
    icon: "design",
    client: "Acme",
    title: "New product experience",
    description:
      "Design a user-centered interface and an interactive prototype for our new digital product.",
    criteria: [
      { skill: "Figma", weight: 5 },
      { skill: "UI/UX Design", weight: 5 },
      { skill: "Prototyping", weight: 3 },
    ],
  },
  {
    name: "API development",
    icon: "code",
    client: "Nova",
    title: "Customer management API",
    description:
      "Build a PostgreSQL-backed API to manage customer records and business operations.",
    criteria: [
      { skill: "API Development", weight: 5 },
      { skill: "Python", weight: 4 },
      { skill: "PostgreSQL", weight: 4 },
    ],
  },
];
