import { Check, LoaderCircle, Plus, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { departmentOptions } from "../mockDatas/data";
import Dialog from "../otherComponents/Dialog";
import { apiError } from "../otherComponents/errors";
import { useAppDispatch, useAppSelector } from "../reduxToolKit/hooks";
import { invalidateResults, saveEmployee } from "../reduxToolKit/store";
import CatalogSkillOptions from "../skills/CatalogSkillOptions";
import type { Employee, EmployeeInput, ToastHandler } from "../types";
import {
  employeeFullName,
  genderOptions,
  normalizeEmployee,
} from "./employeeProfile";

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
  const { folders, skills } = useAppSelector((s) => s.catalog);
  const [form, setForm] = useState<EmployeeInput>(
    employee
      ? normalizeEmployee(employee)
      : {
          name: "",
          firstName: "",
          lastName: "",
          gender: "Not specified",
          role: "",
          department: "Engineering",
          available: true,
          experience: 1,
          projects: 0,
          color: "sage",
          initials: "",
          skills: {},
        },
  );
  const [selectedSkill, setSelectedSkill] = useState(skills[0]?.name || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const field = <K extends keyof EmployeeInput>(
    key: K,
    value: EmployeeInput[K],
  ) => setForm((s) => ({ ...s, [key]: value }));
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.role.trim())
      return;
    const name = employeeFullName(form.firstName, form.lastName);
    setBusy(true);
    setError("");
    try {
      await dispatch(
        saveEmployee({
          ...form,
          name,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          role: form.role.trim(),
          initials: [form.firstName.trim(), form.lastName.trim()]
            .map((n) => n[0].toLocaleUpperCase("en"))
            .join(""),
        }),
      ).unwrap();
      dispatch(invalidateResults());
      onSaved(
        employee
          ? "Team member updated successfully."
          : "New team member added. Welcome aboard!",
      );
      onClose();
    } catch (err) {
      setError(
        apiError(err, "Could not save this member. Please try again.").message,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={employee ? "Edit team member" : "Add a team member"}
      subtitle="Bring your team’s experience and expertise together."
      onClose={onClose}
    >
      <form onSubmit={submit} className="editor-form">
        <div className="form-grid">
          <label>
            First name
            <input
              required
              maxLength={70}
              value={form.firstName}
              onChange={(e) => field("firstName", e.target.value)}
              placeholder="e.g. Alex"
              autoFocus
            />
          </label>
          <label>
            Last name
            <input
              required
              maxLength={70}
              value={form.lastName}
              onChange={(e) => field("lastName", e.target.value)}
              placeholder="e.g. Morgan"
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
              {genderOptions.map((gender) => (
                <option key={gender} value={gender}>
                  {gender}
                </option>
              ))}
            </select>
          </label>
          <label>
            Job title
            <input
              required
              maxLength={80}
              value={form.role}
              onChange={(e) => field("role", e.target.value)}
              placeholder="e.g. Frontend Developer"
            />
          </label>
          <label>
            Department
            <select
              value={form.department}
              onChange={(e) => field("department", e.target.value)}
            >
              {departmentOptions.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            Years of experience
            <input
              type="number"
              min="0"
              max="50"
              value={form.experience}
              onChange={(e) => field("experience", Number(e.target.value))}
            />
          </label>
          <label>
            Completed projects
            <input
              type="number"
              min="0"
              max="1000"
              value={form.projects}
              onChange={(e) => field("projects", Number(e.target.value))}
            />
          </label>
          <label>
            Availability
            <select
              value={String(form.available)}
              onChange={(e) => field("available", e.target.value === "true")}
            >
              <option value="true">Available for projects</option>
              <option value="false">Currently on a project</option>
            </select>
          </label>
        </div>
        <div className="field-title">
          Skills & proficiency <span>1 · Beginner — 5 · Expert</span>
        </div>
        <div className="edit-skills">
          {Object.entries(form.skills).map(([name, level]) => (
            <div className="edit-skill" key={name}>
              <span>{name}</span>
              <select
                aria-label={`${name} proficiency`}
                value={level}
                onChange={(e) =>
                  field("skills", {
                    ...form.skills,
                    [name]: Number(e.target.value),
                  })
                }
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} / 5
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label={`Remove ${name}`}
                className="icon-button"
                onClick={() => {
                  const skills = { ...form.skills };
                  delete skills[name];
                  field("skills", skills);
                }}
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
        <div className="add-skill-row">
          <select
            aria-label="Skill to add"
            value={selectedSkill}
            onChange={(e) => setSelectedSkill(e.target.value)}
          >
            {!skills.length && (
              <option value="">Create a skill in Skills overview first</option>
            )}
            <CatalogSkillOptions folders={folders} skills={skills} />
          </select>
          <button
            type="button"
            className="button secondary"
            disabled={!selectedSkill || !!form.skills[selectedSkill]}
            onClick={() =>
              field("skills", { ...form.skills, [selectedSkill]: 3 })
            }
          >
            <Plus size={16} /> Add skill
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button disabled={busy} className="button primary">
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Check size={16} />
            )}{" "}
            {employee ? "Save changes" : "Add member"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
