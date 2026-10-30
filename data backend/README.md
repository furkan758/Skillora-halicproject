# Skillora backend

Python FastAPI backend for employee skills and scenario planning, using Microsoft
SQL Server and parameterized T-SQL through pyodbc. No ORM or second backend
framework is used. Application messages and API documentation are in English.

This project is a local classroom presentation. User login and role-based HTTP
authentication are intentionally outside the agreed scope. The development
server binds to `127.0.0.1`.

The React frontend uses this API with SQL integer IDs, server pagination and
versioned scenario edits. Axios and Redux Toolkit handle requests and state.
See [the API contract](docs/API_CONTRACT.md). Browser mocks are removed. Only unsaved form drafts persist in each browser tab session; saved records are in SQL.

## Start the backend

The local installation prepared on this computer already has `.venv`, `.env`, and
the dedicated `(localdb)\SkilloraBackend` instance with database `Skillora`.
Windows Authentication is used; no additional SQL password is required.

Double-click `start.cmd`, or open this folder in a terminal and run:

```powershell
.\.venv\Scripts\python.exe -m scripts.run
```

- API documentation: http://127.0.0.1:8000/docs
- Application health: http://127.0.0.1:8000/health
- SQL readiness: http://127.0.0.1:8000/health/ready

The API does not create, migrate or reset databases when it starts. The health
endpoint and documentation remain available if SQL is not configured; data
endpoints return a readable HTTP 503 error.
If the API is already running, the launcher prints its documentation address
instead of trying to start a second server on the same port.

## Setup on another computer

Python 3.12 or newer, SQL Server (LocalDB is sufficient for Windows development)
and a Microsoft SQL Server ODBC driver are needed. This installation was verified
with Python 3.12.14 and ODBC Driver 17. Match `SQL_DRIVER` to the installed driver.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` for the intended server/database. For a new LocalDB installation:

```powershell
SqlLocalDB create SkilloraBackend -s
.\.venv\Scripts\python.exe -m scripts.install_database --create-database --fresh --seed
.\.venv\Scripts\python.exe -m scripts.doctor
```

Use `--fresh` only in an empty database. The original schema script refuses an
existing installation. For an existing database already containing scripts
01 through 04, run only:

```powershell
.\.venv\Scripts\python.exe -m scripts.install_database
```

That command installs the additive `07_api_operations.sql`, `08_lifecycle.sql` and `09_employee_versions.sql`; it does not reset
records. It requires permission to create or alter views and procedures.
The LocalDB example disables TLS negotiation for the local named-pipe connection.
For a network SQL Server, use encryption with an appropriate server certificate.
Keep `.env` and credentials out of Git.

## Application structure

| Folder or file | Purpose |
| --- | --- |
| `app/main.py` | FastAPI app, CORS and safe error responses |
| `app/config.py`, `app/database.py` | Environment settings, request-local SQL connections and required session options |
| `app/schemas.py`, `app/responses.py` | Validated request models and documented response models |
| `app/routers/` | Catalog, employee and scenario HTTP routes |
| `app/repositories/` | Parameterized reads and stored procedure calls |
| `database/` | Existing database package and additive API operations |
| `scripts/` | Explicit database setup, connection diagnosis and server startup |
| `tests/` | Request validation and real SQL Server API tests |

## Available operations

- Departments and a complete catalog for selection controls.
- Folder and skill CRUD, folder moves to Unsorted and protected default folder.
- Assigned-skill removal returns HTTP 409 and `affectedEmployees`; confirmation
  retires records and preserves saved scenario history.
- Employee profiles and skill-specific experience/proficiency saved together;
  removing a profile or assignment preserves historical foreign-key links.
- Employees, skills, folders and the scenario library have 15 items per page.
- Candidate ranking has five people per page, availability filtering and
  exclusion of people already chosen for other requirements.
- Complete scenario saves, calculated compatibility, collision-checked titles,
  reopening all steps and updates using `expectedVersion`.
- Stale updates return HTTP 409; invalid inputs return 422; missing records 404.
- Scores come from SQL; client-provided scores are not accepted.

Database limits are authoritative: names up to 100 characters, client names 150,
base project titles 200, team sizes 1 to 100 and assessed levels 1 to 5.
Experience belongs to each employee-skill pair and may be unknown. The API accepts
up to one decimal place, matching `DECIMAL(4,1)`. Blank/unknown levels are not zero.

## Run tests

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
$env:SKILLORA_TEST_SERVER='(localdb)\SkilloraBackend'
.\.venv\Scripts\python.exe -m pytest -q
```

The SQL integration fixture creates a random `SkilloraApiTest_*` database, installs
the schema and test data there, and removes that exact database afterwards. It
never resets the configured `Skillora` development database. Without
`SKILLORA_TEST_SERVER`, the integration tests are skipped and only standalone
validation tests run. SQL integration was verified with Windows Authentication.

## Restoration, removal and archives

Install the additive `08_lifecycle.sql` using `python -m scripts.install_database`.
It creates procedures without resetting existing records. Deleted skills keep their
IDs and names; restore them through `POST /api/skills/{id}/restore`. Old employee
assignments remain inactive. Attempting to create a retired name returns 409 with
`code: retired_skill` and `retiredSkillId` so the UI can offer restoration.

Scenario archive and restore use `POST /api/scenarios/{id}/archive` and `/restore`.
Both require `{ "expectedVersion": n }` and increment the version. Archiving is
available for complete SAVED teams. Default listing excludes archived records;
use `status=ARCHIVED` to browse them. Archived teams retain their saved scores.
`DELETE /api/scenarios/{id}` requires that same version body and removes only an
ARCHIVED scenario or legacy DRAFT and its owned requirements/selections in one
transaction. A SAVED scenario must first be archived. No employee or skill is deleted.

## Frontend integration and presentation data

The frontend uses `/api/catalog`, `/api/departments`, `/api/overview` and the
paginated list endpoints. It handles assigned-skill confirmation, eligibility
errors and stale scenario versions. Workspace counts cover all active records,
independently of list filters or pages.

Run the additive fictional presentation seed explicitly:

```powershell
.\.venv\Scripts\python.exe -m scripts.seed_presentation
```

It adds 42 fictional people with skill-specific assessments and experience,
extends the skill catalog and saves 16 sample scenarios, including a repeated
title. Repeat runs skip existing names and tagged scenarios without replacing
records. Startup never resets or seeds a database. Existing browser mock data is
not imported. Tests verify the seed twice against a disposable SQL database.

Login and HTTP roles remain outside the local classroom presentation scope.
The separate database-design review of stored `ProjectTitle` versus its derived
base-title/suffix representation is unchanged; it does not block this integration.

## Files

| File | Purpose |
| --- | --- |
| `database/01_schema_ddl.sql` | Fresh installation of eight core tables, keys, constraints and indexes |
| `database/02_data_seed.sql` | Optional original catalog: 15 normal folders, 39 skills, Unsorted and department choices |
| `database/03_views.sql` | Employee directory, live catalog totals, saved team details and average compatibility |
| `database/04_operations.sql` | SQL operations for scenario saves, ranked candidates, folder removal and confirmed skill retirement |
| `database/05_upgrade_legacy.sql` | Transactional upgrade of the exact original three scripts, retaining record IDs and real input data |
| `database/06_query_examples.sql` | Read-only pagination and scenario reopening examples for later integration |
| `database/08_lifecycle.sql` | Additive skill restoration and versioned scenario archive/restore/permanent delete |
| `database/09_employee_versions.sql` | Employee row versions and atomic stale-form protection, including skill-only changes |
| `database/07_api_operations.sql` | Additive profile/catalog writes and read views for the FastAPI application |
| `database/tests/validate.sql` | Integration fixtures and assertions for a disposable test database only |
| `database/tests/permissions.sql` | Disposable-database verification of the future API role |

Use SQL Server 2016 SP1 or later and database compatibility level 130 or higher.
Select the intended database in SSMS before running any installation script.
These scripts do not create or choose a production database for you.

## Fresh installation

Run `01_schema_ddl.sql`, `02_data_seed.sql`, `03_views.sql`,
`04_operations.sql`, `07_api_operations.sql`, `08_lifecycle.sql`, then `09_employee_versions.sql`, in that order. The second file is optional if you will enter
your own catalog; the mandatory Unsorted folder and Unassigned department already
exist after step 1. Do not run the legacy upgrade after a fresh installation.

The optional original catalog seed alone creates no employees or scenarios. The original mock summary numbers
are intentionally removed: React initially has zero assigned people until actual
employee-skill links are entered. No one is assigned an invented proficiency.
The seed retains the original folder IDs 1 to 15 and skill IDs 16 to 54. Unsorted
is the sixteenth folder. Database IDs remain integers for compatibility with the
provided scripts. The frontend reads the same SQL database. Use the explicit presentation seed
for fictional demonstration profiles and projects; no browser-data import occurs.

## Upgrade an existing installation

Back up the database. This path supports only the structure created by the original
`SKILLS_MSSQL.sql`, `EMPLOYEE_SKILLS_MSSQL.sql` and `SCENARIOS_MSSQL.sql` files.
Run `05_upgrade_legacy.sql` instead of `01_schema_ddl.sql`, followed by
`02_data_seed.sql` if you want the catalog additions, `03_views.sql` and
`04_operations.sql`. The originals on the desktop are retained as references;
do not run them again against upgraded tables.

The upgrade preserves employee, folder, skill, employee-skill and scenario IDs,
names, gender, experience, briefs and creation timestamps. It removes the obsolete
mock `SKILLS.TeamMemberCount` and `SKILLS.AvgProficiency` columns. Views replace
those columns with counts and averages calculated from actual active employees.

Legacy employees start in **Unassigned**, with **IsAvailable = 0** pending review.
Legacy proficiency stays **NULL** (unassessed). Experience years are retained and
are never converted into a score. Set department, availability and proficiency
explicitly before using candidate matching. Original scenarios become drafts:
the old tables never contained quotas or team selections to recover. Repeated
titles receive `(2)`, `(3)`, etc. in ScenarioID order; the original base title is
preserved separately. A literal title containing a suffix is also collision-checked.

Unsupported gender values, duplicate normalized folder/skill names and headcounts
outside 1 to 100 abort the upgrade without partial changes. Resolve the reported
data conflict first; the script does not guess which records to merge. A repeated
upgrade is refused. The seed and view/operation scripts can be repeated.

## Data and workflow rules

- `DEPARTMENTS`, `FOLDERS`, `SKILLS`, `EMPLOYEES`, `EMPLOYEE_SKILLS`, `SCENARIOS`,
  `SCENARIO_REQUIREMENTS` and `SCENARIO_ASSIGNMENTS` are the eight core tables.
- Skills have globally unique trimmed names, independent of folder placement.
  Employee-skill pairs are unique. `ExperienceYears` is skill-specific experience;
  `ProficiencyLevel` is a separate 1 to 5 assessment. NULL means unassessed and
  does not count as a zero-level assessment or a candidate.
- Gender is optional: Male, Female, Not specified or Prefer not to say. It never
  affects ranking. Hire date is not collected.
- Active-member counts include active unassessed members; averages exclude their
  missing ratings. Averages are NULL when no assessed member exists.
- Unsorted cannot be renamed, disabled or removed. `usp_DeleteFolder` moves all
  contained skills to Unsorted before removal, preserving employee assignments.
- `usp_DeleteSkill` returns affected employees and error **51030** when an assigned
  skill is removed without confirmation. After review, call it with
  `@ConfirmAssignedRemoval=1`. It retires the skill and its employee links; saved
  scenarios retain the original raw proficiency levels.
- `usp_SaveScenario` validates a headcount of 1 to 100, unique positive skill quotas,
  exact quota totals, eligible active employees, availability and distinct people.
  It saves the entire scenario in one transaction. Updates require both
  `@ScenarioID` and `@ExpectedVersion`; error **51045** indicates a stale edit.
  Unchanged titles retain their suffix and unchanged records retain their ID and
  creation time. The procedure returns the saved scenario summary.
- The two JSON arrays use integer IDs:
  `[{"skillId":21,"count":2},{"skillId":29,"count":1}]` and
  `[{"employeeId":1,"skillId":21},{"employeeId":2,"skillId":21},{"employeeId":3,"skillId":29}]`.
  The API and React use these stable IDs and bind all database values as parameters.
- Candidate ranking is descending proficiency, then first name, last name and ID.
  Each page contains at most five people. Already selected employee IDs can be
  excluded across all skill groups. Employee, folder and skill query examples use
  15 records per page. Paginate employee records before joining their skill rows.
- Compatibility is `ProficiencyAtSelection * 20`. Overall compatibility averages
  people, not skill-group averages: levels 5, 4 and 5 give 93 percent. Scores and
  member counts are calculated by views, not stored as independent totals.

## Transaction boundaries and future API permissions

The supplied SQL write procedures use one transaction-owned application lock,
`Skillora.DatabaseWrite`. It serializes short prototype writes, including duplicate
title allocation. This favors correctness over high write throughput. All future
catalog/profile write paths must follow the same transaction protocol. Direct
administrator SQL edits are outside that protocol and should not be mixed with
live application writes. Retiring catalog records preserves saved history.

The database role `skillora_app` can read the exposed views and execute the supplied
procedures. It cannot directly write scenario headers, requirements or selections.
No server login or API account is created. The additive API script supplies
controlled employee/profile/catalog write procedures and grants their execution
to `skillora_app`. FastAPI maps database errors to readable HTTP responses without
exposing raw SQL text.

Initialize future SQL connections with the SET options required by computed-column
and filtered indexes: ANSI_NULLS, QUOTED_IDENTIFIER, ANSI_PADDING, ANSI_WARNINGS,
ARITHABORT and CONCAT_NULL_YIELDS_NULL ON; NUMERIC_ROUNDABORT OFF. The installation
scripts set them for their own sessions. A new API connection needs its own settings.

## Validation

Fresh installation, repeated seed/object installation and migration from copies
of the three original scripts were executed in a dedicated SQL Server LocalDB
17.0 test instance. Behavioral checks cover real aggregates, five-person paging,
stable ranking, missing assessments, quotas, duplicate people, suffix collisions,
93 percent compatibility, profile changes, saved edits, stale versions, protected
Unsorted, folder moves and confirmed skill retirement. The legacy test retains
actual fixture IDs, experience, briefs and timestamps without inventing assessments.
Two independent SQL connections also verified concurrent title suffix allocation
and a stale-version conflict when both clients try to update version 1.

`tests/validate.sql` inserts fixtures and belongs in an isolated disposable database.
Do not run it against real project data. No changes were made to your existing
databases while validating the package.

Employee directory search includes names, job titles and active skills. Search,
department and availability filters run before distinct-person pagination, while
responses include the full active skill list for each matching employee.
