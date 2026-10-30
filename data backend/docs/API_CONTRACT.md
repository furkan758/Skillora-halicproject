# Skillora API contract

Base URL: `http://127.0.0.1:8000/api`. Interactive request and response models are
available at `/docs` and `/openapi.json`.

## Identifiers and pagination

All employee, department, folder, skill and scenario IDs are SQL integers. Folder
names, skill names and browser-generated UUIDs are not identifiers in requests.

List responses contain `items`, `total`, `page`, `pageSize` and `totalPages`.
`page` starts at 1. An empty collection has zero total pages. Requesting a page
beyond the end returns empty `items` while retaining the actual `total`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/overview` | Workspace counts across all active records |
| GET | `/departments` | Department choices as `{ id, name }[]` |
| GET | `/catalog` | Complete `{ folders, skills }` for selection controls |
| GET | `/folders?page=1&q=` | Folder page, 15 records |
| GET | `/folders/{id}` | One active folder |
| POST / PUT | `/folders` / `/folders/{id}` | Create or update folder |
| DELETE | `/folders/{id}` | Move contained skills to Unsorted, then remove folder |
| GET | `/skills?page=1&q=&folderId=1` | Skill page, 15 records |
| GET | `/retired-skills?page=1&q=` | Deleted skills, 15 records per page |
| POST | `/skills/{id}/restore` | Restore the skill ID without former employee assignments |
| GET | `/skills/{id}` | One active skill with coverage |
| POST / PUT | `/skills` / `/skills/{id}` | Create, rename or move skill |
| DELETE | `/skills/{id}` | Retire skill; require confirmation if assigned |
| GET | `/employees?page=1&q=&departmentId=1&available=true` | Employee page, 15 people, each including all active skill links |
| GET | `/employees/{id}` | Full active employee profile |
| POST / PUT | `/employees` / `/employees/{id}` | Create or replace profile and active skills together |
| DELETE | `/employees/{id}` | Retire profile, preserving saved team history |
| POST | `/scenarios/candidates` | Five ranked candidates for one skill |
| GET | `/scenarios?page=1&q=&status=SAVED` | Scenario library page; status is optional |
| GET | `/scenarios/{id}` | Header, requirements, selections and version |
| POST / PUT | `/scenarios` / `/scenarios/{id}` | Save a complete team or update it with the current version |

Successful creates return 201; updates and reads return 200; successful deletes
return 204 with no body. Mutations return the affected record. Refetch affected
lists and catalog statistics through Redux after a mutation.

## Example requests

Folder:

```json
{"name":"Frontend","description":"Browser application skills"}
```

Skill (replace IDs with records from `/catalog`):

```json
{"name":"React","folderId":1,"description":null}
```

Employee:

```json
{
  "firstName":"Alex",
  "lastName":"Taylor",
  "departmentId":1,
  "jobTitle":"Frontend Developer",
  "gender":"Not specified",
  "isAvailable":true,
  "skills":[{"skillId":21,"proficiencyLevel":4,"experienceYears":2.5}]
}
```

`skills` is the complete active assignment list. Omitting an existing assignment
from PUT retires that link; omitting the entire list means an empty list. A missing
assessment is `null`, not zero. Experience is skill-specific; the database does not
store a separate overall employee experience or project count. SQL has no avatar
color column; initials and display colors belong in frontend presentation code.

Employee GET responses include an opaque hexadecimal `version`, for example
`"0x000000000000001A"`. PUT must include this exact token as `expectedVersion`.
POST must omit it. Never infer a new token from another request or replace the
original token when restoring an unsaved draft. Profile updates and changes to
employee-skill links both invalidate earlier versions. An outdated update returns
409 `stale_employee` without changing any fields or assignments. A missing PUT
token returns 422 `employee_version_required`. The editor keeps the draft and
asks for confirmation before replacing it with the latest employee profile.

Install `09_employee_versions.sql` after the earlier SQL scripts. It adds a
ROWVERSION column and skill-link trigger and replaces the employee read view
and save procedure without resetting existing data. The migration is repeatable.

Candidate page:

```json
{"skillId":21,"onlyAvailable":true,"excludedEmployeeIds":[5,9],"page":1}
```

Response items contain `employee`, `skillId`, `proficiencyLevel` and `compatibility`.
Request each requirement's candidate page separately. Send already chosen IDs
across the other groups in `excludedEmployeeIds`. SQL orders the full eligible set
by proficiency descending, then first name, last name and ID before paging.

Complete scenario:

```json
{
  "clientName":"Example client",
  "projectTitle":"Website",
  "projectBrief":"A company website",
  "requiredPeople":2,
  "onlyAvailable":true,
  "requirements":[{"skillId":21,"count":2}],
  "assignments":[{"employeeId":1,"skillId":21},{"employeeId":2,"skillId":21}]
}
```

The IDs are illustrative, not promised seed employees. The base catalog seed creates no demo employees. The separate
`python -m scripts.seed_presentation` command adds fictional demonstration profiles. Requirements must be unique and sum to
headcount. Each employee can occur only once. SQL rechecks all selections at save.

On GET, `projectTitle` is the allocated display title, such as `Website (2)`, and
`baseTitle` is the user's original title, such as `Website`. Populate the edit
form with `baseTitle`; send that value as `projectTitle` on PUT. Also send
`expectedVersion` using the saved `version`. Do not send the entire GET object as
the write body: IDs, calculated scores, timestamps and status are read-only.
An unchanged title preserves its suffix; updates preserve ID and creation time.

Scenario response includes `requirements`, `assignments`, `selectedPeople` and
`averageCompatibility`. Assignment rows contain the saved raw proficiency and its
percentage. A later profile change or retirement does not rewrite that saved score.

## Errors and confirmation

Errors have `code`, `message`, and optional `details` or `affectedEmployees`.
Validation errors return 422; missing records 404; duplicates, protected records,
ineligible selections and stale scenario versions 409; unavailable SQL 503.

Assigned skill deletion initially returns 409 with the affected employees.
After the user confirms, repeat DELETE with:

```json
{"confirmAssignedRemoval":true}
```

Refetch the employee/catalog data after success. Old scenarios remain readable;
retired requirements are marked `isActive:false` and need review before resaving.

## Implemented React integration

1. Change folder, skill and scenario types to integer IDs.
2. Replace `Record<skillName, level>` write payloads with the explicit skill array.
3. Fetch departments instead of importing hard-coded mock choices.
4. Use `items` and server totals for list pages; retain 15/5 page sizes.
5. Use the new paths `/catalog` and `/folders` instead of mock-specific paths.
6. Keep original base titles and scenario versions in edit state.
7. Refetch dependent Redux data after mutations; handle assigned skill and stale
   version conflicts separately.
8. Use `VITE_API_URL=http://127.0.0.1:8000/api`. The browser mock adapter and
   local storage persistence have been removed. Old browser data is not imported.

Axios and Redux Toolkit remain the request/state tools; interface labels and the
current layout can be preserved.

## Lifecycle and draft behavior

Scenario `POST /scenarios/{id}/archive`, `POST /scenarios/{id}/restore` and
`DELETE /scenarios/{id}` require `{ "expectedVersion": n }`. The first two return
the full scenario with an incremented version. DELETE returns 204 and is allowed
only for archived scenarios or legacy drafts. Default scenario lists exclude
archives; `status=ARCHIVED` selects them. The UI confirms removal before sending it.

`POST /skills/{id}/restore` restores only the skill, with the original ID. Creating
a retired name returns 409 `retired_skill` with `retiredSkillId`. Historical teams
are retained; old employee assignments are not silently reactivated.

The browser stores only unfinished form drafts. Scenario candidate references
are stored as IDs; current employee data is fetched again before team selection.
The saved version from a restored edit remains unchanged, so concurrent updates
still produce a conflict. Browser storage failure shows a warning.

Vite proxies same-origin `/api` to `VITE_BACKEND_TARGET`, including on fallback
ports. No broader backend CORS permission is needed for this local proxy.

## Employee search semantics

`GET /employees?q=` matches name, job title and currently active skill names.
Inactive employees and retired skill links do not match. Department and
availability filters combine with search. Counts and pagination use distinct
employees, and the returned profile contains all active skills.

Unsaved browser drafts are scoped to each tab session. They survive refresh;
closing a tab ends that draft session. Previous shared browser drafts migrate
without overwriting an existing tab draft. Save completed records to SQL.
