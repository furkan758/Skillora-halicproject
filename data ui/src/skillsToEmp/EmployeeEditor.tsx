import { Check, LoaderCircle, Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useFormDraft } from "../otherComponents/useFormDraft";
import {
  formDraftKey,
  setActiveForm,
  validEmployeeDraft,
} from "../otherComponents/draftStorage";
import Dialog from "../otherComponents/Dialog";
import ConfirmAction from "../otherComponents/ConfirmAction";
import { api } from "../api";
import { apiError } from "../otherComponents/errors";
import { useAppDispatch, useAppSelector } from "../reduxToolKit/hooks";
import { saveEmployee } from "../reduxToolKit/store";
import CatalogSkillOptions from "../skills/CatalogSkillOptions";
import type { Employee, EmployeeInput, ToastHandler } from "../types";
import { employeeInput, genderOptions } from "./employeeProfile";

export default function EmployeeEditor({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee | null;
  onClose: () => void;
  onSaved: ToastHandler;
}) {
  const dispatch = useAppDispatch();
  const { folders, skills, departments, status } = useAppSelector(
    (s) => s.catalog,
  );
  const draft = useFormDraft<EmployeeInput>(
    formDraftKey("employee", employee?.id),
    employee
      ? employeeInput(employee)
      : {
          firstName: "",
          lastName: "",
          gender: "Not specified",
          jobTitle: "",
          departmentId: departments[0]?.id || 0,
          isAvailable: true,
          skills: [],
        },
    validEmployeeDraft,
  );
  const { form, setForm } = draft;
  useEffect(() => {
    setActiveForm("employee", { kind: "employee", id: employee?.id ?? null });
  }, [employee?.id]);
  const [selectedSkill, setSelectedSkill] = useState(skills[0]?.id || 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const needsReload = !!employee && (conflict || !form.expectedVersion);
  const field = <K extends keyof EmployeeInput>(
    key: K,
    value: EmployeeInput[K],
  ) => setForm((s) => ({ ...s, [key]: value }));
  const updateSkill = (
    skillId: number,
    field: "proficiencyLevel" | "experienceYears",
    value: number | null,
  ) =>
    setForm((s) => ({
      ...s,
      skills: s.skills.map((skill) =>
        skill.skillId === skillId ? { ...skill, [field]: value } : skill,
      ),
    }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await dispatch(saveEmployee(form)).unwrap();
      onSaved(
        employee
          ? "Team member updated in the database."
          : "Team member added to the database.",
      );
      draft.clear();
      onClose();
    } catch (error) {
      const failure = apiError(error);
      setError(failure.message);
      if (
        failure.code === "stale_employee" ||
        failure.code === "employee_version_required"
      )
        setConflict(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={employee ? "Edit team member" : "Add a team member"}
      subtitle="Record skills, assessments and experience for each person."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit} className="editor-form">
        <p className="draft-note" role="status">
          {draft.restored ? "Unsaved employee draft restored. " : ""}Changes are
          kept in this tab until you save or discard them.
        </p>
        {draft.storageError && (
          <p className="error" role="alert">
            {draft.storageError}
          </p>
        )}
        <fieldset disabled={busy} className="editor-fields">
          <div className="form-grid">
            <label>
              First name
              <input
                required
                maxLength={100}
                value={form.firstName}
                onChange={(e) => field("firstName", e.target.value)}
                autoFocus
              />
            </label>
            <label>
              Last name
              <input
                required
                maxLength={100}
                value={form.lastName}
                onChange={(e) => field("lastName", e.target.value)}
              />
            </label>
            <label>
              Gender
              <select
                value={form.gender}
                onChange={(e) =>
                  field("gender", e.target.value as Employee["gender"])
                }
              >
                {genderOptions.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <label>
              Job title
              <input
                required
                maxLength={100}
                value={form.jobTitle}
                onChange={(e) => field("jobTitle", e.target.value)}
                placeholder="e.g. Frontend Developer"
              />
            </label>
            <label>
              Department
              <select
                required
                value={form.departmentId}
                onChange={(e) => field("departmentId", Number(e.target.value))}
              >
                <option value={0} disabled>
                  Select a department
                </option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Availability
              <select
                value={String(form.isAvailable)}
                onChange={(e) =>
                  field("isAvailable", e.target.value === "true")
                }
              >
                <option value="true">Available for projects</option>
                <option value="false">Currently on a project</option>
              </select>
            </label>
          </div>
          <div className="field-title">
            Skills & experience <span>1 · Beginner — 5 · Expert</span>
          </div>
          <p className="field-help">
            Experience belongs to each skill. Leave an assessment blank when it
            is not known.
          </p>
          <div className="edit-skills">
            {form.skills.map((s) => {
              const name =
                skills.find((skill) => skill.id === s.skillId)?.name ||
                "Retired skill";
              return (
                <div
                  className="edit-skill employee-skill-editor"
                  key={s.skillId}
                >
                  <strong>{name}</strong>
                  <label>
                    Proficiency
                    <select
                      aria-label={name + " proficiency"}
                      value={s.proficiencyLevel ?? ""}
                      onChange={(e) =>
                        updateSkill(
                          s.skillId,
                          "proficiencyLevel",
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    >
                      <option value="">Not assessed</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n} / 5
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Experience (years)
                    <input
                      aria-label={name + " experience"}
                      type="number"
                      min={0}
                      max={999.9}
                      step={0.1}
                      value={s.experienceYears ?? ""}
                      placeholder="Unknown"
                      onChange={(e) =>
                        updateSkill(
                          s.skillId,
                          "experienceYears",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={"Remove " + name}
                    onClick={() =>
                      field(
                        "skills",
                        form.skills.filter(
                          (skill) => skill.skillId !== s.skillId,
                        ),
                      )
                    }
                  >
                    <X size={15} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="add-skill-row">
            <select
              aria-label="Skill to add"
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(Number(e.target.value))}
            >
              <option value={0}>Select a skill</option>
              <CatalogSkillOptions folders={folders} skills={skills} />
            </select>
            <button
              type="button"
              className="button secondary"
              disabled={
                !selectedSkill ||
                form.skills.some((s) => s.skillId === selectedSkill)
              }
              onClick={() =>
                field("skills", [
                  ...form.skills,
                  {
                    skillId: selectedSkill,
                    proficiencyLevel: null,
                    experienceYears: null,
                  },
                ])
              }
            >
              <Plus size={16} /> Add skill
            </button>
          </div>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {needsReload && (
          <div className="catalog-hint" role="alert">
            <div>
              <p>
                Your draft is kept. Load the latest employee profile before
                saving. Reloading replaces your unsaved draft.
              </p>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setConfirmReload(true)}
              >
                Reload latest employee
              </button>
            </div>
          </div>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => {
              draft.clear();
              onClose();
            }}
          >
            Discard draft
          </button>
          <button
            disabled={busy || needsReload || !form.departmentId || status === "failed"}
            className="button primary"
          >
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Check size={16} />
            )}{" "}
            {employee ? "Save changes" : "Add member"}
          </button>
        </div>
      </form>
      {confirmReload && employee && (
        <ConfirmAction
          title="Replace draft with latest employee?"
          label="Replace draft with latest"
          onClose={() => setConfirmReload(false)}
          onConfirm={async () => {
            const { data } = await api.get<Employee>(`/employees/${employee.id}`);
            setForm(employeeInput(data));
            setConflict(false);
            setError("");
          }}
        >
          <p>
            This replaces your unsaved edits with the latest profile and skill
            assessments from SQL Server. Cancel to keep your draft.
          </p>
        </ConfirmAction>
      )}
    </Dialog>
  );
}
