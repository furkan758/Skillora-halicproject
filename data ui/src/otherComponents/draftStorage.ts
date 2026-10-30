import type { EmployeeInput, ScenarioDraft } from "../types";
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const prefix = "skillora:unsaved:v1:";
interface LegacyDraftStorage extends DraftStorage {
  readonly length: number;
  key(index: number): string | null;
}
// The browser isolates sessionStorage per tab, including duplicated tabs.
// It survives refresh without another tab overwriting the current draft.
export function createTabDraftStorage(
  session: DraftStorage,
  legacy: LegacyDraftStorage | null = null,
): DraftStorage {
  if (legacy) {
    const keys: string[] = [];
    try {
      for (let index = 0; index < legacy.length; index++) {
        const key = legacy.key(index);
        if (key?.startsWith(prefix)) keys.push(key);
      }
    } catch {
      return session;
    }
    for (const key of keys) {
      try {
        const value = legacy.getItem(key);
        if (value === null) continue;
        const existing = session.getItem(key);
        if (existing !== null && existing !== value) continue;
        if (existing === null) session.setItem(key, value);
        // Remove the old shared copy only after the tab has the same value.
        if (session.getItem(key) === value) legacy.removeItem(key);
      } catch {
        /* Keep the old copy when migration cannot complete. */
      }
    }
  }
  return session;
}
export function browserDraftStorage(): DraftStorage | null {
  try {
    if (typeof window === "undefined") return null;
    const session = window.sessionStorage;
    let legacy: Storage | null = null;
    try {
      legacy = window.localStorage;
    } catch {
      /* Tab storage may still work. */
    }
    return createTabDraftStorage(session, legacy);
  } catch {
    return null;
  }
}
export function readDraft<T>(
  key: string,
  validate: (value: unknown) => value is T,
  storage = browserDraftStorage(),
): T | null {
  try {
    const raw = storage?.getItem(prefix + key);
    if (!raw) return null;
    const record = JSON.parse(raw);
    return record.v === 1 && validate(record.value) ? record.value : null;
  } catch {
    return null;
  }
}
export function writeDraft(
  key: string,
  value: unknown,
  storage = browserDraftStorage(),
) {
  try {
    if (!storage) return false;
    storage.setItem(prefix + key, JSON.stringify({ v: 1, value }));
    return true;
  } catch {
    return false;
  }
}
export function removeDraft(key: string, storage = browserDraftStorage()) {
  try {
    storage?.removeItem(prefix + key);
  } catch {
    /* Storage access can be disabled. */
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const id = (v: unknown): v is number =>
  finite(v) && Number.isInteger(v) && v > 0;
export function validEmployeeDraft(v: unknown): v is EmployeeInput {
  return (
    object(v) &&
    (v.expectedVersion === undefined ||
      (typeof v.expectedVersion === "string" && /^0x[0-9a-fA-F]{16}$/.test(v.expectedVersion))) &&
    typeof v.firstName === "string" &&
    typeof v.lastName === "string" &&
    typeof v.jobTitle === "string" &&
    typeof v.gender === "string" &&
    finite(v.departmentId) &&
    typeof v.isAvailable === "boolean" &&
    Array.isArray(v.skills) &&
    v.skills.every(
      (s) =>
        object(s) &&
        id(s.skillId) &&
        (s.proficiencyLevel === null || finite(s.proficiencyLevel)) &&
        (s.experienceYears === null || finite(s.experienceYears)),
    )
  );
}
export interface CatalogFormDraft {
  name: string;
  description: string;
  folderId: number;
}
export function validCatalogDraft(v: unknown): v is CatalogFormDraft {
  return (
    object(v) &&
    typeof v.name === "string" &&
    typeof v.description === "string" &&
    finite(v.folderId)
  );
}
export interface ScenarioDraftSnapshot {
  draft: ScenarioDraft;
  selectionIds: Record<number, number[]>;
  editingScenarioId: number | null;
  expectedVersion: number | null;
}
export function validScenarioDraft(v: unknown): v is ScenarioDraftSnapshot {
  if (!object(v) || !object(v.draft) || !object(v.selectionIds)) return false;
  const d = v.draft;
  return (
    typeof d.clientName === "string" &&
    typeof d.projectTitle === "string" &&
    typeof d.projectBrief === "string" &&
    finite(d.requiredPeople) &&
    typeof d.onlyAvailable === "boolean" &&
    Array.isArray(d.requirements) &&
    d.requirements.every(
      (r) => object(r) && id(r.skillId) && finite(r.count),
    ) &&
    Object.entries(v.selectionIds).every(
      ([key, ids]) => id(Number(key)) && Array.isArray(ids) && ids.every(id),
    ) &&
    ((v.editingScenarioId === null && v.expectedVersion === null) ||
      (id(v.editingScenarioId) && id(v.expectedVersion)))
  );
}
export interface ActiveForm {
  kind: "employee" | "skill" | "folder";
  id: number | null;
  folderId?: number;
}
function validActiveForm(v: unknown): v is ActiveForm {
  return (
    object(v) &&
    ["employee", "skill", "folder"].includes(String(v.kind)) &&
    (v.id === null || id(v.id)) &&
    (v.folderId === undefined || finite(v.folderId))
  );
}
export const getActiveForm = (group: "employee" | "catalog") =>
  readDraft("active-" + group, validActiveForm);
export function setActiveForm(group: "employee" | "catalog", form: ActiveForm) {
  // Keep only one form marked for automatic reopening; other drafts remain saved.
  removeDraft("active-" + (group === "employee" ? "catalog" : "employee"));
  return writeDraft("active-" + group, form);
}
export const closeActiveForm = (group: "employee" | "catalog") =>
  removeDraft("active-" + group);
export const formDraftKey = (kind: string, id?: number | null) =>
  kind + ":" + (id ?? "new");
