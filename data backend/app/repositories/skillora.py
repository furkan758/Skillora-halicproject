from datetime import datetime, timezone
from decimal import Decimal
import json

from ..database import Database
from ..errors import ApiError
from ..schemas import CandidateInput, EmployeeInput, FolderInput, ScenarioInput, SkillInput, page_result


def number(value):
    return float(value) if isinstance(value, Decimal) else value


def timestamp(value: datetime) -> str:
    return value.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def folder(row: dict) -> dict:
    return {"id": row["FolderID"], "name": row["FolderName"],
            "description": row["Description"], "isDefault": bool(row["IsDefault"]),
            "skillCount": row["SkillCount"]}


def skill(row: dict) -> dict:
    return {"id": row["SkillID"], "name": row["SkillName"], "folderId": row["FolderID"],
            "folderName": row["FolderName"], "description": row["Description"],
            "teamMemberCount": row["TeamMemberCount"], "averageProficiency": number(row["AvgProficiency"])}


def employees_from_rows(rows: list[dict]) -> list[dict]:
    people = {}
    for row in rows:
        employee_id = row["ID"]
        if employee_id not in people:
            people[employee_id] = {
                "id": employee_id, "firstName": row["FirstName"], "lastName": row["LastName"],
                "version": row["EmployeeVersion"],
                "name": row["FirstName"] + " " + row["LastName"], "gender": row["Gender"],
                "jobTitle": row["JobTitle"], "departmentId": row["DepartmentID"],
                "department": row["Department"], "isAvailable": bool(row["IsAvailable"]), "skills": [],
            }
        if row["SkillID"] is not None and row["AssignmentIsActive"] and row["SkillIsActive"]:
            people[employee_id]["skills"].append({
                "skillId": row["SkillID"], "skillName": row["Skill"], "folderId": row["FolderID"],
                "proficiencyLevel": row["ProficiencyLevel"], "experienceYears": number(row["Experience"]),
            })
    return list(people.values())


class SkilloraRepository:
    def __init__(self, db: Database):
        self.db = db

    def ready(self):
        rows = self.db.query("""SELECT CASE WHEN OBJECT_ID(N'dbo.EMPLOYEES',N'U') IS NOT NULL
            AND OBJECT_ID(N'dbo.usp_SaveEmployee',N'P') IS NOT NULL
            AND OBJECT_ID(N'dbo.usp_RestoreSkill',N'P') IS NOT NULL
            AND OBJECT_ID(N'dbo.usp_ScenarioLifecycle',N'P') IS NOT NULL
            AND COL_LENGTH(N'dbo.EMPLOYEES',N'Revision') IS NOT NULL
            AND EXISTS(SELECT 1 FROM sys.parameters WHERE object_id=OBJECT_ID(N'dbo.usp_SaveEmployee') AND name=N'@ExpectedVersion')
            AND OBJECT_ID(N'dbo.vw_SCENARIO_TEAM_API',N'V') IS NOT NULL
            THEN 1 ELSE 0 END AS Ready""")
        if not rows or not rows[0]["Ready"]:
            raise ApiError(503, "schema_not_ready", "Install the Skillora SQL package including 09_employee_versions.sql.")
        return {"status": "ok", "database": "connected", "schema": "ready"}

    def departments(self):
        return [{"id": row["DepartmentID"], "name": row["DepartmentName"]}
                for row in self.db.query("SELECT DepartmentID, DepartmentName FROM dbo.DEPARTMENTS ORDER BY DepartmentName, DepartmentID")]

    def overview(self):
        row = self.db.query("""SELECT COUNT(*) AS EmployeeCount,
            COALESCE(SUM(CONVERT(INT,IsAvailable)),0) AS AvailableCount,
            COUNT(DISTINCT DepartmentID) AS DepartmentCount,
            (SELECT COUNT(*) FROM dbo.SKILLS WHERE IsActive=1) AS SkillCount
            FROM dbo.EMPLOYEES WHERE IsActive=1""")[0]
        return {"employeeCount": row["EmployeeCount"], "availableCount": row["AvailableCount"],
                "departmentCount": row["DepartmentCount"], "skillCount": row["SkillCount"]}

    def catalog(self):
        folders = self.db.query("SELECT * FROM dbo.vw_FOLDER_CATALOG WHERE IsActive=1 ORDER BY IsDefault DESC, FolderName, FolderID")
        skills = self.db.query("""SELECT s.* FROM dbo.vw_SKILL_CATALOG s JOIN dbo.vw_FOLDER_CATALOG f
            ON f.FolderID=s.FolderID WHERE s.IsActive=1 AND f.IsActive=1 ORDER BY s.SkillName, s.SkillID""")
        return {"folders": [folder(row) for row in folders], "skills": [skill(row) for row in skills]}

    def list_folders(self, page: int, query: str):
        where = "WHERE IsActive=1 AND (?=N'' OR CHARINDEX(?, FolderName)>0)"
        total = self.db.query(f"SELECT COUNT(*) AS Total FROM dbo.vw_FOLDER_CATALOG {where}", (query, query))[0]["Total"]
        rows = self.db.query(f"SELECT * FROM dbo.vw_FOLDER_CATALOG {where} ORDER BY IsDefault DESC, FolderName, FolderID OFFSET ? ROWS FETCH NEXT 15 ROWS ONLY", (query, query, (page-1)*15))
        return page_result([folder(row) for row in rows], total, page, 15)

    def get_folder(self, folder_id: int):
        rows = self.db.query("SELECT * FROM dbo.vw_FOLDER_CATALOG WHERE FolderID=? AND IsActive=1", (folder_id,))
        if not rows:
            raise ApiError(404, "folder_not_found", "Folder not found.")
        return folder(rows[0])

    def save_folder(self, data: FolderInput, folder_id: int | None = None):
        results = self.db.procedure("usp_SaveFolder", (data.name, data.description, folder_id))
        return self.get_folder(results[0][0]["FolderID"])

    def delete_folder(self, folder_id: int):
        self.db.procedure("usp_DeleteFolder", (folder_id,))

    def list_skills(self, page: int, query: str, folder_id: int | None):
        where = "WHERE s.IsActive=1 AND f.IsActive=1 AND (?=N'' OR CHARINDEX(?,s.SkillName)>0)"
        params: tuple = (query, query)
        if folder_id is not None:
            where += " AND s.FolderID=?"
            params += (folder_id,)
        source = "FROM dbo.vw_SKILL_CATALOG s JOIN dbo.vw_FOLDER_CATALOG f ON f.FolderID=s.FolderID "
        total = self.db.query("SELECT COUNT(*) AS Total " + source + where, params)[0]["Total"]
        rows = self.db.query("SELECT s.* " + source + where + " ORDER BY s.SkillName,s.SkillID OFFSET ? ROWS FETCH NEXT 15 ROWS ONLY", params + ((page-1)*15,))
        return page_result([skill(row) for row in rows], total, page, 15)

    def get_skill(self, skill_id: int):
        rows = self.db.query("""SELECT s.* FROM dbo.vw_SKILL_CATALOG s JOIN dbo.vw_FOLDER_CATALOG f
            ON f.FolderID=s.FolderID WHERE s.SkillID=? AND s.IsActive=1 AND f.IsActive=1""", (skill_id,))
        if not rows:
            raise ApiError(404, "skill_not_found", "Skill not found.")
        return skill(rows[0])

    def save_skill(self, data: SkillInput, skill_id: int | None = None):
        if skill_id is None:
            retired = self.db.query("SELECT SkillID FROM dbo.SKILLS WHERE IsActive=0 AND NameKey=LOWER(LTRIM(RTRIM(?)))", (data.name,))
            if retired:
                raise ApiError(409, "retired_skill", "A deleted skill with this name exists. Restore the original skill to use it again.", retiredSkillId=retired[0]["SkillID"])
        results = self.db.procedure("usp_SaveSkill", (data.name, data.folderId, data.description, skill_id))
        return self.get_skill(results[0][0]["SkillID"])

    def retired_skills(self, page: int, query: str):
        where = "WHERE IsActive=0 AND (?=N'' OR CHARINDEX(?,SkillName)>0)"
        total = self.db.query("SELECT COUNT(*) AS Total FROM dbo.vw_SKILL_CATALOG " + where, (query, query))[0]["Total"]
        rows = self.db.query("SELECT * FROM dbo.vw_SKILL_CATALOG " + where + " ORDER BY SkillName,SkillID OFFSET ? ROWS FETCH NEXT 15 ROWS ONLY", (query, query, (page-1)*15))
        return page_result([skill(row) for row in rows], total, page, 15)

    def restore_skill(self, skill_id: int):
        self.db.procedure("usp_RestoreSkill", (skill_id,))
        return self.get_skill(skill_id)

    def delete_skill(self, skill_id: int, confirm: bool):
        try:
            self.db.procedure("usp_DeleteSkill", (skill_id, confirm))
        except ApiError as error:
            if error.code == "assigned_skill":
                rows = self.db.query("""SELECT DISTINCT ID,FirstName,LastName FROM dbo.vw_EMPLOYEE_SKILLS
                    WHERE SkillID=? AND AssignmentIsActive=1 ORDER BY FirstName,LastName,ID""", (skill_id,))
                error.details["affectedEmployees"] = [{"id": row["ID"], "firstName": row["FirstName"],
                    "lastName": row["LastName"], "name": row["FirstName"]+" "+row["LastName"]} for row in rows]
            raise

    def list_employees(self, page: int, query: str, department_id: int | None, available: bool | None):
        # Filter distinct people first, then return all their active skills.
        where = """WHERE EmployeeIsActive=1 AND (?=N''
            OR CHARINDEX(?,FirstName+N' '+LastName)>0
            OR CHARINDEX(?,JobTitle)>0
            OR (AssignmentIsActive=1 AND SkillIsActive=1 AND CHARINDEX(?,Skill)>0))"""
        params: tuple = (query, query, query, query)
        if department_id is not None:
            where += " AND DepartmentID=?"
            params += (department_id,)
        if available is not None:
            where += " AND IsAvailable=?"
            params += (available,)
        total = self.db.query("SELECT COUNT(DISTINCT ID) AS Total FROM dbo.vw_EMPLOYEE_SKILLS " + where, params)[0]["Total"]
        rows = self.db.query("""WITH People AS (SELECT DISTINCT ID,FirstName,LastName
            FROM dbo.vw_EMPLOYEE_SKILLS """ + where + """), Paged AS (
            SELECT * FROM People ORDER BY FirstName,LastName,ID OFFSET ? ROWS FETCH NEXT 15 ROWS ONLY)
            SELECT v.* FROM dbo.vw_EMPLOYEE_SKILLS v JOIN Paged p ON p.ID=v.ID
            ORDER BY p.FirstName,p.LastName,p.ID,v.Skill""", params + ((page-1)*15,))
        return page_result(employees_from_rows(rows), total, page, 15)

    def get_employee(self, employee_id: int):
        rows = self.db.query("SELECT * FROM dbo.vw_EMPLOYEE_SKILLS WHERE ID=? AND EmployeeIsActive=1 ORDER BY Skill", (employee_id,))
        if not rows:
            raise ApiError(404, "employee_not_found", "Employee not found.")
        return employees_from_rows(rows)[0]

    def save_employee(self, data: EmployeeInput, employee_id: int | None = None):
        if employee_id is not None and data.expectedVersion is None:
            raise ApiError(422, "employee_version_required", "Reload the latest employee before saving this draft.")
        if employee_id is None and data.expectedVersion is not None:
            raise ApiError(422, "unexpected_version", "A new employee must not include expectedVersion.")
        skills_json = json.dumps([item.model_dump(mode="json") for item in data.skills])
        results = self.db.procedure("usp_SaveEmployee", (data.firstName, data.lastName, data.departmentId,
            data.jobTitle, data.gender, data.isAvailable, skills_json, employee_id, data.expectedVersion))
        return self.get_employee(results[0][0]["EmployeeID"])

    def delete_employee(self, employee_id: int):
        self.db.procedure("usp_DeleteEmployee", (employee_id,))

    def candidates(self, data: CandidateInput):
        self.get_skill(data.skillId)
        excluded = json.dumps(data.excludedEmployeeIds)
        result = self.db.procedure("usp_RankedCandidates", (data.skillId, data.onlyAvailable, data.page, excluded))
        ranked = result[0] if result else []
        # Count separately so an out-of-range page still reports the real total.
        total = self.db.query("""SELECT COUNT(DISTINCT ID) AS Total FROM dbo.vw_EMPLOYEE_SKILLS
            WHERE SkillID=? AND EmployeeIsActive=1 AND AssignmentIsActive=1 AND SkillIsActive=1
            AND ProficiencyLevel BETWEEN 1 AND 5 AND (?=0 OR IsAvailable=1)
            AND ID NOT IN(SELECT CONVERT(INT,value) FROM OPENJSON(?))""", (data.skillId, data.onlyAvailable, excluded))[0]["Total"]
        items = [{"employee": self.get_employee(row["EmployeeID"]), "skillId": data.skillId,
                  "proficiencyLevel": row["ProficiencyLevel"], "compatibility": row["Compatibility"]} for row in ranked]
        return page_result(items, total, data.page, 5)

    @staticmethod
    def scenario_header(row: dict):
        return {"id": row["ScenarioID"], "clientName": row["ClientName"],
                "baseTitle": row["BaseTitle"], "projectTitle": row["ProjectTitle"],
                "projectBrief": row["ProjectBrief"], "requiredPeople": row["RequiredPeople"],
                "onlyAvailable": bool(row["OnlyAvailable"]), "status": row["Status"], "version": row["Version"],
                "createdAt": timestamp(row["CreatedAt"]), "updatedAt": timestamp(row["UpdatedAt"]),
                "selectedPeople": row["SelectedPeople"], "averageCompatibility": row["AverageCompatibility"]}

    def list_scenarios(self, page: int, query: str, status: str | None):
        where = "WHERE (?=N'' OR CHARINDEX(?,ProjectTitle+N' '+ClientName)>0)"
        params: tuple = (query, query)
        if status is not None:
            where += " AND Status=?"
            params += (status,)
        else:
            where += " AND Status<>N'ARCHIVED'"
        total = self.db.query("SELECT COUNT(*) AS Total FROM dbo.vw_SCENARIO_SUMMARY " + where, params)[0]["Total"]
        rows = self.db.query("SELECT * FROM dbo.vw_SCENARIO_SUMMARY " + where + " ORDER BY CreatedAt DESC,ScenarioID DESC OFFSET ? ROWS FETCH NEXT 15 ROWS ONLY", params + ((page-1)*15,))
        return page_result([self.scenario_header(row) for row in rows], total, page, 15)

    def get_scenario(self, scenario_id: int):
        rows = self.db.query("SELECT * FROM dbo.vw_SCENARIO_SUMMARY WHERE ScenarioID=?", (scenario_id,))
        if not rows:
            raise ApiError(404, "scenario_not_found", "Scenario not found.")
        result = self.scenario_header(rows[0])
        requirements = self.db.query("SELECT * FROM dbo.vw_SCENARIO_REQUIREMENTS WHERE ScenarioID=? ORDER BY SkillID", (scenario_id,))
        assignments = self.db.query("SELECT * FROM dbo.vw_SCENARIO_TEAM_API WHERE ScenarioID=? ORDER BY SkillID,FirstName,LastName,EmployeeID", (scenario_id,))
        result["requirements"] = [{"skillId": row["SkillID"], "skillName": row["SkillName"],
            "count": row["RequiredCount"], "isActive": bool(row["SkillIsActive"])} for row in requirements]
        result["assignments"] = [{"employeeId": row["EmployeeID"], "skillId": row["SkillID"],
            "firstName": row["FirstName"], "lastName": row["LastName"], "department": row["DepartmentName"],
            "jobTitle": row["JobTitle"], "proficiencyAtSelection": row["ProficiencyAtSelection"],
            "compatibility": row["Compatibility"], "selectedAt": timestamp(row["SelectedAt"])} for row in assignments]
        return result

    def save_scenario(self, data: ScenarioInput, scenario_id: int | None = None):
        if scenario_id is not None and data.expectedVersion is None:
            raise ApiError(422, "version_required", "Send expectedVersion when updating a saved scenario.")
        if scenario_id is None and data.expectedVersion is not None:
            raise ApiError(422, "unexpected_version", "A new scenario must not include expectedVersion.")
        results = self.db.procedure("usp_SaveScenario", (data.clientName, data.projectTitle, data.projectBrief,
            data.requiredPeople, data.onlyAvailable,
            json.dumps([item.model_dump() for item in data.requirements]),
            json.dumps([item.model_dump() for item in data.assignments]), scenario_id, data.expectedVersion))
        return self.get_scenario(results[0][0]["ScenarioID"])

    def scenario_lifecycle(self, scenario_id: int, expected_version: int, operation: str):
        self.db.procedure("usp_ScenarioLifecycle", (scenario_id, expected_version, operation))
        if operation != "delete":
            return self.get_scenario(scenario_id)
