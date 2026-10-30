# Skillora frontend

React, TypeScript, SCSS, Axios and Redux Toolkit interface for employee skills
and scenario planning. All records are read from and written to the FastAPI
backend backed by Microsoft SQL Server. No browser mock API is used. Only unsaved form drafts are kept in the browser;
the database remains the source of saved records.

## Run locally

Start the backend from the sibling `data backend` folder using `start.cmd`.
Then, in this frontend folder:

```powershell
npm install
npm run dev
```

Open the URL printed by Vite. The default API address is
`/api` through Vite's same-origin proxy. Copy `.env.example` to `.env.local`
and set `VITE_BACKEND_TARGET` if the backend runs at another address. The proxy
works for development and preview, including when Vite chooses a different port.
An explicitly configured cross-origin `VITE_API_URL` requires corresponding CORS settings.

This is a local classroom presentation; no sign-in is required.

## Data and workflows

- Employee, department, folder, skill and scenario IDs are SQL integers.
- Department choices come from the API. Profile fields match the SQL schema.
- Each employee-skill link has its own optional experience and 1–5 proficiency.
  Unknown assessments remain null.
- Employees, folders, skills and saved scenarios use server pagination with
  15 records per page. Candidate lists use five records per page, ranked by SQL
  before pagination.
- Folder selection remains on the left of the skill list.
- Skills display database counts and assessed averages across the entire team.
- Assigned-skill deletion first shows the server's affected employees. Explicit
  confirmation is required; saved scenario history remains available. Deleted skills
  can be restored with the original ID from **Deleted skills**, including a guided
  restore when the same name is entered again. Former employee links stay removed.
- Scenario quotas must equal the requested team size. A person can fill only
  one place. Selections survive candidate page and skill changes.
- Saved scenarios load their full details independently of the library page.
  Earlier steps can be reopened. Edits use the original base title and saved
  version; concurrent changes return a reload warning.
  Employee edits also include the original SQL row version. Profile and skill-list
  changes invalidate older forms; a rejected save keeps the draft. Loading the
  latest employee requires confirmation before replacing unsaved edits.
- The final saved compatibility and duplicate-title suffix come from SQL.
  Unsaved previews use the current employee assessments fetched from the API.
- Team export downloads the current filtered page only. Add team member sits to
  its left. Employee removal requires confirmation and preserves saved team history.
- Saved scenarios can be archived, viewed in **Archived** and restored. Permanent
  deletion is available only for archived scenarios or legacy drafts; it requires
  a confirmation checkbox and the current record version. Employee profiles remain.
- Unsaved employee, skill/folder and scenario forms survive refresh. Scenario
  selections persist as IDs and are rechecked against SQL on resume. Save or
  explicitly discard a draft to clear it. Closing a form keeps its unfinished draft.
- Drafts are isolated per browser tab using sessionStorage. They survive refresh
  and closing a form within that tab; closing the tab ends its draft session.
  Save to SQL before closing a tab. Existing shared drafts are migrated safely
  into tab storage without overwriting a tab's own work.
  If browser storage is unavailable or full, the form shows a warning.
- Catalog responses are guarded by request ID, so older responses cannot replace
  newer workspace data.

## Presentation data

From the backend folder, run:

```powershell
.\.venv\Scripts\python.exe -m scripts.seed_presentation
```

This explicitly adds fictional presentation people, skills and scenarios to
SQL Server without replacing existing records. Repeat runs skip the same names
and tagged scenarios. The frontend does not seed or reset the database at startup.
Old browser mock data is not imported.

## Source layout

| Folder | Purpose |
| --- | --- |
| `src/skillsToEmp/` | Employee list and profile editor |
| `src/skills/` | Folder sidebar and skill catalog management |
| `src/Scenario/` | Brief, five-person candidate pages and saved team review |
| `src/reduxToolKit/` | Server requests, workspace state and versioned edits |
| `src/otherComponents/` | Shared UI, errors and server pagination |
| `src/scss/` | SCSS styles, including responsive profile fields |

## Verification

```powershell
npm test
npm run build
```

Tests cover numeric write contracts, null assessments, server page boundaries,
persistent selections, unique team membership, saved-step restoration and
assigned-skill / stale-version conflicts.

API details and SQL setup are documented in the backend's
`docs/API_CONTRACT.md` and `README.md`.

Do not commit `.env`, `.env.local`, `node_modules`, `dist`, database files
or backend virtual environments.

## Directory search

The directory search matches first/last names, job titles and active skill names.
Department and availability filters apply to the complete matching set before
pagination. A matching employee is counted once even when several skills match,
and every active skill is returned in their profile.

Scenario draft persistence includes team size and the availability filter, even
before a project title, client or required skill has been entered. Changing these
fields also activates the unsaved-changes confirmation when leaving the draft.
