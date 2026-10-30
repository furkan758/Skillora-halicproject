export type Gender = "Not specified" | "Female" | "Male" | "Prefer not to say";
export type RequestStatus = "idle" | "loading" | "succeeded" | "failed";
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export interface Department {
  id: number;
  name: string;
}
export interface EmployeeSkillInput {
  skillId: number;
  proficiencyLevel: number | null;
  experienceYears: number | null;
}
export interface EmployeeSkill extends EmployeeSkillInput {
  skillName: string;
  folderId: number;
}
export interface EmployeeInput {
  id?: number;
  expectedVersion?: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  jobTitle: string;
  departmentId: number;
  isAvailable: boolean;
  skills: EmployeeSkillInput[];
}
export interface Employee extends Omit<EmployeeInput, "id" | "skills" | "expectedVersion"> {
  id: number;
  version: string;
  name: string;
  department: string;
  skills: EmployeeSkill[];
}
export interface Folder {
  id: number;
  name: string;
  description: string | null;
  isDefault: boolean;
  skillCount: number;
}
export interface Skill {
  id: number;
  name: string;
  folderId: number;
  folderName: string;
  description: string | null;
  teamMemberCount: number;
  averageProficiency: number | null;
}
export interface Catalog {
  folders: Folder[];
  skills: Skill[];
}
export interface FolderInput {
  id?: number;
  name: string;
  description?: string | null;
}
export interface SkillInput extends FolderInput {
  folderId: number;
}
export interface Overview {
  employeeCount: number;
  availableCount: number;
  departmentCount: number;
  skillCount: number;
}
export interface ApiError {
  code?: string;
  retiredSkillId?: number;
  message: string;
  affectedEmployees?: { id: number; name: string }[];
  details?: { field: string; message: string }[];
}
export interface EmployeesState extends PageResult<Employee> {
  status: RequestStatus;
  error: string | null;
  requestId: string | null;
  query: string;
  department: string;
  availability: string;
}
export interface CatalogState extends Catalog {
  departments: Department[];
  overview: Overview;
  saving: boolean;
  status: RequestStatus;
  error: string | null;
  revision: number;
  requestId: string | null;
}
export interface SkillRequirement {
  skillId: number;
  count: number;
}
export interface ScenarioDraft {
  clientName: string;
  projectTitle: string;
  projectBrief: string;
  requiredPeople: number;
  requirements: SkillRequirement[];
  onlyAvailable: boolean;
}
export interface Candidate {
  employee: Employee;
  skillId: number;
  proficiencyLevel: number;
  compatibility: number;
}
// Selected snapshots survive candidate page changes; SQL validates them again on save.
export type Selections = Record<number, Candidate[]>;
export interface TeamMember {
  employeeId: number;
  firstName: string;
  lastName: string;
  name: string;
  jobTitle: string;
  department: string;
  level: number;
  score: number;
}
export interface TeamGroup extends SkillRequirement {
  skillName: string;
  members: TeamMember[];
  averageScore: number;
}
export interface TeamSummary {
  headcount: number;
  averageScore: number;
  groups: TeamGroup[];
}
export interface ScenarioHeader {
  id: number;
  clientName: string;
  baseTitle: string;
  projectTitle: string;
  projectBrief: string;
  requiredPeople: number;
  onlyAvailable: boolean;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  selectedPeople: number;
  averageCompatibility: number | null;
}
export interface SavedScenario extends ScenarioHeader {
  requirements: (SkillRequirement & { skillName: string; isActive: boolean })[];
  assignments: {
    employeeId: number;
    skillId: number;
    firstName: string;
    lastName: string;
    department: string;
    jobTitle: string;
    proficiencyAtSelection: number;
    compatibility: number;
    selectedAt: string;
  }[];
}
export interface PlanningState {
  draftStorageError: string | null;
  draft: ScenarioDraft;
  step: number;
  selections: Selections;
  status: RequestStatus;
  requestId: string | null;
  error: string | null;
  errorCode: string | null;
  notice: string | null;
  saved: PageResult<ScenarioHeader>;
  libraryQuery: string;
  libraryStatus: "active" | "ARCHIVED";
  restoredSelectionIds: Record<number, number[]> | null;
  savedStatus: RequestStatus;
  libraryError: string | null;
  libraryRequestId: string | null;
  saveStatus: RequestStatus;
  activeScenario: SavedScenario | null;
  editingScenarioId: number | null;
  expectedVersion: number | null;
}
export interface AppState {
  employees: EmployeesState;
  catalog: CatalogState;
  planning: PlanningState;
}
export type ToastHandler = (message: string) => void;
export type Page = "skills" | "scenarios";
export type CatalogEditorState =
  | { mode: "skill"; item?: Skill; folderId?: number }
  | { mode: "folder"; item?: Folder; folderId?: never };
export type CatalogDeleteState =
  { mode: "skill"; item: Skill } | { mode: "folder"; item: Folder };
