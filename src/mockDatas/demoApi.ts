import type { AxiosInstance, AxiosRequestConfig } from "axios";
import MockAdapter from "axios-mock-adapter";
import type {
  Catalog,
  Criterion,
  Employee,
  EmployeeInput,
  FolderInput,
  SkillInput,
  StorageLike,
  WorkspaceSnapshot,
} from "../types";
import {
  demoExpansion,
  initialEmployees,
  initialFolders,
  initialSkillCatalog,
} from "./data";
import { installScenarioEndpoints } from "./scenarioDemoApi";
import { normalizeEmployee } from "../skillsToEmp/employeeProfile";

const sameName = (a: string, b: string) =>
  a.toLocaleLowerCase("en") === b.toLocaleLowerCase("en");
const validName = (name: unknown) =>
  typeof name === "string" &&
  name.trim().length > 0 &&
  name.trim().length <= 60 &&
  !["__proto__", "constructor", "prototype"].includes(name.trim());
const copy = <T>(value: T): T => structuredClone(value);

export function installDemoApi(
  api: AxiosInstance,
  {
    storage = globalThis.localStorage,
    delay = 350,
  }: { storage?: StorageLike; delay?: number } = {},
) {
  const mock = new MockAdapter(api, { delayResponse: delay });
  const read = <T>(key: string): T | null => {
    try {
      return JSON.parse(storage?.getItem(key) || "null");
    } catch {
      return null;
    }
  };
  const legacyEmployees = read<Employee[]>("skillora-employees");
  const saved = read<WorkspaceSnapshot>("skillora-workspace-v2");
  let employees: Employee[] =
    saved?.employees || legacyEmployees || copy(initialEmployees);
  if (
    !Array.isArray(employees) ||
    !employees.every(
      (e) => e.id && e.name && e.skills && typeof e.skills === "object",
    )
  )
    employees = copy(initialEmployees);
  let catalog: Catalog = saved?.catalog || {
    folders: copy(initialFolders),
    skills: copy(initialSkillCatalog),
  };
  if (!Array.isArray(catalog?.folders) || !Array.isArray(catalog?.skills))
    catalog = {
      folders: copy(initialFolders),
      skills: copy(initialSkillCatalog),
    };
  if (!catalog.folders.some((f) => f.id === "unsorted"))
    catalog.folders.push(
      copy(initialFolders.find((f) => f.id === "unsorted")!),
    );
  // Preserve existing browser profiles when upgrading the prototype.
  for (const employee of employees) {
    for (const name of Object.keys(employee.skills)) {
      if (!catalog.skills.some((s) => s.name === name))
        catalog.skills.push({
          id: crypto.randomUUID(),
          name,
          folderId: "unsorted",
        });
    }
  }
  // Add this expansion once, preserving renamed/moved/deleted existing records.
  // A saved revision prevents deleted expansion items from returning on reload.
  if ((saved?.seedRevision || 0) < demoExpansion.revision) {
    const folderIds = new Map<string, string>();
    for (const folder of demoExpansion.folders) {
      const existing = catalog.folders.find(
        (f) => f.id === folder.id || sameName(f.name, folder.name),
      );
      if (!existing) catalog.folders.push(copy(folder));
      folderIds.set(folder.id, existing?.id || folder.id);
    }
    for (const skill of demoExpansion.skills) {
      if (
        catalog.skills.some(
          (s) => s.id === skill.id || sameName(s.name, skill.name),
        )
      )
        continue;
      const folderId = folderIds.get(skill.folderId) || skill.folderId;
      catalog.skills.push({
        ...copy(skill),
        folderId: catalog.folders.some((f) => f.id === folderId)
          ? folderId
          : "unsorted",
      });
    }
    for (const employee of demoExpansion.employees) {
      if (employees.some((e) => e.id === employee.id)) continue;
      // Respect skills the administrator already deleted from the old catalog.
      const skills = Object.fromEntries(
        Object.entries(employee.skills).flatMap(([name, level]) => {
          const match = catalog.skills.find((s) => sameName(s.name, name));
          return match ? [[match.name, level]] : [];
        }),
      );
      employees.push({ ...copy(employee), skills });
    }
  }
  // Apply explicit seed values once to existing fictional demo profiles only.
  // Later administrator choices (including Not specified) must survive reloads.
  if ((saved?.employeeGenderRevision ?? 0) < 1) {
    employees = employees.map((employee) => {
      const seed = initialEmployees.find(
        (record) => record.id === employee.id && record.name === employee.name,
      );
      return seed && (!employee.gender || employee.gender === "Not specified")
        ? { ...employee, gender: seed.gender }
        : employee;
    });
  }
  employees = employees.map(normalizeEmployee);
  for (const skill of catalog.skills)
    if (!catalog.folders.some((f) => f.id === skill.folderId))
      skill.folderId = "unsorted";
  const snapshot = (
    metadata: Partial<WorkspaceSnapshot> = {},
  ): WorkspaceSnapshot => ({
    catalog: copy(catalog),
    employees: copy(employees),
    seedRevision: demoExpansion.revision,
    employeeGenderRevision: 1,
    ...metadata,
  });
  const persist = () => {
    try {
      storage?.setItem("skillora-workspace-v2", JSON.stringify(snapshot()));
    } catch {
      /* Keep the session usable when browser storage is unavailable. */
    }
  };
  persist();
  const invalid = (message: string): [number, { message: string }] => [
    400,
    { message },
  ];
  const notFound = (): [number, { message: string }] => [
    404,
    {
      message:
        "This item no longer exists. Refresh the workspace and try again.",
    },
  ];
  const body = <T>(config: AxiosRequestConfig): T =>
    JSON.parse(config.data || "{}");
  const idFrom = (config: AxiosRequestConfig) =>
    decodeURIComponent((config.url || "").split("/").at(-1) || "");
  const validateEmployee = (employee: EmployeeInput) =>
    Object.keys(employee.skills).every((name) =>
      catalog.skills.some((s) => s.name === name),
    );

  mock.onGet("/employees").reply(() => [200, copy(employees)]);
  mock.onGet("/skill-catalog").reply(() => [200, copy(catalog)]);
  mock.onPost("/employees").reply((config) => {
    const employee = normalizeEmployee({
      ...body<EmployeeInput>(config),
      id: Date.now(),
    });
    if (!validateEmployee(employee))
      return invalid(
        "A selected skill was removed from the catalog. Reopen this profile and try again.",
      );
    employees = [...employees, employee];
    persist();
    return [201, copy(employee)];
  });
  mock.onPut(/\/employees\/\d+$/).reply((config) => {
    const employee = normalizeEmployee(body<Employee>(config));
    if (!validateEmployee(employee))
      return invalid(
        "A selected skill was removed from the catalog. Reopen this profile and try again.",
      );
    if (!employees.some((e) => e.id === employee.id)) return notFound();
    employees = employees.map((e) => (e.id === employee.id ? employee : e));
    persist();
    return [200, copy(employee)];
  });
  const saveSkill = (
    config: AxiosRequestConfig,
    updating: boolean,
  ): [number, unknown] => {
    const input = body<SkillInput & FolderInput>(config);
    const existing = updating
      ? catalog.skills.find((s) => s.id === idFrom(config))
      : null;
    if (updating && !existing) return notFound();
    if (!validName(input.name))
      return invalid("Enter a skill name between 1 and 60 characters.");
    const name = input.name.trim();
    if (
      catalog.skills.some(
        (s) => s.id !== existing?.id && sameName(s.name, name),
      )
    )
      return invalid("A skill with this name already exists.");
    if (!catalog.folders.some((f) => f.id === input.folderId))
      return invalid("Choose an existing folder.");
    const skill = {
      id: existing?.id || crypto.randomUUID(),
      name,
      folderId: input.folderId,
    };
    catalog.skills = existing
      ? catalog.skills.map((s) => (s.id === skill.id ? skill : s))
      : [...catalog.skills, skill];
    const renamedSkill =
      existing && existing.name !== name
        ? { from: existing.name, to: name }
        : null;
    if (renamedSkill)
      employees = employees.map((e) => {
        if (!Object.hasOwn(e.skills, renamedSkill.from)) return e;
        const skills = { ...e.skills, [name]: e.skills[renamedSkill.from] };
        delete skills[renamedSkill.from];
        return { ...e, skills };
      });
    persist();
    return [updating ? 200 : 201, snapshot({ renamedSkill })];
  };
  mock.onPost("/skills").reply((config) => saveSkill(config, false));
  mock.onPut(/\/skills\/[^/]+$/).reply((config) => saveSkill(config, true));
  mock.onDelete(/\/skills\/[^/]+$/).reply((config) => {
    const skill = catalog.skills.find((s) => s.id === idFrom(config));
    if (!skill) return notFound();
    const affectedEmployees = employees
      .filter((e) => Object.hasOwn(e.skills, skill.name))
      .map(({ id, name }) => ({ id, name }));
    if (
      affectedEmployees.length &&
      body<{ confirmAssignedRemoval?: boolean }>(config)
        .confirmAssignedRemoval !== true
    )
      return [
        409,
        {
          message:
            "This skill is assigned to team members. Review the warning before deleting it.",
          affectedEmployees,
        },
      ];
    catalog.skills = catalog.skills.filter((s) => s.id !== skill.id);
    employees = employees.map((e) => {
      const skills = { ...e.skills };
      delete skills[skill.name];
      return { ...e, skills };
    });
    persist();
    return [200, snapshot({ deletedSkill: skill.name })];
  });
  const saveFolder = (
    config: AxiosRequestConfig,
    updating: boolean,
  ): [number, unknown] => {
    const input = body<FolderInput>(config);
    const existing = updating
      ? catalog.folders.find((f) => f.id === idFrom(config))
      : null;
    if (updating && !existing) return notFound();
    if (existing?.id === "unsorted")
      return invalid("The Unsorted folder is reserved for unorganized skills.");
    if (!validName(input.name))
      return invalid("Enter a folder name between 1 and 60 characters.");
    const name = input.name.trim();
    if (
      catalog.folders.some(
        (f) => f.id !== existing?.id && sameName(f.name, name),
      )
    )
      return invalid("A folder with this name already exists.");
    const folder = {
      id: existing?.id || crypto.randomUUID(),
      name,
      color: existing?.color || "sage",
    };
    catalog.folders = existing
      ? catalog.folders.map((f) => (f.id === folder.id ? folder : f))
      : [...catalog.folders, folder];
    persist();
    return [updating ? 200 : 201, snapshot()];
  };
  mock.onPost("/skill-folders").reply((config) => saveFolder(config, false));
  mock
    .onPut(/\/skill-folders\/[^/]+$/)
    .reply((config) => saveFolder(config, true));
  mock.onDelete(/\/skill-folders\/[^/]+$/).reply((config) => {
    const folder = catalog.folders.find((f) => f.id === idFrom(config));
    if (!folder) return notFound();
    if (folder.id === "unsorted")
      return invalid("The Unsorted folder cannot be deleted.");
    // Deleting a folder preserves its skills and all employee assignments.
    catalog.skills = catalog.skills.map((s) =>
      s.folderId === folder.id ? { ...s, folderId: "unsorted" } : s,
    );
    catalog.folders = catalog.folders.filter((f) => f.id !== folder.id);
    persist();
    return [200, snapshot()];
  });
  mock.onPost("/scenarios/evaluate").reply((config) => {
    const { criteria, onlyAvailable } = body<{
      criteria: Criterion[];
      onlyAvailable: boolean;
    }>(config);
    if (
      !criteria?.length ||
      criteria.some(
        (c) =>
          !catalog.skills.some((s) => s.name === c.skill) ||
          Number(c.weight) < 1 ||
          Number(c.weight) > 5,
      )
    )
      return invalid("Select at least one valid skill and its importance.");
    const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight), 0);
    const results = employees
      .filter((e) => !onlyAvailable || e.available)
      .map((employee) => {
        const contributions = criteria.map((c) => ({
          ...c,
          level: employee.skills[c.skill] || 0,
        }));
        const score = Math.round(
          (contributions.reduce(
            (sum, c) => sum + (c.level / 5) * Number(c.weight),
            0,
          ) /
            totalWeight) *
            100,
        );
        return { employee, score, contributions };
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.employee.name.localeCompare(b.employee.name, "en"),
      );
    return [200, copy(results)];
  });
  installScenarioEndpoints(mock, {
    getEmployees: () => employees,
    getCatalog: () => catalog,
    storage,
  });
  return mock;
}
