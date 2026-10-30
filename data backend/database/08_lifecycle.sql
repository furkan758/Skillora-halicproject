/* Additive lifecycle operations. Existing records are not reset.
   Restoring a skill never silently restores former employee assignments. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER PROCEDURE dbo.usp_RestoreSkill @SkillID INT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    IF @@TRANCOUNT <> 0 THROW 51020, 'Call without an outer transaction.', 1;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @LockResult INT;
        EXEC @LockResult=sys.sp_getapplock @Resource=N'Skillora.DatabaseWrite',
            @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @LockResult<0 THROW 51021, 'Could not obtain the write lock.',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.SKILLS WHERE SkillID=@SkillID)
            THROW 51024,'Skill not found.',1;
        UPDATE dbo.SKILLS SET IsActive=1 WHERE SkillID=@SkillID;
        COMMIT TRANSACTION;
        SELECT @SkillID AS SkillID;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ScenarioLifecycle
    @ScenarioID INT, @ExpectedVersion INT, @Operation NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    IF @@TRANCOUNT <> 0 THROW 51020,'Call without an outer transaction.',1;
    IF @ExpectedVersion IS NULL OR @ExpectedVersion<1
        THROW 51045,'A valid scenario version is required.',1;
    IF @Operation IS NULL OR @Operation NOT IN(N'archive',N'restore',N'delete')
        THROW 51068,'Invalid lifecycle operation.',1;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @LockResult INT,@Version INT,@Status NVARCHAR(10);
        EXEC @LockResult=sys.sp_getapplock @Resource=N'Skillora.DatabaseWrite',
            @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @LockResult<0 THROW 51021,'Could not obtain the write lock.',1;
        SELECT @Version=Version,@Status=Status FROM dbo.SCENARIOS WITH(UPDLOCK,HOLDLOCK)
            WHERE ScenarioID=@ScenarioID;
        IF @Version IS NULL THROW 51044,'Scenario not found.',1;
        IF @Version<>@ExpectedVersion THROW 51045,'Stale scenario version.',1;
        IF @Operation=N'archive'
        BEGIN
            IF @Status<>N'SAVED' THROW 51068,'Only complete saved scenarios can be archived.',1;
            UPDATE dbo.SCENARIOS SET Status=N'ARCHIVED',Version=Version+1,UpdatedAt=SYSUTCDATETIME()
                WHERE ScenarioID=@ScenarioID;
        END
        ELSE IF @Operation=N'restore'
        BEGIN
            IF @Status<>N'ARCHIVED' THROW 51068,'Only archived scenarios can be restored.',1;
            UPDATE dbo.SCENARIOS SET Status=N'SAVED',Version=Version+1,UpdatedAt=SYSUTCDATETIME()
                WHERE ScenarioID=@ScenarioID;
        END
        ELSE
        BEGIN
            IF @Status NOT IN(N'ARCHIVED',N'DRAFT')
                THROW 51067,'Archive this scenario before permanently deleting it.',1;
            -- Temporarily leave the protected saved state inside this transaction.
            UPDATE dbo.SCENARIOS SET Status=N'DRAFT' WHERE ScenarioID=@ScenarioID;
            DELETE FROM dbo.SCENARIO_ASSIGNMENTS WHERE ScenarioID=@ScenarioID;
            DELETE FROM dbo.SCENARIO_REQUIREMENTS WHERE ScenarioID=@ScenarioID;
            DELETE FROM dbo.SCENARIOS WHERE ScenarioID=@ScenarioID;
        END;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
GRANT EXECUTE ON dbo.usp_RestoreSkill TO skillora_app;
GRANT EXECUTE ON dbo.usp_ScenarioLifecycle TO skillora_app;
GO
