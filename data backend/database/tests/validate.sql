/* Run only in a disposable test database after 01, 02, 03, 04.
   The test inserts fixtures; never run it against real project data. */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO
CREATE OR ALTER PROCEDURE dbo.test_ExpectError @SQL NVARCHAR(MAX), @Number INT
AS
BEGIN
    DECLARE @Caught BIT = 0;
    BEGIN TRY
        EXEC sys.sp_executesql @SQL;
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER() <> @Number THROW;
        SET @Caught = 1;
    END CATCH;
    IF @Caught = 0 THROW 51900, 'Expected error was not raised.', 1;
END;
GO
IF (SELECT COUNT(*) FROM dbo.FOLDERS) <> 16 OR (SELECT COUNT(*) FROM dbo.SKILLS) <> 39
    THROW 51901, 'Original seed IDs or catalog counts changed.', 1;
IF EXISTS (SELECT 1 FROM dbo.vw_SKILL_CATALOG WHERE TeamMemberCount <> 0 OR AvgProficiency IS NOT NULL)
    THROW 51902, 'Invented catalog summaries were seeded.', 1;
PRINT 'PASS catalog contains 16 folders / 39 skills and real empty summaries';

DECLARE @Dept INT = (SELECT DepartmentID FROM dbo.DEPARTMENTS WHERE NameKey = N'engineering');
INSERT dbo.EMPLOYEES (FirstName, LastName, DepartmentID, IsAvailable)
VALUES (N'Alpha',N'Test',@Dept,1), (N'Beta',N'Test',@Dept,1),
       (N'Charlie',N'Test',@Dept,1), (N'Delta',N'Test',@Dept,1),
       (N'Echo',N'Test',@Dept,1), (N'Foxtrot',N'Test',@Dept,0),
       (N'Golf',N'Test',@Dept,1), (N'No skills',N'Test',@Dept,1);
INSERT dbo.EMPLOYEE_SKILLS (EmployeeID, SkillID, ExperienceYears, ProficiencyLevel)
SELECT e.EmployeeID, 21, 2.5, x.Level
FROM (VALUES (N'Alpha',5),(N'Beta',4),(N'Charlie',3),(N'Delta',2),
             (N'Echo',1),(N'Foxtrot',5),(N'Golf',NULL)) x(Name,Level)
JOIN dbo.EMPLOYEES e ON e.FirstName=x.Name;
INSERT dbo.EMPLOYEE_SKILLS (EmployeeID, SkillID, ProficiencyLevel)
SELECT EmployeeID,29,5 FROM dbo.EMPLOYEES WHERE FirstName IN (N'Alpha',N'Charlie');
IF NOT EXISTS (SELECT 1 FROM dbo.vw_EMPLOYEE_SKILLS WHERE FirstName=N'No skills' AND SkillID IS NULL)
    THROW 51903, 'An employee without skills disappeared from the directory.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.vw_SKILL_CATALOG WHERE SkillID=21 AND TeamMemberCount=7 AND AvgProficiency=3.33)
    THROW 51904, 'Catalog aggregates do not reflect real assignments.', 1;
EXEC dbo.test_ExpectError N'INSERT dbo.EMPLOYEE_SKILLS(EmployeeID,SkillID,ProficiencyLevel) VALUES (1,21,5);',2627;
EXEC dbo.test_ExpectError N'UPDATE dbo.EMPLOYEE_SKILLS SET ProficiencyLevel=6 WHERE EmployeeID=1 AND SkillID=21;',547;
EXEC dbo.test_ExpectError N'INSERT dbo.SKILLS(FolderID,SkillName) VALUES (2,N'' react '');',2601;
EXEC dbo.test_ExpectError N'INSERT dbo.EMPLOYEE_SKILLS(EmployeeID,SkillID) VALUES (999999,21);',547;
EXEC dbo.test_ExpectError N'UPDATE dbo.EMPLOYEES SET Gender=N''Non-binary'' WHERE EmployeeID=1;',547;
PRINT 'PASS employee relationships, unique skills, allowed ratings and gender constraints';

CREATE TABLE #Candidates (EmployeeID INT,FirstName NVARCHAR(100),LastName NVARCHAR(100),
    IsAvailable BIT,ProficiencyLevel TINYINT,Compatibility INT,Position BIGINT,TotalCandidates INT);
INSERT #Candidates EXEC dbo.usp_RankedCandidates @SkillID=21,@Page=1;
IF (SELECT COUNT(*) FROM #Candidates)<>5 OR (SELECT MAX(TotalCandidates) FROM #Candidates)<>6
    OR NOT EXISTS (SELECT 1 FROM #Candidates WHERE Position=1 AND FirstName=N'Alpha')
    OR NOT EXISTS (SELECT 1 FROM #Candidates WHERE Position=2 AND FirstName=N'Foxtrot')
    THROW 51905, 'Ranking must precede five-person pagination with stable ties.', 1;
TRUNCATE TABLE #Candidates;
INSERT #Candidates EXEC dbo.usp_RankedCandidates @SkillID=21,@Page=2;
IF (SELECT COUNT(*) FROM #Candidates)<>1 OR NOT EXISTS (SELECT 1 FROM #Candidates WHERE FirstName=N'Echo')
    THROW 51906, 'Second candidate page is incorrect.', 1;
TRUNCATE TABLE #Candidates;
INSERT #Candidates EXEC dbo.usp_RankedCandidates @SkillID=21,@OnlyAvailable=1,@ExcludedEmployeeIDsJson=N'[1]';
IF (SELECT COUNT(*) FROM #Candidates)<>4 OR EXISTS (SELECT 1 FROM #Candidates WHERE FirstName IN (N'Alpha',N'Foxtrot',N'Golf'))
    THROW 51907, 'Availability, unassessed ratings or duplicate-person exclusions failed.', 1;
PRINT 'PASS ranking, two candidate pages, availability and unassessed exclusions';

DECLARE @Requirements NVARCHAR(MAX)=N'[{"skillId":21,"count":2},{"skillId":29,"count":1}]';
DECLARE @Assignments NVARCHAR(MAX)=N'[{"employeeId":1,"skillId":21},{"employeeId":2,"skillId":21},{"employeeId":3,"skillId":29}]';
EXEC dbo.usp_SaveScenario N'Client',N'Website',N'',3,1,@Requirements,@Assignments;
EXEC dbo.usp_SaveScenario N'Client',N'Website',N'',3,1,@Requirements,@Assignments;
EXEC dbo.usp_SaveScenario N'Client',N'Website (2)',N'',3,1,@Requirements,@Assignments;
EXEC dbo.usp_SaveScenario N'Client',N'Website',N'',3,1,@Requirements,@Assignments;
IF NOT EXISTS (SELECT 1 FROM dbo.SCENARIOS WHERE ProjectTitle=N'Website (2) (2)')
    OR NOT EXISTS (SELECT 1 FROM dbo.SCENARIOS WHERE ProjectTitle=N'Website (3)')
    OR EXISTS (SELECT 1 FROM dbo.vw_SCENARIO_SUMMARY WHERE AverageCompatibility<>93 OR SelectedPeople<>3)
    THROW 51908, 'Title suffixes or person-weighted compatibility are incorrect.', 1;
PRINT 'PASS complete save, literal title collisions and 93 percent average';

EXEC dbo.test_ExpectError N'EXEC dbo.usp_SaveScenario N''Client'',N''Bad'',N'''',4,1,N''[{"skillId":21,"count":2},{"skillId":29,"count":1}]'',N''[]'';',51042;
EXEC dbo.test_ExpectError N'EXEC dbo.usp_SaveScenario N''Client'',N''Bad'',N'''',2,1,N''[{"skillId":21,"count":1},{"skillId":29,"count":1}]'',N''[{"employeeId":1,"skillId":21},{"employeeId":1,"skillId":29}]'';',51043;
EXEC dbo.test_ExpectError N'EXEC dbo.usp_SaveScenario N''Client'',N''Bad'',N'''',1,1,N''[{"skillId":21,"count":1}]'',N''[{"employeeId":6,"skillId":21}]'';',51048;
EXEC dbo.test_ExpectError N'EXEC dbo.usp_SaveScenario N''Client'',N''Bad'',N'''',1,1,N''[{"skillId":21,"count":1}]'',N''[{"employeeId":7,"skillId":21}]'';',51048;
EXEC dbo.test_ExpectError N'EXEC dbo.usp_SaveScenario N''Client'',N''Bad'',N'''',1,1,N''[{"skillId":999999,"count":1}]'',N''[{"employeeId":1,"skillId":999999}]'';',51047;
EXEC dbo.test_ExpectError N'EXEC dbo.usp_SaveScenario N''Client'',N''Bad'',N'''',1,1,N''[{"skillId":21,"count":1.5}]'',N''[{"employeeId":1,"skillId":21}]'';',51042;
IF EXISTS (SELECT 1 FROM dbo.SCENARIOS WHERE BaseTitle=N'Bad') THROW 51909, 'Invalid save leaked partial data.', 1;
PRINT 'PASS invalid quotas, reused employees, unavailable/unassessed people and rollback';

UPDATE dbo.EMPLOYEE_SKILLS SET ProficiencyLevel=1 WHERE EmployeeID=1 AND SkillID=21;
IF (SELECT AverageCompatibility FROM dbo.vw_SCENARIO_SUMMARY WHERE ScenarioID=1)<>93
    THROW 51910, 'Saved proficiency facts changed after a profile edit.', 1;
UPDATE dbo.EMPLOYEE_SKILLS SET ProficiencyLevel=5 WHERE EmployeeID=1 AND SkillID=21;
DECLARE @Created DATETIME2(0)=(SELECT CreatedAt FROM dbo.SCENARIOS WHERE ScenarioID=1);
EXEC dbo.usp_SaveScenario N'Updated client',N'Website',N'Updated brief',3,1,@Requirements,@Assignments,1,1;
IF (SELECT Version FROM dbo.SCENARIOS WHERE ScenarioID=1)<>2
    OR (SELECT CreatedAt FROM dbo.SCENARIOS WHERE ScenarioID=1)<>@Created
    OR (SELECT ProjectTitle FROM dbo.SCENARIOS WHERE ScenarioID=1)<>N'Website'
    OR (SELECT COUNT(*) FROM dbo.SCENARIO_ASSIGNMENTS WHERE ScenarioID=1)<>3
    THROW 51911, 'Editing did not preserve identity, creation time and title.', 1;
EXEC dbo.test_ExpectError N'EXEC dbo.usp_SaveScenario N''Client'',N''Website'',N'''',3,1,N''[{"skillId":21,"count":2},{"skillId":29,"count":1}]'',N''[{"employeeId":1,"skillId":21},{"employeeId":2,"skillId":21},{"employeeId":3,"skillId":29}]'',1,1;',51045;
EXEC dbo.test_ExpectError N'DELETE dbo.SCENARIO_ASSIGNMENTS WHERE ScenarioID=1 AND EmployeeID=1;',51012;
EXEC dbo.test_ExpectError N'UPDATE dbo.SCENARIOS SET RequiredPeople=4 WHERE ScenarioID=1;',51011;
IF (SELECT Version FROM dbo.SCENARIOS WHERE ScenarioID=1)<>2
    OR (SELECT COUNT(*) FROM dbo.SCENARIO_ASSIGNMENTS WHERE ScenarioID=1)<>3
    THROW 51912, 'Failed update changed saved data.', 1;
PRINT 'PASS saved history, in-place edit, stale versions and saved-team integrity';

INSERT dbo.FOLDERS (FolderName) VALUES (N'Temporary folder');
DECLARE @Folder INT=CONVERT(INT,SCOPE_IDENTITY());
INSERT dbo.SKILLS (FolderID,SkillName) VALUES (@Folder,N'Temporary skill');
DECLARE @Skill INT=CONVERT(INT,SCOPE_IDENTITY());
INSERT dbo.EMPLOYEE_SKILLS (EmployeeID,SkillID,ProficiencyLevel) VALUES (4,@Skill,3);
EXEC dbo.usp_DeleteFolder @FolderID=@Folder;
IF NOT EXISTS (SELECT 1 FROM dbo.SKILLS s JOIN dbo.FOLDERS f ON f.FolderID=s.FolderID WHERE s.SkillID=@Skill AND f.IsDefault=1)
    OR NOT EXISTS (SELECT 1 FROM dbo.EMPLOYEE_SKILLS WHERE EmployeeID=4 AND SkillID=@Skill)
    THROW 51913, 'Folder deletion failed to move skills or preserve employee links.', 1;
EXEC dbo.test_ExpectError N'DELETE dbo.FOLDERS WHERE IsDefault=1;',547;
DECLARE @Unsorted INT=(SELECT FolderID FROM dbo.FOLDERS WHERE IsDefault=1);
DECLARE @DeleteUnsorted NVARCHAR(MAX)=N'EXEC dbo.usp_DeleteFolder @FolderID='+CONVERT(NVARCHAR(12),@Unsorted)+N';';
EXEC dbo.test_ExpectError @DeleteUnsorted,51010;
EXEC dbo.test_ExpectError N'UPDATE dbo.FOLDERS SET FolderName=N''Renamed'' WHERE IsDefault=1;',547;
EXEC dbo.test_ExpectError N'EXEC dbo.usp_DeleteSkill @SkillID=21;',51030;
IF (SELECT IsActive FROM dbo.SKILLS WHERE SkillID=21)<>1 THROW 51914, 'Unconfirmed deletion changed the skill.', 1;
EXEC dbo.usp_DeleteSkill @SkillID=21,@ConfirmAssignedRemoval=1;
IF EXISTS (SELECT 1 FROM dbo.EMPLOYEE_SKILLS WHERE SkillID=21 AND IsActive=1)
    OR (SELECT AverageCompatibility FROM dbo.vw_SCENARIO_SUMMARY WHERE ScenarioID=1)<>93
    THROW 51915, 'Skill retirement damaged history or left active assignments.', 1;
TRUNCATE TABLE #Candidates;
INSERT #Candidates EXEC dbo.usp_RankedCandidates @SkillID=21;
IF EXISTS (SELECT 1 FROM #Candidates) THROW 51916, 'Retired skills still produce candidates.', 1;
PRINT 'PASS folder moves, protected Unsorted, deletion warning and preserved history';
PRINT 'ALL DATABASE BEHAVIOR CHECKS PASSED';
GO
DROP PROCEDURE dbo.test_ExpectError;
GO
