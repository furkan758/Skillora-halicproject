/* Isolated test database only. Verifies the future API role uses approved paths. */
SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO
IF DATABASE_PRINCIPAL_ID(N'SkilloraTestApp') IS NULL CREATE USER SkilloraTestApp WITHOUT LOGIN;
ALTER ROLE skillora_app ADD MEMBER SkilloraTestApp;
GO
EXECUTE AS USER = N'SkilloraTestApp';
BEGIN TRY
    SELECT TOP (1) SkillID, TeamMemberCount FROM dbo.vw_SKILL_CATALOG;
    EXEC dbo.usp_RankedCandidates @SkillID=29;
    EXEC dbo.usp_SaveScenario N'Permission test',N'Permission test',N'',1,1,
        N'[{"skillId":29,"count":1}]',N'[{"employeeId":1,"skillId":29}]';
    DECLARE @Blocked BIT=0;
    BEGIN TRY
        UPDATE dbo.SCENARIOS SET RequiredPeople=100;
    END TRY
    BEGIN CATCH
        IF ERROR_NUMBER()<>229 THROW;
        SET @Blocked=1;
    END CATCH;
    IF @Blocked=0 THROW 51990, 'The API role bypassed scenario save validation.',1;
    REVERT;
END TRY
BEGIN CATCH
    REVERT;
    THROW;
END CATCH;
GO
DROP USER SkilloraTestApp;
PRINT 'PASS API role reads views and saves through procedures but cannot write scenario tables directly';
GO
