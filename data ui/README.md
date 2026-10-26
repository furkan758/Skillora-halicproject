# Data Project — Skillora

A design-focused React frontend for managing team skills and matching people to client projects. The interface is entirely in English. There is no backend.

## Run locally

Requires Node.js 20.19+ or 22.12+.

Double-click `start.cmd` on Windows, or run:

```sh
npm install
npm run dev
```

Open the local URL printed in the terminal. To create a production build, run `npm run build`. To preview that build, run `npm run preview`.

## Included

- Expanded demo content: **30 team members, 115 skills, 16 folders (including Unsorted), and 9 departments**, covering frontend, backend, mobile, design, data, AI, cloud, DevOps, QA, security, business, marketing, and customer success. Previously saved workspaces receive the additional seed data once without overwriting existing profile edits, skill placements, or deleted original skills.
- **Skills:** searchable team directory; department and availability filters; list-only employee tables with ID, first name, last name, department, skills, availability, experience, gender, and edit actions; skill coverage overview; add/edit member profiles and proficiency levels; JSON export. The profile editor supports separate first/last names and optional gender. Older profiles are migrated without changing their existing skills or availability; unspecified gender stays "Not specified". No hire date is collected.
- **Skills overview:** an independent, editable skill catalog organized into folders. Create, rename, move, or delete skills; create, rename, or remove folders. JavaScript starts in Frontend and Next.js in Backend; all skill placements are editable.
- Employees and skills use list/table layouts with **15 records per page**. In Skills overview, select **All skills** or a folder from the left sidebar; the sidebar also shows 15 folders per page with its own search and numbered pagination. Manage the selected folder using the rename/delete actions above the skill table. On smaller screens, the folder browser collapses above the list. Search/filter/sort changes reset the corresponding collection to page 1; deletion clamps the page so it never becomes empty unnecessarily. Employee export includes all filtered employees, regardless of the currently visible page.
- Deleting an assigned skill shows the affected employees and requires explicit confirmation. Confirming removes that skill from profiles and the current scenario criteria. Deleting a folder moves its skills to Unsorted and preserves employee assignments.
- **Scenarios:** three-step team planning. (1) Set the client, project title, and requested headcount, then allocate that many people across unique skills. (2) Select candidates for each skill from lists sorted by skill proficiency, **5 people per page**; a person can fill only one place per scenario. (3) Review the complete team's average compatibility and save it. The saved library uses project titles; duplicate titles receive `(2)`, `(3)`, etc. Reopen saved scenarios, return to earlier steps, and explicitly save changes to the same record or use the brief for a new scenario. Skill/catalog edits invalidate unsaved choices while preserving saved snapshots until an explicit update.
- Responsive desktop, tablet, and mobile layouts, keyboard-accessible dialogs, loading and error states.
- Demo team and catalog changes persist together in this browser using localStorage. Existing demo profiles are migrated automatically. Scenario results are recalculated when requested; editing a profile or catalog invalidates previous scores.

## Frontend architecture

- React + TypeScript + Vite, with strict type checking
- Redux Toolkit (`configureStore`, `createSlice`, `createAsyncThunk`) and React Redux
- Axios for all employee and evaluation requests
- Axios Mock Adapter for browser-local demo responses (not a server)
- Lucide icons and SCSS compiled by Dart Sass

The folders follow the project's existing organization:

| Location | Responsibility |
| --- | --- |
| `src/App.tsx`, `src/main.tsx` | App composition, navigation, and React entry point |
| `src/Scenario/` | Brief, candidate selection, team summary, saved library, step navigation, and scoring rules |
| `src/skills/` | Skills page, catalog, folder sidebar, skill list, and catalog dialogs |
| `src/skillsToEmp/` | Employee directory, profile editor, employee list, and assigned skill tags |
| `src/otherComponents/` | Shared layout, dialogs, pagination, feedback, and small utilities |
| `src/reduxToolKit/` | Store, typed hooks, request thunks, and separate employee/catalog/scenario slices |
| `src/mockDatas/` | Demo employees, folders, skills, templates, mock endpoints, and browser persistence |
| `src/scss/` | SCSS stylesheets, shared theme tokens, and generated progress rules |
| `src/types.ts` | Shared employee, catalog, scenario, API, and Redux state contracts |
| `src/api.ts` | Axios client and mock API initialization |

Each UI component has a TSX file; non-UI logic uses TypeScript. Components use `useAppDispatch` and `useAppSelector` for typed Redux access. Domain rules and persistence stay outside presentation components. Existing browser storage keys are unchanged.

Run `npm run typecheck` for strict TypeScript checks, `npm test` for the existing 35 behavior and Redux integration checks, and `npm run build` for both type checking and the production bundle. `npm run format` formats application source, tests, and configuration.

## Connect a real API later

Copy `.env.example` to `.env` and set:

```env
VITE_API_URL=https://your-api.example.com/api
VITE_USE_MOCKS=false
```

Restart the development server. Expected endpoints:

| Method | Path | Response |
| --- | --- | --- |
| GET | `/employees` | Array of employee objects |
| POST | `/employees` | Created employee object with an ID |
| PUT | `/employees/:id` | Updated employee object |
| POST | `/scenarios/evaluate` | Ranked array of `{ employee, score, contributions }` |
| GET | `/scenarios` | Saved scenario snapshots |
| POST | `/scenarios/candidates` | Skill groups with ranked candidates for each allocation |
| POST | `/scenarios` | Validated saved scenario with a unique title and team summary |
| PUT | `/scenarios/:id` | Updated scenario snapshot, preserving its ID and creation date |
| GET | `/skill-catalog` | `{ folders: [{ id, name, color }], skills: [{ id, name, folderId }] }` |
| POST / PUT | `/skills` / `/skills/:id` | `{ catalog, employees, renamedSkill? }` |
| DELETE | `/skills/:id` | `{ catalog, employees, deletedSkill }`; HTTP 409 with `affectedEmployees` when assigned |
| POST / PUT | `/skill-folders` / `/skill-folders/:id` | `{ catalog, employees }` |
| DELETE | `/skill-folders/:id` | `{ catalog, employees }`; contained skills move to Unsorted |

Skill create/update body: `{ name, folderId }`. Folder create/update body: `{ name }`. Assigned skill deletion requires `{ confirmAssignedRemoval: true }` after showing the warning. Mutations return the complete updated catalog and employee snapshot so Redux updates profiles and selectors together.

Evaluation request: `{ criteria: [{ skill, weight }], onlyAvailable: boolean }`.
Employee shape: `{ id, name, firstName, lastName, gender, role, department, initials, color, available, experience, projects, skills: { React: 5 } }`. The full `name` is kept in sync for search and scenario selection. Gender is optional profile information and does not affect scenario compatibility scores.

Gender is displayed in a small rectangular badge matching the availability labels: blue for Male, red for Female, and white for unspecified or other values. The fictional seed employees include explicit gender values. Existing saved demo profiles receive these values once when their ID and name match a seed profile; custom profiles and subsequent administrator changes are preserved.
Contribution shape: `{ skill, weight, level }`.

The team planner sends a draft `{ client, title, description, headcount, requirements: [{ skill, count }], onlyAvailable }` to `/scenarios/candidates`. Saving sends `{ draft, selections: { React: [employeeId, ...] } }` to `/scenarios`. Allocations must total the requested headcount, selections must fill each allocation exactly, and employee IDs must be unique across the team. A person's assigned-skill score is `proficiency / 5 × 100`. Overall compatibility is the arithmetic mean across all selected people (so two places carry twice the contribution of one place). Saved records persist under `skillora-scenarios-v1` in localStorage. The older `/scenarios/evaluate` mock endpoint remains available for the original weighted individual comparison.

Authentication, team permissions, and shared storage are prototype placeholders. The displayed administrator is a demo profile. No external AI service or client system is connected. Google Fonts are optional; system fonts are used when unavailable.

Saved scenarios support returning to the brief and team selection through the step buttons. Existing allocations and eligible selections are restored. Save changes updates the same record; Cancel editing returns to the saved snapshot. Updates use PUT /scenarios/:id with the same draft and selections body as creation. Unchanged titles retain their numbered suffix.

Styles are authored in `src/scss/` and imported as `.scss` files from components. Vite compiles them to browser-ready CSS during development and production builds. `_tokens.scss` holds shared theme values; `progress.scss` generates percentage selectors with a Sass loop. Components contain no inline styles.
