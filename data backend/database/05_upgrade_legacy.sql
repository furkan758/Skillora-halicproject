/* Upgrade ONLY the exact schema of the three original user-supplied scripts.
   Back up your database first. Run this instead of 01_schema_ddl.sql.
   No employee, skill, folder, assignment or scenario IDs are replaced.
   Legacy ratings remain unassessed (NULL); availability defaults to false pending review.
   Duplicate project titles receive suffixes in ScenarioID order. Existing briefs survive.
   Legacy mock TeamMemberCount / AvgProficiency columns are replaced by computed views.
   Preflight conflicts abort the whole upgrade before any schema changes. */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;


IF @@TRANCOUNT <> 0 THROW 51000, 'Run upgrade without an open transaction.', 1;
IF OBJECT_ID(N'dbo.FOLDERS', N'U') IS NULL OR OBJECT_ID(N'dbo.SKILLS', N'U') IS NULL
    OR OBJECT_ID(N'dbo.EMPLOYEES', N'U') IS NULL OR OBJECT_ID(N'dbo.EMPLOYEE_SKILLS', N'U') IS NULL
    OR OBJECT_ID(N'dbo.SCENARIOS', N'U') IS NULL
    THROW 51003, 'Upgrade requires all five tables created by the original three scripts.', 1;
IF COL_LENGTH(N'dbo.EMPLOYEE_SKILLS', N'ProficiencyLevel') IS NOT NULL
    OR OBJECT_ID(N'dbo.DEPARTMENTS', N'U') IS NOT NULL
    OR OBJECT_ID(N'dbo.SCENARIO_REQUIREMENTS', N'U') IS NOT NULL
    OR OBJECT_ID(N'dbo.SCENARIO_ASSIGNMENTS', N'U') IS NOT NULL
    THROW 51004, 'Already upgraded or unsupported partial schema. No changes applied.', 1;
IF EXISTS (SELECT LOWER(LTRIM(RTRIM(SkillName))) COLLATE Latin1_General_100_CI_AS_SC
           FROM dbo.SKILLS GROUP BY LOWER(LTRIM(RTRIM(SkillName))) COLLATE Latin1_General_100_CI_AS_SC HAVING COUNT(*) > 1)
    THROW 51005, 'Duplicate global skill names exist. Resolve them before upgrading.', 1;
IF EXISTS (SELECT LOWER(LTRIM(RTRIM(FolderName))) COLLATE Latin1_General_100_CI_AS_SC
           FROM dbo.FOLDERS GROUP BY LOWER(LTRIM(RTRIM(FolderName))) COLLATE Latin1_General_100_CI_AS_SC HAVING COUNT(*) > 1)
    THROW 51006, 'Duplicate normalized folder names exist. Resolve them before upgrading.', 1;
IF EXISTS (SELECT 1 FROM dbo.SCENARIOS WHERE RequiredPeople NOT BETWEEN 1 AND 100)
    THROW 51007, 'An existing scenario exceeds the supported 1 to 100 headcount.', 1;
IF EXISTS (SELECT 1 FROM dbo.EMPLOYEES WHERE Gender IS NOT NULL
           AND Gender NOT IN (N'Male', N'Female', N'Not specified', N'Prefer not to say'))
    THROW 51008, 'Unsupported legacy gender value. Review it before upgrading.', 1;
BEGIN TRY
    BEGIN TRANSACTION;
    EXEC sys.sp_executesql N'CREATE TABLE dbo.DEPARTMENTS (
        DepartmentID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DEPARTMENTS PRIMARY KEY,
        DepartmentName NVARCHAR(100) NOT NULL,
        NameKey AS (LOWER(LTRIM(RTRIM(DepartmentName))) COLLATE Latin1_General_100_CI_AS_SC) PERSISTED,
        CONSTRAINT CK_DEPARTMENTS_Name CHECK (LEN(LTRIM(RTRIM(DepartmentName))) > 0)
    );
    CREATE UNIQUE INDEX UX_DEPARTMENTS_NameKey ON dbo.DEPARTMENTS(NameKey);';
    EXEC sys.sp_executesql N'INSERT dbo.DEPARTMENTS (DepartmentName) VALUES (N''Unassigned'');
ALTER TABLE dbo.FOLDERS ADD IsDefault BIT NOT NULL CONSTRAINT DF_FOLDERS_IsDefault DEFAULT (0);';
    EXEC sys.sp_executesql N'ALTER TABLE dbo.FOLDERS ADD NameKey AS (LOWER(LTRIM(RTRIM(FolderName))) COLLATE Latin1_General_100_CI_AS_SC) PERSISTED;';
    EXEC sys.sp_executesql N'CREATE UNIQUE INDEX UX_FOLDERS_NameKey ON dbo.FOLDERS(NameKey);
CREATE UNIQUE INDEX UX_FOLDERS_OneDefault ON dbo.FOLDERS(IsDefault) WHERE IsDefault = 1;
ALTER TABLE dbo.FOLDERS ADD CONSTRAINT CK_FOLDERS_Default CHECK (IsDefault = 0 OR (FolderName = N''Unsorted'' AND IsActive = 1));
IF EXISTS (SELECT 1 FROM dbo.FOLDERS WHERE NameKey = N''unsorted'')
    UPDATE dbo.FOLDERS SET FolderName = N''Unsorted'', IsDefault = 1, IsActive = 1 WHERE NameKey = N''unsorted'';
ELSE INSERT dbo.FOLDERS (FolderName, IsDefault) VALUES (N''Unsorted'', 1);';
    EXEC sys.sp_executesql N'ALTER TABLE dbo.SKILLS DROP CONSTRAINT UQ_SKILLS_FolderName;
ALTER TABLE dbo.SKILLS DROP CONSTRAINT CK_SKILLS_TeamMemberCount, CK_SKILLS_AvgProficiency, DF_SKILLS_TeamMemberCount;
ALTER TABLE dbo.SKILLS DROP COLUMN TeamMemberCount, AvgProficiency;
ALTER TABLE dbo.SKILLS ADD NameKey AS (LOWER(LTRIM(RTRIM(SkillName))) COLLATE Latin1_General_100_CI_AS_SC) PERSISTED;';
    EXEC sys.sp_executesql N'CREATE UNIQUE INDEX UX_SKILLS_NameKey ON dbo.SKILLS(NameKey);
CREATE INDEX IX_SKILLS_FolderID ON dbo.SKILLS(FolderID);';
    EXEC sys.sp_executesql N'ALTER TABLE dbo.EMPLOYEES ADD DepartmentID INT NULL;';
    EXEC sys.sp_executesql N'UPDATE dbo.EMPLOYEES SET DepartmentID = (SELECT DepartmentID FROM dbo.DEPARTMENTS WHERE NameKey = N''unassigned'');
ALTER TABLE dbo.EMPLOYEES ALTER COLUMN DepartmentID INT NOT NULL;
ALTER TABLE dbo.EMPLOYEES ADD JobTitle NVARCHAR(100) NOT NULL CONSTRAINT DF_EMPLOYEES_JobTitle DEFAULT (N''Team member''),
    IsAvailable BIT NOT NULL CONSTRAINT DF_EMPLOYEES_IsAvailable DEFAULT (0),
    IsActive BIT NOT NULL CONSTRAINT DF_EMPLOYEES_IsActive DEFAULT (1);
ALTER TABLE dbo.EMPLOYEES ADD CONSTRAINT FK_EMPLOYEES_DEPARTMENTS FOREIGN KEY (DepartmentID) REFERENCES dbo.DEPARTMENTS(DepartmentID),
    CONSTRAINT CK_EMPLOYEES_Gender CHECK (Gender IS NULL OR Gender IN (N''Male'', N''Female'', N''Not specified'', N''Prefer not to say''));
CREATE INDEX IX_EMPLOYEES_DepartmentID ON dbo.EMPLOYEES(DepartmentID);';
    EXEC sys.sp_executesql N'ALTER TABLE dbo.EMPLOYEE_SKILLS ADD ProficiencyLevel TINYINT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_EMPLOYEE_SKILLS_IsActive DEFAULT (1);';
    EXEC sys.sp_executesql N'ALTER TABLE dbo.EMPLOYEE_SKILLS ADD CONSTRAINT CK_EMPLOYEE_SKILLS_Proficiency CHECK (ProficiencyLevel IS NULL OR ProficiencyLevel BETWEEN 1 AND 5);
ALTER TABLE dbo.SCENARIOS ALTER COLUMN ProjectTitle NVARCHAR(220) NOT NULL;
ALTER TABLE dbo.SCENARIOS ADD BaseTitle NVARCHAR(200) NULL,
    TitleSequence INT NOT NULL CONSTRAINT DF_SCENARIOS_TitleSequence DEFAULT (1),
    OnlyAvailable BIT NOT NULL CONSTRAINT DF_SCENARIOS_OnlyAvailable DEFAULT (0),
    Status NVARCHAR(12) NOT NULL CONSTRAINT DF_SCENARIOS_Status DEFAULT (N''DRAFT''),
    Version INT NOT NULL CONSTRAINT DF_SCENARIOS_Version DEFAULT (1),
    UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SCENARIOS_UpdatedAt DEFAULT (SYSUTCDATETIME());';
    EXEC sys.sp_executesql N'UPDATE dbo.SCENARIOS SET BaseTitle = LTRIM(RTRIM(ProjectTitle)), UpdatedAt = CreatedAt;
ALTER TABLE dbo.SCENARIOS ALTER COLUMN BaseTitle NVARCHAR(200) NOT NULL;
ALTER TABLE dbo.SCENARIOS DROP CONSTRAINT CK_SCENARIOS_ProjectBrief, CK_SCENARIOS_RequiredPeople;
ALTER TABLE dbo.SCENARIOS ADD CONSTRAINT DF_SCENARIOS_ProjectBrief DEFAULT (N'''') FOR ProjectBrief,
    CONSTRAINT CK_SCENARIOS_BaseTitle CHECK (LEN(LTRIM(RTRIM(BaseTitle))) > 0),
    CONSTRAINT CK_SCENARIOS_RequiredPeople CHECK (RequiredPeople BETWEEN 1 AND 100),
    CONSTRAINT CK_SCENARIOS_TitleSequence CHECK (TitleSequence >= 1),
    CONSTRAINT CK_SCENARIOS_Version CHECK (Version >= 1),
    CONSTRAINT CK_SCENARIOS_Status CHECK (Status IN (N''DRAFT'', N''SAVED'', N''ARCHIVED''));
DECLARE @Used TABLE (Title NVARCHAR(220) COLLATE Latin1_General_100_CI_AS_SC PRIMARY KEY);
DECLARE @ID INT, @Base NVARCHAR(200), @Display NVARCHAR(220), @Seq INT;
DECLARE title_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT ScenarioID, BaseTitle FROM dbo.SCENARIOS ORDER BY ScenarioID;
OPEN title_cursor;
FETCH NEXT FROM title_cursor INTO @ID, @Base;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @Seq = 1; SET @Display = @Base;
    WHILE EXISTS (SELECT 1 FROM @Used WHERE Title = @Display)
    BEGIN
        SET @Seq += 1; SET @Display = @Base + N'' ('' + CONVERT(NVARCHAR(12), @Seq) + N'')'';
    END;
    INSERT @Used VALUES (@Display);
    UPDATE dbo.SCENARIOS SET ProjectTitle = @Display, TitleSequence = @Seq WHERE ScenarioID = @ID;
    FETCH NEXT FROM title_cursor INTO @ID, @Base;
END;
CLOSE title_cursor; DEALLOCATE title_cursor;
ALTER TABLE dbo.SCENARIOS ADD TitleKey AS (LOWER(LTRIM(RTRIM(ProjectTitle))) COLLATE Latin1_General_100_CI_AS_SC) PERSISTED;';
    EXEC sys.sp_executesql N'CREATE UNIQUE INDEX UX_SCENARIOS_TitleKey ON dbo.SCENARIOS(TitleKey);';
    EXEC sys.sp_executesql N'CREATE TABLE dbo.SCENARIO_REQUIREMENTS (
        ScenarioID INT NOT NULL,
        SkillID INT NOT NULL,
        RequiredCount INT NOT NULL,
        CONSTRAINT PK_SCENARIO_REQUIREMENTS PRIMARY KEY (ScenarioID, SkillID),
        CONSTRAINT FK_SCENARIO_REQUIREMENTS_SCENARIOS FOREIGN KEY (ScenarioID) REFERENCES dbo.SCENARIOS(ScenarioID),
        CONSTRAINT FK_SCENARIO_REQUIREMENTS_SKILLS FOREIGN KEY (SkillID) REFERENCES dbo.SKILLS(SkillID),
        CONSTRAINT CK_SCENARIO_REQUIREMENTS_Count CHECK (RequiredCount BETWEEN 1 AND 100)
    );';
    EXEC sys.sp_executesql N'CREATE TABLE dbo.SCENARIO_ASSIGNMENTS (
        ScenarioID INT NOT NULL,
        EmployeeID INT NOT NULL,
        SkillID INT NOT NULL,
        ProficiencyAtSelection TINYINT NOT NULL,
        SelectedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SCENARIO_ASSIGNMENTS_SelectedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_SCENARIO_ASSIGNMENTS PRIMARY KEY (ScenarioID, EmployeeID),
        CONSTRAINT FK_SCENARIO_ASSIGNMENTS_REQUIREMENTS FOREIGN KEY (ScenarioID, SkillID) REFERENCES dbo.SCENARIO_REQUIREMENTS(ScenarioID, SkillID),
        CONSTRAINT FK_SCENARIO_ASSIGNMENTS_EMPLOYEE_SKILLS FOREIGN KEY (EmployeeID, SkillID) REFERENCES dbo.EMPLOYEE_SKILLS(EmployeeID, SkillID),
        CONSTRAINT CK_SCENARIO_ASSIGNMENTS_Proficiency CHECK (ProficiencyAtSelection BETWEEN 1 AND 5)
    );
    CREATE INDEX IX_SCENARIO_ASSIGNMENTS_Requirement ON dbo.SCENARIO_ASSIGNMENTS(ScenarioID, SkillID);
    CREATE INDEX IX_SCENARIO_ASSIGNMENTS_EmployeeSkill ON dbo.SCENARIO_ASSIGNMENTS(EmployeeID, SkillID);';
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
PRINT 'Legacy data upgraded. Run 02_data_seed.sql (optional catalog), 03_views.sql and 04_operations.sql.';
PRINT 'Review legacy department, availability and proficiency values before candidate matching.';
