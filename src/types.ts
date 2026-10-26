export type Gender = "Not specified" | "Female" | "Male" | "Prefer not to say";

export interface Employee {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  role: string;
  department: string;
  initials: string;
  color: string;
  available: boolean;
  experience: number;
  projects: number;
  skills: Record<string, number>;
}
export type EmployeeInput = Omit<Employee, "id"> & { id?: number };
export interface Folder {
  id: string;
  name: string;
  color: string;
}
export interface Skill {
  id: string;
  name: string;
  folderId: string;
}
export interface Catalog {
  folders: Folder[];
  skills: Skill[];
}
export interface SkillInput {
  id?: string;
  name: string;
  folderId: string;
}
export interface FolderInput {
  id?: string;
  name: string;
}
export type AffectedEmployee = Pick<Employee, "id" | "name"> & {
  skills?: Record<string, number>;
};
export interface ApiError {
  message: string;
  affectedEmployees?: AffectedEmployee[];
}
export interface WorkspaceSnapshot {
  catalog: Catalog;
  employees: Employee[];
  seedRevision?: number;
  employeeGenderRevision?: number;
  renamedSkill?: { from: string; to: string } | null;
  deletedSkill?: string;
}
export type RequestStatus = "idle" | "loading" | "succeeded" | "failed";
export interface EmployeesState {
  items: Employee[];
  status: RequestStatus;
  error: string | null;
  query: string;
  department: string;
  availability: string;
}
export interface CatalogState extends Catalog {
  saving: boolean;
}
export interface Criterion {
  skill: string;
  weight: number;
}
export interface Preset {
  name: string;
  icon: string;
  client: string;
  title: string;
  description: string;
  criteria: Criterion[];
}
export interface RankedMatch {
  employee: Employee;
  score: number;
  contributions: (Criterion & { level: number })[];
}
export interface LegacyScenarioState extends Preset {
  onlyAvailable: boolean;
  results: RankedMatch[];
  status: RequestStatus;
  error: string | null;
  requestId: string | null;
}
export interface SkillRequirement {
  skill: string;
  count: number;
}
export interface ScenarioDraft {
  client: string;
  title: string;
  description: string;
  headcount: number;
  requirements: SkillRequirement[];
  onlyAvailable: boolean;
}
export type Selections = Record<string, number[]>;
export interface Candidate {
  employee: Employee;
  score: number;
  level: number;
}
export interface CandidateGroup extends SkillRequirement {
  candidates: Candidate[];
}
export interface TeamMember extends Pick<
  Employee,
  "name" | "role" | "department" | "initials" | "color"
> {
  employeeId: number;
  level: number;
  score: number;
}
export interface TeamGroup extends SkillRequirement {
  members: TeamMember[];
  averageScore: number;
}
export interface TeamSummary {
  headcount: number;
  averageScore: number;
  groups: TeamGroup[];
}
export interface SavedScenario extends Omit<ScenarioDraft, "title"> {
  id: string;
  title: string;
  projectTitle: string;
  summary: TeamSummary;
  createdAt: string;
  updatedAt?: string;
}
export interface PlanningState {
  draft: ScenarioDraft;
  step: number;
  selections: Selections;
  candidates: CandidateGroup[];
  status: RequestStatus;
  requestId: string | null;
  error: string | null;
  notice: string | null;
  saved: SavedScenario[];
  savedStatus: RequestStatus;
  libraryError: string | null;
  saveStatus: RequestStatus;
  activeSavedId: string | null;
  editingScenarioId: string | null;
}
export interface AppState {
  employees: EmployeesState;
  catalog: CatalogState;
  scenario: LegacyScenarioState;
  planning: PlanningState;
}
export type ToastHandler = (message: string) => void;
export type Page = "skills" | "scenarios";
export type CatalogEditorState =
  | { mode: "skill"; item?: Skill; folderId?: string }
  | { mode: "folder"; item?: Folder; folderId?: never };
export type CatalogDeleteState =
  { mode: "skill"; item: Skill } | { mode: "folder"; item: Folder };
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface ScenarioPayload {
  draft: ScenarioDraft;
  selections: Selections;
}
