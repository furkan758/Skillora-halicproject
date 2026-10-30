/* Read-only examples for the future FastAPI integration. Bind values as parameters.
   Employees, skills and folders use 15 records per page; candidates use 5.
   Employee pagination operates on people before joining their multiple skill rows. */
DECLARE @Page INT = 1;
DECLARE @Offset INT = (@Page - 1) * 15;
DECLARE @ScenarioID INT = NULL; -- Set an existing ID to inspect a saved scenario.

SELECT e.EmployeeID, e.FirstName, e.LastName, e.JobTitle,
       COALESCE(e.Gender, N'Not specified') AS Gender,
       d.DepartmentName, e.IsAvailable
FROM dbo.EMPLOYEES e
JOIN dbo.DEPARTMENTS d ON d.DepartmentID = e.DepartmentID
WHERE e.IsActive = 1
ORDER BY e.FirstName, e.LastName, e.EmployeeID
OFFSET @Offset ROWS FETCH NEXT 15 ROWS ONLY;

SELECT * FROM dbo.vw_SKILL_CATALOG WHERE IsActive = 1
ORDER BY SkillName, SkillID OFFSET @Offset ROWS FETCH NEXT 15 ROWS ONLY;

SELECT * FROM dbo.vw_FOLDER_CATALOG WHERE IsActive = 1
ORDER BY IsDefault DESC, FolderName, FolderID
OFFSET @Offset ROWS FETCH NEXT 15 ROWS ONLY;

-- Fetch an employee's active skills independently; never count skill rows as people.
DECLARE @EmployeeID INT = NULL;
SELECT es.EmployeeSkillID, s.SkillID, s.SkillName, f.FolderID, f.FolderName,
       es.ExperienceYears, es.ProficiencyLevel
FROM dbo.EMPLOYEE_SKILLS es
JOIN dbo.SKILLS s ON s.SkillID = es.SkillID AND s.IsActive = 1
JOIN dbo.FOLDERS f ON f.FolderID = s.FolderID AND f.IsActive = 1
WHERE es.EmployeeID = @EmployeeID AND es.IsActive = 1
ORDER BY s.SkillName;

-- Reopen all three scenario steps using these three result sets.
SELECT * FROM dbo.vw_SCENARIO_SUMMARY WHERE ScenarioID = @ScenarioID;
SELECT r.SkillID, s.SkillName, r.RequiredCount
FROM dbo.SCENARIO_REQUIREMENTS r
JOIN dbo.SKILLS s ON s.SkillID = r.SkillID
WHERE r.ScenarioID = @ScenarioID ORDER BY s.SkillName;
SELECT * FROM dbo.vw_SCENARIO_TEAM WHERE ScenarioID = @ScenarioID ORDER BY SkillName, EmployeeID;

-- For candidate lists call:
-- EXEC dbo.usp_RankedCandidates @SkillID=21, @OnlyAvailable=1, @Page=1,
--     @ExcludedEmployeeIDsJson=N'[]';
-- Exclusions contain IDs already selected for any skill in the current unsaved form.
