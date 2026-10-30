/* Database operations only; no Python application or API.
   All package write procedures share a short transaction-owned application lock.
   This intentionally favors correctness over high write throughput for the prototype. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER TRIGGER dbo.tr_FOLDERS_ProtectUnsorted
ON dbo.FOLDERS AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM deleted d
        LEFT JOIN inserted i ON i.FolderID = d.FolderID
        WHERE d.IsDefault = 1
          AND (i.FolderID IS NULL OR i.IsDefault <> 1 OR i.IsActive <> 1
               OR i.FolderName COLLATE Latin1_General_100_BIN2 <> N'Unsorted')
    ) THROW 51010, 'The Unsorted folder cannot be removed, renamed or disabled.', 1;
END;
GO
CREATE OR ALTER TRIGGER dbo.tr_SCENARIOS_ValidateSaved
ON dbo.SCENARIOS AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM inserted s
        WHERE s.Status IN (N'SAVED', N'ARCHIVED') AND (
            COALESCE((SELECT SUM(r.RequiredCount) FROM dbo.SCENARIO_REQUIREMENTS r
                      WHERE r.ScenarioID = s.ScenarioID), 0) <> s.RequiredPeople
            OR (SELECT COUNT(*) FROM dbo.SCENARIO_ASSIGNMENTS a
                WHERE a.ScenarioID = s.ScenarioID) <> s.RequiredPeople
            OR EXISTS (
                SELECT 1 FROM dbo.SCENARIO_REQUIREMENTS r
                WHERE r.ScenarioID = s.ScenarioID AND r.RequiredCount <>
                    (SELECT COUNT(*) FROM dbo.SCENARIO_ASSIGNMENTS a
                     WHERE a.ScenarioID = r.ScenarioID AND a.SkillID = r.SkillID)
            )
        )
    ) THROW 51011, 'A saved scenario must fill every quota with distinct employees.', 1;
END;
GO
CREATE OR ALTER TRIGGER dbo.tr_REQUIREMENTS_ProtectSaved
ON dbo.SCENARIO_REQUIREMENTS AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM dbo.SCENARIOS s
        JOIN (SELECT ScenarioID FROM inserted UNION SELECT ScenarioID FROM deleted) changed
          ON changed.ScenarioID = s.ScenarioID
        WHERE s.Status IN (N'SAVED', N'ARCHIVED')
    ) THROW 51012, 'Use usp_SaveScenario to change a saved scenario.', 1;
END;
GO
CREATE OR ALTER TRIGGER dbo.tr_ASSIGNMENTS_ProtectSaved
ON dbo.SCENARIO_ASSIGNMENTS AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM dbo.SCENARIOS s
        JOIN (SELECT ScenarioID FROM inserted UNION SELECT ScenarioID FROM deleted) changed
          ON changed.ScenarioID = s.ScenarioID
        WHERE s.Status IN (N'SAVED', N'ARCHIVED')
    ) THROW 51012, 'Use usp_SaveScenario to change a saved scenario.', 1;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_DeleteFolder @FolderID INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @@TRANCOUNT <> 0 THROW 51020, 'Call without an outer transaction.', 1;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @LockResult INT, @DefaultID INT;
        EXEC @LockResult = sys.sp_getapplock @Resource = N'Skillora.DatabaseWrite',
            @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;
        IF @LockResult < 0 THROW 51021, 'Could not obtain the database write lock.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.FOLDERS WHERE FolderID = @FolderID)
            THROW 51022, 'Folder not found.', 1;
        IF EXISTS (SELECT 1 FROM dbo.FOLDERS WHERE FolderID = @FolderID AND IsDefault = 1)
            THROW 51010, 'The Unsorted folder cannot be removed.', 1;
        SELECT @DefaultID = FolderID FROM dbo.FOLDERS WHERE IsDefault = 1 AND IsActive = 1;
        IF @DefaultID IS NULL THROW 51023, 'The Unsorted folder is missing.', 1;
        UPDATE dbo.SKILLS SET FolderID = @DefaultID WHERE FolderID = @FolderID;
        DELETE FROM dbo.FOLDERS WHERE FolderID = @FolderID;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_DeleteSkill
    @SkillID INT, @ConfirmAssignedRemoval BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @@TRANCOUNT <> 0 THROW 51020, 'Call without an outer transaction.', 1;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @LockResult INT;
        EXEC @LockResult = sys.sp_getapplock @Resource = N'Skillora.DatabaseWrite',
            @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;
        IF @LockResult < 0 THROW 51021, 'Could not obtain the database write lock.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.SKILLS WHERE SkillID = @SkillID)
            THROW 51024, 'Skill not found.', 1;
        IF ISNULL(@ConfirmAssignedRemoval, 0) = 0 AND EXISTS (
            SELECT 1 FROM dbo.EMPLOYEE_SKILLS WHERE SkillID = @SkillID AND IsActive = 1
        )
        BEGIN
            SELECT e.EmployeeID, e.FirstName, e.LastName
            FROM dbo.EMPLOYEE_SKILLS es
            JOIN dbo.EMPLOYEES e ON e.EmployeeID = es.EmployeeID
            WHERE es.SkillID = @SkillID AND es.IsActive = 1;
            THROW 51030, 'Assigned skill: review affected employees and confirm removal.', 1;
        END;
        -- Retirement preserves referenced skills, employee links and saved team facts.
        UPDATE dbo.EMPLOYEE_SKILLS SET IsActive = 0 WHERE SkillID = @SkillID;
        UPDATE dbo.SKILLS SET IsActive = 0 WHERE SkillID = @SkillID;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_SaveScenario
    @ClientName NVARCHAR(MAX), @ProjectTitle NVARCHAR(MAX),
    @ProjectBrief NVARCHAR(MAX), @RequiredPeople INT,
    @OnlyAvailable BIT,
    @RequirementsJson NVARCHAR(MAX), -- [{"skillId":21,"count":2}, ...]
    @AssignmentsJson NVARCHAR(MAX),  -- [{"employeeId":1,"skillId":21}, ...]
    @ScenarioID INT = NULL, @ExpectedVersion INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @@TRANCOUNT <> 0 THROW 51020, 'Call without an outer transaction.', 1;
    SET @ClientName = LTRIM(RTRIM(@ClientName));
    SET @ProjectTitle = LTRIM(RTRIM(@ProjectTitle));
    IF @ClientName IS NULL OR LEN(@ClientName) NOT BETWEEN 1 AND 150
        OR @ProjectTitle IS NULL OR LEN(@ProjectTitle) NOT BETWEEN 1 AND 200
        OR @RequiredPeople IS NULL OR @RequiredPeople NOT BETWEEN 1 AND 100
        OR @OnlyAvailable IS NULL
        THROW 51040, 'Invalid scenario title, client or headcount.', 1;
    IF ISNULL(ISJSON(@RequirementsJson), 0) <> 1
        OR ISNULL(ISJSON(@AssignmentsJson), 0) <> 1
        OR LEFT(LTRIM(@RequirementsJson), 1) <> N'['
        OR LEFT(LTRIM(@AssignmentsJson), 1) <> N'['
        THROW 51041, 'Requirements and assignments must be JSON arrays.', 1;

    DECLARE @Requirements TABLE (SkillID INT NULL, RequiredCount INT NULL);
    DECLARE @Assignments TABLE (EmployeeID INT NULL, SkillID INT NULL);
    -- Read raw JSON values, then validate integer conversion explicitly.
    INSERT @Requirements
    SELECT TRY_CONVERT(INT, SkillID), TRY_CONVERT(INT, RequiredCount)
    FROM OPENJSON(@RequirementsJson) WITH (SkillID NVARCHAR(MAX) '$.skillId', RequiredCount NVARCHAR(MAX) '$.count');
    INSERT @Assignments
    SELECT TRY_CONVERT(INT, EmployeeID), TRY_CONVERT(INT, SkillID)
    FROM OPENJSON(@AssignmentsJson) WITH (EmployeeID NVARCHAR(MAX) '$.employeeId', SkillID NVARCHAR(MAX) '$.skillId');
    IF EXISTS (SELECT 1 FROM @Requirements WHERE SkillID IS NULL OR RequiredCount IS NULL OR RequiredCount NOT BETWEEN 1 AND 100)
        OR EXISTS (SELECT SkillID FROM @Requirements GROUP BY SkillID HAVING COUNT(*) > 1)
        OR ISNULL((SELECT SUM(RequiredCount) FROM @Requirements), 0) <> @RequiredPeople
        THROW 51042, 'Unique positive skill quotas must total requested headcount.', 1;
    IF EXISTS (SELECT 1 FROM @Assignments WHERE EmployeeID IS NULL OR SkillID IS NULL)
        OR EXISTS (SELECT EmployeeID FROM @Assignments GROUP BY EmployeeID HAVING COUNT(*) > 1)
        OR (SELECT COUNT(*) FROM @Assignments) <> @RequiredPeople
        OR EXISTS (SELECT 1 FROM @Assignments a WHERE NOT EXISTS (SELECT 1 FROM @Requirements r WHERE r.SkillID = a.SkillID))
        OR EXISTS (SELECT 1 FROM @Requirements r WHERE r.RequiredCount <> (SELECT COUNT(*) FROM @Assignments a WHERE a.SkillID = r.SkillID))
        THROW 51043, 'Every quota requires distinct, fully selected employees.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @LockResult INT, @OldBase NVARCHAR(200), @DisplayTitle NVARCHAR(220),
                @Sequence INT = 1, @CurrentVersion INT, @CurrentStatus NVARCHAR(12);
        EXEC @LockResult = sys.sp_getapplock @Resource = N'Skillora.DatabaseWrite',
            @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;
        IF @LockResult < 0 THROW 51021, 'Could not obtain the database write lock.', 1;

        IF @ScenarioID IS NOT NULL
        BEGIN
            SELECT @OldBase = BaseTitle, @DisplayTitle = ProjectTitle,
                   @Sequence = TitleSequence, @CurrentVersion = Version, @CurrentStatus = Status
            FROM dbo.SCENARIOS WITH (UPDLOCK, HOLDLOCK) WHERE ScenarioID = @ScenarioID;
            IF @CurrentVersion IS NULL THROW 51044, 'Scenario not found.', 1;
            IF @ExpectedVersion IS NULL OR @ExpectedVersion <> @CurrentVersion
                THROW 51045, 'Scenario changed. Reload before saving again.', 1;
            IF @CurrentStatus = N'ARCHIVED' THROW 51046, 'Archived scenarios cannot be edited.', 1;
        END;
        IF EXISTS (
            SELECT 1 FROM @Requirements r
            LEFT JOIN dbo.SKILLS s WITH (UPDLOCK, HOLDLOCK) ON s.SkillID = r.SkillID
            LEFT JOIN dbo.FOLDERS f WITH (UPDLOCK, HOLDLOCK) ON f.FolderID = s.FolderID
            WHERE s.SkillID IS NULL OR s.IsActive = 0 OR f.IsActive = 0
        ) THROW 51047, 'A required skill is missing or inactive.', 1;
        IF EXISTS (
            SELECT 1 FROM @Assignments a
            LEFT JOIN dbo.EMPLOYEE_SKILLS es WITH (UPDLOCK, HOLDLOCK)
              ON es.EmployeeID = a.EmployeeID AND es.SkillID = a.SkillID
            LEFT JOIN dbo.EMPLOYEES e WITH (UPDLOCK, HOLDLOCK) ON e.EmployeeID = a.EmployeeID
            WHERE es.EmployeeSkillID IS NULL OR es.IsActive = 0
               OR es.ProficiencyLevel IS NULL OR e.IsActive = 0
               OR (@OnlyAvailable = 1 AND e.IsAvailable = 0)
        ) THROW 51048, 'A selected employee is unavailable, unassessed or ineligible.', 1;

        IF @ScenarioID IS NULL OR @OldBase COLLATE Latin1_General_100_BIN2 <> @ProjectTitle COLLATE Latin1_General_100_BIN2
        BEGIN
            SET @Sequence = 1;
            SET @DisplayTitle = @ProjectTitle;
            WHILE EXISTS (SELECT 1 FROM dbo.SCENARIOS
                          WHERE TitleKey = LOWER(@DisplayTitle) COLLATE Latin1_General_100_CI_AS_SC
                            AND (@ScenarioID IS NULL OR ScenarioID <> @ScenarioID))
            BEGIN
                SET @Sequence += 1;
                SET @DisplayTitle = @ProjectTitle + N' (' + CONVERT(NVARCHAR(12), @Sequence) + N')';
            END;
        END;
        IF @ScenarioID IS NULL
        BEGIN
            INSERT dbo.SCENARIOS (ClientName, BaseTitle, ProjectTitle, TitleSequence,
                                  ProjectBrief, RequiredPeople, OnlyAvailable)
            VALUES (@ClientName, @ProjectTitle, @DisplayTitle, @Sequence,
                    COALESCE(@ProjectBrief, N''), @RequiredPeople, @OnlyAvailable);
            SET @ScenarioID = CONVERT(INT, SCOPE_IDENTITY());
        END
        ELSE
        BEGIN
            UPDATE dbo.SCENARIOS SET Status = N'DRAFT' WHERE ScenarioID = @ScenarioID;
            DELETE dbo.SCENARIO_ASSIGNMENTS WHERE ScenarioID = @ScenarioID;
            DELETE dbo.SCENARIO_REQUIREMENTS WHERE ScenarioID = @ScenarioID;
            UPDATE dbo.SCENARIOS
            SET ClientName = @ClientName, BaseTitle = @ProjectTitle, ProjectTitle = @DisplayTitle,
                TitleSequence = @Sequence, ProjectBrief = COALESCE(@ProjectBrief, N''),
                RequiredPeople = @RequiredPeople, OnlyAvailable = @OnlyAvailable,
                Version = Version + 1, UpdatedAt = SYSUTCDATETIME()
            WHERE ScenarioID = @ScenarioID;
        END;
        INSERT dbo.SCENARIO_REQUIREMENTS (ScenarioID, SkillID, RequiredCount)
        SELECT @ScenarioID, SkillID, RequiredCount FROM @Requirements;
        INSERT dbo.SCENARIO_ASSIGNMENTS (ScenarioID, EmployeeID, SkillID, ProficiencyAtSelection)
        SELECT @ScenarioID, a.EmployeeID, a.SkillID, es.ProficiencyLevel
        FROM @Assignments a
        JOIN dbo.EMPLOYEE_SKILLS es ON es.EmployeeID = a.EmployeeID AND es.SkillID = a.SkillID;
        UPDATE dbo.SCENARIOS SET Status = N'SAVED' WHERE ScenarioID = @ScenarioID;
        COMMIT TRANSACTION;
        SELECT * FROM dbo.vw_SCENARIO_SUMMARY WHERE ScenarioID = @ScenarioID;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_RankedCandidates
    @SkillID INT, @OnlyAvailable BIT = 0, @Page INT = 1,
    @ExcludedEmployeeIDsJson NVARCHAR(MAX) = N'[]'
AS
BEGIN
    SET NOCOUNT ON;
    IF @Page IS NULL OR @Page < 1 OR @OnlyAvailable IS NULL
        THROW 51050, 'Invalid page or availability filter.', 1;
    IF ISNULL(ISJSON(@ExcludedEmployeeIDsJson), 0) <> 1
        OR LEFT(LTRIM(@ExcludedEmployeeIDsJson), 1) <> N'['
        THROW 51051, 'Excluded employee IDs must be a JSON array.', 1;
    DECLARE @Excluded TABLE (EmployeeID INT NULL);
    INSERT @Excluded SELECT TRY_CONVERT(INT, value) FROM OPENJSON(@ExcludedEmployeeIDsJson);
    IF EXISTS (SELECT 1 FROM @Excluded WHERE EmployeeID IS NULL)
        THROW 51051, 'Excluded employee IDs must be integers.', 1;
    ;WITH Ranked AS (
        SELECT e.EmployeeID, e.FirstName, e.LastName, e.IsAvailable,
               es.ProficiencyLevel, es.ProficiencyLevel * 20 AS Compatibility,
               ROW_NUMBER() OVER (ORDER BY es.ProficiencyLevel DESC, e.FirstName, e.LastName, e.EmployeeID) AS Position,
               COUNT(*) OVER () AS TotalCandidates
        FROM dbo.EMPLOYEE_SKILLS es
        JOIN dbo.EMPLOYEES e ON e.EmployeeID = es.EmployeeID AND e.IsActive = 1
        JOIN dbo.SKILLS s ON s.SkillID = es.SkillID AND s.IsActive = 1
        JOIN dbo.FOLDERS f ON f.FolderID = s.FolderID AND f.IsActive = 1
        WHERE es.SkillID = @SkillID AND es.IsActive = 1 AND es.ProficiencyLevel BETWEEN 1 AND 5
          AND (@OnlyAvailable = 0 OR e.IsAvailable = 1)
          AND NOT EXISTS (SELECT 1 FROM @Excluded x WHERE x.EmployeeID = e.EmployeeID)
    )
    SELECT * FROM Ranked WHERE Position BETWEEN (CONVERT(BIGINT, @Page) - 1) * 5 + 1 AND CONVERT(BIGINT, @Page) * 5
    ORDER BY Position;
END;
GO
-- Future API accounts may join this role. No login or server permission is created.
IF DATABASE_PRINCIPAL_ID(N'skillora_app') IS NULL CREATE ROLE skillora_app;
GRANT SELECT ON dbo.vw_EMPLOYEE_SKILLS TO skillora_app;
GRANT SELECT ON dbo.vw_SKILL_CATALOG TO skillora_app;
GRANT SELECT ON dbo.vw_FOLDER_CATALOG TO skillora_app;
GRANT SELECT ON dbo.vw_SCENARIO_SUMMARY TO skillora_app;
GRANT SELECT ON dbo.vw_SCENARIO_TEAM TO skillora_app;
GRANT EXECUTE ON dbo.usp_SaveScenario TO skillora_app;
GRANT EXECUTE ON dbo.usp_DeleteFolder TO skillora_app;
GRANT EXECUTE ON dbo.usp_DeleteSkill TO skillora_app;
GRANT EXECUTE ON dbo.usp_RankedCandidates TO skillora_app;
DENY INSERT, UPDATE, DELETE ON dbo.SCENARIOS TO skillora_app;
DENY INSERT, UPDATE, DELETE ON dbo.SCENARIO_REQUIREMENTS TO skillora_app;
DENY INSERT, UPDATE, DELETE ON dbo.SCENARIO_ASSIGNMENTS TO skillora_app;
GO
