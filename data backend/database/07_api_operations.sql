/* API additions. Run after 04_operations.sql in the selected Skillora database.
   Existing tables and data are preserved. All writes share the package lock. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO
CREATE OR ALTER VIEW dbo.vw_SCENARIO_REQUIREMENTS
AS
SELECT r.ScenarioID, r.SkillID, s.SkillName, r.RequiredCount,
       s.IsActive AS SkillIsActive
FROM dbo.SCENARIO_REQUIREMENTS r
JOIN dbo.SKILLS s ON s.SkillID = r.SkillID;
GO
CREATE OR ALTER VIEW dbo.vw_SCENARIO_TEAM_API
AS
SELECT t.*, e.JobTitle
FROM dbo.vw_SCENARIO_TEAM t
JOIN dbo.EMPLOYEES e ON e.EmployeeID = t.EmployeeID;
GO
CREATE OR ALTER PROCEDURE dbo.usp_SaveFolder
    @FolderName NVARCHAR(MAX), @Description NVARCHAR(MAX) = NULL,
    @FolderID INT = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    IF @@TRANCOUNT <> 0 THROW 51020, 'Call without an outer transaction.', 1;
    SET @FolderName = LTRIM(RTRIM(@FolderName));
    IF @FolderName IS NULL OR LEN(@FolderName) NOT BETWEEN 1 AND 100
        OR LEN(@Description) > 500 THROW 51060, 'Invalid folder fields.', 1;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @LockResult INT;
        EXEC @LockResult = sys.sp_getapplock @Resource=N'Skillora.DatabaseWrite',
             @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000;
        IF @LockResult < 0 THROW 51021, 'Could not obtain the database write lock.', 1;
        IF @FolderID IS NULL
        BEGIN
            INSERT dbo.FOLDERS(FolderName, Description) VALUES(@FolderName, @Description);
            SET @FolderID = CONVERT(INT, SCOPE_IDENTITY());
        END
        ELSE
        BEGIN
            IF NOT EXISTS(SELECT 1 FROM dbo.FOLDERS WHERE FolderID=@FolderID AND IsActive=1)
                THROW 51022, 'Folder not found.', 1;
            UPDATE dbo.FOLDERS SET FolderName=@FolderName, Description=@Description
            WHERE FolderID=@FolderID;
        END;
        COMMIT TRANSACTION;
        SELECT @FolderID AS FolderID;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_SaveSkill
    @SkillName NVARCHAR(MAX), @FolderID INT,
    @Description NVARCHAR(MAX) = NULL, @SkillID INT = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    IF @@TRANCOUNT <> 0 THROW 51020, 'Call without an outer transaction.', 1;
    SET @SkillName = LTRIM(RTRIM(@SkillName));
    IF @SkillName IS NULL OR LEN(@SkillName) NOT BETWEEN 1 AND 100
        OR LEN(@Description) > 500 THROW 51061, 'Invalid skill fields.', 1;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @LockResult INT;
        EXEC @LockResult = sys.sp_getapplock @Resource=N'Skillora.DatabaseWrite',
             @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000;
        IF @LockResult < 0 THROW 51021, 'Could not obtain the database write lock.', 1;
        IF NOT EXISTS(SELECT 1 FROM dbo.FOLDERS WHERE FolderID=@FolderID AND IsActive=1)
            THROW 51022, 'Folder not found.', 1;
        IF @SkillID IS NULL
        BEGIN
            INSERT dbo.SKILLS(SkillName, FolderID, Description)
            VALUES(@SkillName, @FolderID, @Description);
            SET @SkillID = CONVERT(INT, SCOPE_IDENTITY());
        END
        ELSE
        BEGIN
            IF NOT EXISTS(SELECT 1 FROM dbo.SKILLS WHERE SkillID=@SkillID AND IsActive=1)
                THROW 51024, 'Skill not found.', 1;
            UPDATE dbo.SKILLS SET SkillName=@SkillName, FolderID=@FolderID,
                Description=@Description WHERE SkillID=@SkillID;
        END;
        COMMIT TRANSACTION;
        SELECT @SkillID AS SkillID;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_SaveEmployee
    @FirstName NVARCHAR(MAX), @LastName NVARCHAR(MAX), @DepartmentID INT,
    @JobTitle NVARCHAR(MAX), @Gender NVARCHAR(MAX), @IsAvailable BIT,
    @SkillsJson NVARCHAR(MAX), @EmployeeID INT = NULL
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
            IF NOT EXISTS(SELECT 1 FROM dbo.EMPLOYEES WHERE EmployeeID=@EmployeeID AND IsActive=1)
                THROW 51064, 'Employee not found.', 1;
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
CREATE OR ALTER PROCEDURE dbo.usp_DeleteEmployee @EmployeeID INT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    IF @@TRANCOUNT <> 0 THROW 51020, 'Call without an outer transaction.', 1;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @LockResult INT;
        EXEC @LockResult = sys.sp_getapplock @Resource=N'Skillora.DatabaseWrite',
             @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000;
        IF @LockResult < 0 THROW 51021, 'Could not obtain the database write lock.', 1;
        IF NOT EXISTS(SELECT 1 FROM dbo.EMPLOYEES WHERE EmployeeID=@EmployeeID AND IsActive=1)
            THROW 51064, 'Employee not found.', 1;
        UPDATE dbo.EMPLOYEE_SKILLS SET IsActive=0 WHERE EmployeeID=@EmployeeID;
        UPDATE dbo.EMPLOYEES SET IsActive=0 WHERE EmployeeID=@EmployeeID;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
GRANT SELECT ON dbo.DEPARTMENTS TO skillora_app;
GRANT SELECT ON dbo.vw_SCENARIO_REQUIREMENTS TO skillora_app;
GRANT SELECT ON dbo.vw_SCENARIO_TEAM_API TO skillora_app;
GRANT EXECUTE ON dbo.usp_SaveFolder TO skillora_app;
GRANT EXECUTE ON dbo.usp_SaveSkill TO skillora_app;
GRANT EXECUTE ON dbo.usp_SaveEmployee TO skillora_app;
GRANT EXECUTE ON dbo.usp_DeleteEmployee TO skillora_app;
GO
