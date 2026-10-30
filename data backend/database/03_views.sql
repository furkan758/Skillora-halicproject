SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER VIEW dbo.vw_EMPLOYEE_SKILLS
AS
SELECT e.EmployeeID AS ID, e.FirstName, e.LastName,
       COALESCE(e.Gender, N'Not specified') AS Gender,
       e.JobTitle, e.DepartmentID, d.DepartmentName AS Department,
       e.IsAvailable, e.IsActive AS EmployeeIsActive,
       es.EmployeeSkillID, s.SkillID, s.SkillName AS Skill,
       es.ExperienceYears AS Experience, es.ProficiencyLevel,
       es.IsActive AS AssignmentIsActive, s.IsActive AS SkillIsActive,
       f.FolderID, f.FolderName
FROM dbo.EMPLOYEES e
JOIN dbo.DEPARTMENTS d ON d.DepartmentID = e.DepartmentID
LEFT JOIN dbo.EMPLOYEE_SKILLS es ON es.EmployeeID = e.EmployeeID
LEFT JOIN dbo.SKILLS s ON s.SkillID = es.SkillID
LEFT JOIN dbo.FOLDERS f ON f.FolderID = s.FolderID;
GO
CREATE OR ALTER VIEW dbo.vw_SKILL_CATALOG
AS
SELECT s.SkillID, s.SkillName, s.FolderID, f.FolderName,
       s.Description, s.IsActive, s.CreatedAt,
       COUNT(e.EmployeeID) AS TeamMemberCount,
       CAST(AVG(CASE WHEN e.EmployeeID IS NOT NULL
                     THEN CAST(es.ProficiencyLevel AS DECIMAL(5,2)) END) AS DECIMAL(5,2)) AS AvgProficiency
FROM dbo.SKILLS s
JOIN dbo.FOLDERS f ON f.FolderID = s.FolderID
LEFT JOIN dbo.EMPLOYEE_SKILLS es ON es.SkillID = s.SkillID AND es.IsActive = 1
LEFT JOIN dbo.EMPLOYEES e ON e.EmployeeID = es.EmployeeID AND e.IsActive = 1
GROUP BY s.SkillID, s.SkillName, s.FolderID, f.FolderName,
         s.Description, s.IsActive, s.CreatedAt;
GO
CREATE OR ALTER VIEW dbo.vw_FOLDER_CATALOG
AS
SELECT f.FolderID, f.FolderName, f.Description, f.IsDefault, f.IsActive,
       COUNT(s.SkillID) AS SkillCount
FROM dbo.FOLDERS f
LEFT JOIN dbo.SKILLS s ON s.FolderID = f.FolderID AND s.IsActive = 1
GROUP BY f.FolderID, f.FolderName, f.Description, f.IsDefault, f.IsActive;
GO
CREATE OR ALTER VIEW dbo.vw_SCENARIO_SUMMARY
AS
SELECT s.ScenarioID, s.ClientName, s.BaseTitle, s.ProjectTitle,
       s.ProjectBrief, s.RequiredPeople, s.OnlyAvailable, s.Status,
       s.Version, s.CreatedAt, s.UpdatedAt,
       COUNT(a.EmployeeID) AS SelectedPeople,
       CAST(ROUND(AVG(a.ProficiencyAtSelection * 20.0), 0) AS INT) AS AverageCompatibility
FROM dbo.SCENARIOS s
LEFT JOIN dbo.SCENARIO_ASSIGNMENTS a ON a.ScenarioID = s.ScenarioID
GROUP BY s.ScenarioID, s.ClientName, s.BaseTitle, s.ProjectTitle,
         s.ProjectBrief, s.RequiredPeople, s.OnlyAvailable, s.Status,
         s.Version, s.CreatedAt, s.UpdatedAt;
GO
CREATE OR ALTER VIEW dbo.vw_SCENARIO_TEAM
AS
SELECT a.ScenarioID, a.SkillID, sk.SkillName, r.RequiredCount,
       a.EmployeeID, e.FirstName, e.LastName, d.DepartmentName,
       a.ProficiencyAtSelection, a.ProficiencyAtSelection * 20 AS Compatibility,
       a.SelectedAt
FROM dbo.SCENARIO_ASSIGNMENTS a
JOIN dbo.SCENARIO_REQUIREMENTS r ON r.ScenarioID = a.ScenarioID AND r.SkillID = a.SkillID
JOIN dbo.SKILLS sk ON sk.SkillID = a.SkillID
JOIN dbo.EMPLOYEES e ON e.EmployeeID = a.EmployeeID
JOIN dbo.DEPARTMENTS d ON d.DepartmentID = e.DepartmentID;
GO
