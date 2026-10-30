/* Additive, repeatable employee concurrency protection. Run after 08_lifecycle.sql.
   Existing IDs, employee fields, assessments and saved scenarios are preserved.
   Revision is an opaque SQL Server ROWVERSION token, not a timestamp. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO
IF COL_LENGTH(N'dbo.EMPLOYEES',N'Revision') IS NULL
    ALTER TABLE dbo.EMPLOYEES ADD Revision ROWVERSION NOT NULL;
GO
CREATE OR ALTER TRIGGER dbo.tr_EMPLOYEE_SKILLS_EmployeeRevision
ON dbo.EMPLOYEE_SKILLS AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    -- Skill-only changes (including retirement) invalidate open employee forms.
    UPDATE e SET JobTitle=e.JobTitle
    FROM dbo.EMPLOYEES e
    JOIN (SELECT EmployeeID FROM inserted UNION SELECT EmployeeID FROM deleted) changed
        ON changed.EmployeeID=e.EmployeeID;
END;
GO
CREATE OR ALTER VIEW dbo.vw_EMPLOYEE_SKILLS
AS
SELECT e.EmployeeID AS ID, e.FirstName, e.LastName,
       COALESCE(e.Gender, N'Not specified') AS Gender,
       e.JobTitle, e.DepartmentID, d.DepartmentName AS Department,
       CONVERT(VARCHAR(18),CONVERT(BINARY(8),e.Revision),1) AS EmployeeVersion,
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
CREATE OR ALTER PROCEDURE dbo.usp_SaveEmployee
    @FirstName NVARCHAR(MAX), @LastName NVARCHAR(MAX), @DepartmentID INT,
    @JobTitle NVARCHAR(MAX), @Gender NVARCHAR(MAX), @IsAvailable BIT,
    @SkillsJson NVARCHAR(MAX), @EmployeeID INT = NULL,
    @ExpectedVersion NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    IF @@TRANCOUNT <> 0 THROW 51020, 'Call without an outer transaction.', 1;
    SET @FirstName=LTRIM(RTRIM(@FirstName));
    SET @LastName=LTRIM(RTRIM(@LastName));
    SET @JobTitle=LTRIM(RTRIM(@JobTitle));
    IF @FirstName IS NULL OR LEN(@FirstName) NOT BETWEEN 1 AND 100
        OR @LastName IS NULL OR LEN(@LastName) NOT BETWEEN 1 AND 100
        OR @JobTitle IS NULL OR LEN(@JobTitle) NOT BETWEEN 1 AND 100
        OR @IsAvailable IS NULL
        OR (@Gender IS NOT NULL AND @Gender NOT IN(N'Male',N'Female',N'Not specified',N'Prefer not to say'))
        THROW 51062, 'Invalid employee fields.', 1;
    IF ISNULL(ISJSON(@SkillsJson),0)<>1 OR LEFT(LTRIM(@SkillsJson),1)<>N'['
        THROW 51063, 'Skills must be a JSON array.', 1;
    DECLARE @Skills TABLE(SkillID INT, Experience DECIMAL(4,1), Level TINYINT,
                         ExperienceRaw NVARCHAR(MAX), LevelRaw NVARCHAR(MAX));
    INSERT @Skills
    SELECT TRY_CONVERT(INT, SkillID), TRY_CONVERT(DECIMAL(4,1), Experience),
           TRY_CONVERT(TINYINT, Level), Experience, Level
    FROM OPENJSON(@SkillsJson) WITH(SkillID NVARCHAR(MAX) '$.skillId',
        Experience NVARCHAR(MAX) '$.experienceYears', Level NVARCHAR(MAX) '$.proficiencyLevel');
    IF EXISTS(SELECT 1 FROM @Skills WHERE SkillID IS NULL
        OR (LevelRaw IS NOT NULL AND (Level IS NULL OR Level NOT BETWEEN 1 AND 5))
        OR (ExperienceRaw IS NOT NULL AND (Experience IS NULL OR Experience < 0
            OR TRY_CONVERT(DECIMAL(18,5),ExperienceRaw) IS NULL
            OR TRY_CONVERT(DECIMAL(18,5),ExperienceRaw) <> Experience)))
        OR EXISTS(SELECT SkillID FROM @Skills GROUP BY SkillID HAVING COUNT(*)>1)
        THROW 51063, 'Invalid employee skill assessments.', 1;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @LockResult INT;
        EXEC @LockResult = sys.sp_getapplock @Resource=N'Skillora.DatabaseWrite',
             @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000;
        IF @LockResult < 0 THROW 51021, 'Could not obtain the database write lock.', 1;
        IF @EmployeeID IS NOT NULL
        BEGIN
            IF NOT EXISTS(SELECT 1 FROM dbo.EMPLOYEES WHERE EmployeeID=@EmployeeID AND IsActive=1)
                THROW 51064, 'Employee not found.', 1;
            IF @ExpectedVersion IS NULL OR LEN(@ExpectedVersion)<>18
                OR TRY_CONVERT(BINARY(8),@ExpectedVersion,1) IS NULL
                OR NOT EXISTS(SELECT 1 FROM dbo.EMPLOYEES WITH(UPDLOCK,HOLDLOCK)
                    WHERE EmployeeID=@EmployeeID AND Revision=TRY_CONVERT(BINARY(8),@ExpectedVersion,1))
                THROW 51069, 'Stale employee version. Reload before saving.', 1;
        END;
        IF NOT EXISTS(SELECT 1 FROM dbo.DEPARTMENTS WHERE DepartmentID=@DepartmentID)
            THROW 51062, 'Department not found.', 1;
        IF EXISTS(SELECT 1 FROM @Skills requested
            LEFT JOIN dbo.SKILLS s ON s.SkillID=requested.SkillID AND s.IsActive=1
            LEFT JOIN dbo.FOLDERS f ON f.FolderID=s.FolderID AND f.IsActive=1
            WHERE s.SkillID IS NULL OR f.FolderID IS NULL)
            THROW 51063, 'An assigned skill is missing or inactive.', 1;
        IF @EmployeeID IS NULL
        BEGIN
            INSERT dbo.EMPLOYEES(FirstName,LastName,Gender,DepartmentID,JobTitle,IsAvailable)
            VALUES(@FirstName,@LastName,@Gender,@DepartmentID,@JobTitle,@IsAvailable);
            SET @EmployeeID=CONVERT(INT,SCOPE_IDENTITY());
        END
        ELSE
        BEGIN
            UPDATE dbo.EMPLOYEES SET FirstName=@FirstName,LastName=@LastName,
                Gender=@Gender,DepartmentID=@DepartmentID,JobTitle=@JobTitle,
                IsAvailable=@IsAvailable WHERE EmployeeID=@EmployeeID;
        END;
        -- Preserve junction IDs referenced by saved scenarios, including removed skills.
        UPDATE dbo.EMPLOYEE_SKILLS SET IsActive=0 WHERE EmployeeID=@EmployeeID;
        UPDATE existing SET ExperienceYears=incoming.Experience,
            ProficiencyLevel=incoming.Level, IsActive=1
        FROM dbo.EMPLOYEE_SKILLS existing JOIN @Skills incoming ON incoming.SkillID=existing.SkillID
        WHERE existing.EmployeeID=@EmployeeID;
        INSERT dbo.EMPLOYEE_SKILLS(EmployeeID,SkillID,ExperienceYears,ProficiencyLevel)
        SELECT @EmployeeID,SkillID,Experience,Level FROM @Skills incoming
        WHERE NOT EXISTS(SELECT 1 FROM dbo.EMPLOYEE_SKILLS existing
            WHERE existing.EmployeeID=@EmployeeID AND existing.SkillID=incoming.SkillID);
        COMMIT TRANSACTION;
        SELECT @EmployeeID AS EmployeeID;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
