/* Optional catalog seed. Preserves the original 15 folder and 39 skill IDs.
   Adds protected Unsorted and department choices; inserts no employees or scenarios.
   Counts and averages are calculated by views, never seeded as invented facts.
   Safe to repeat when catalog IDs still match this seed. */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
IF @@TRANCOUNT <> 0 THROW 51000, 'Run seed without an open transaction.', 1;
DECLARE @Folders TABLE (ID INT, Name NVARCHAR(100));
INSERT @Folders VALUES
(1, N'Frontend'),
(2, N'Backend'),
(3, N'Design'),
(4, N'Management'),
(5, N'DevOps'),
(6, N'Mobile'),
(7, N'Data & Analytics'),
(8, N'AI & Machine Learning'),
(9, N'Cloud'),
(10, N'Quality Assurance'),
(11, N'Security'),
(12, N'Databases'),
(13, N'Business Analysis'),
(14, N'Digital Marketing'),
(15, N'Customer Success');
DECLARE @Skills TABLE (ID INT, FolderID INT, Name NVARCHAR(100));
INSERT @Skills VALUES
(16, 1, N'Accessibility'),
(17, 1, N'Angular'),
(18, 1, N'CSS'),
(19, 1, N'HTML'),
(20, 1, N'JavaScript'),
(21, 1, N'React'),
(22, 1, N'Redux Toolkit'),
(23, 1, N'Svelte'),
(24, 1, N'Tailwind CSS'),
(25, 1, N'TypeScript'),
(26, 1, N'UI Development'),
(27, 2, N'Python'),
(28, 2, N'FastAPI'),
(29, 3, N'Figma'),
(30, 3, N'UX Design'),
(31, 4, N'Project Management'),
(32, 4, N'Agile'),
(33, 5, N'Docker'),
(34, 5, N'CI/CD'),
(35, 6, N'Flutter'),
(36, 6, N'React Native'),
(37, 7, N'Data Analysis'),
(38, 7, N'Power BI'),
(39, 8, N'Machine Learning'),
(40, 8, N'Deep Learning'),
(41, 9, N'Microsoft Azure'),
(42, 9, N'AWS'),
(43, 10, N'Manual Testing'),
(44, 10, N'Test Automation'),
(45, 11, N'Network Security'),
(46, 11, N'Penetration Testing'),
(47, 12, N'Microsoft SQL Server'),
(48, 12, N'PostgreSQL'),
(49, 13, N'Requirements Analysis'),
(50, 13, N'Process Modeling'),
(51, 14, N'SEO'),
(52, 14, N'Content Marketing'),
(53, 15, N'Customer Onboarding'),
(54, 15, N'Account Management');
DECLARE @FolderIdentityOn BIT = 0, @SkillIdentityOn BIT = 0;
BEGIN TRY
    BEGIN TRANSACTION;
    IF EXISTS (SELECT 1 FROM @Folders x JOIN dbo.FOLDERS f ON f.FolderID = x.ID
               WHERE f.NameKey <> LOWER(x.Name) COLLATE Latin1_General_100_CI_AS_SC)
        OR EXISTS (SELECT 1 FROM @Skills x JOIN dbo.SKILLS s ON s.SkillID = x.ID
                   WHERE s.NameKey <> LOWER(x.Name) COLLATE Latin1_General_100_CI_AS_SC)
        THROW 51002, 'Seed IDs conflict with existing records. No data was replaced.', 1;

    SET IDENTITY_INSERT dbo.FOLDERS ON;
    SET @FolderIdentityOn = 1;
    INSERT dbo.FOLDERS (FolderID, FolderName)
    SELECT x.ID, x.Name FROM @Folders x WHERE NOT EXISTS (SELECT 1 FROM dbo.FOLDERS f WHERE f.FolderID = x.ID);
    SET IDENTITY_INSERT dbo.FOLDERS OFF;
    SET @FolderIdentityOn = 0;

    IF NOT EXISTS (SELECT 1 FROM dbo.FOLDERS WHERE IsDefault = 1)
    BEGIN
        IF EXISTS (SELECT 1 FROM dbo.FOLDERS WHERE NameKey = N'unsorted')
            UPDATE dbo.FOLDERS SET FolderName = N'Unsorted', IsDefault = 1, IsActive = 1 WHERE NameKey = N'unsorted';
        ELSE INSERT dbo.FOLDERS (FolderName, IsDefault) VALUES (N'Unsorted', 1);
    END;

    SET IDENTITY_INSERT dbo.SKILLS ON;
    SET @SkillIdentityOn = 1;
    INSERT dbo.SKILLS (SkillID, FolderID, SkillName)
    SELECT x.ID, x.FolderID, x.Name FROM @Skills x WHERE NOT EXISTS (SELECT 1 FROM dbo.SKILLS s WHERE s.SkillID = x.ID);
    SET IDENTITY_INSERT dbo.SKILLS OFF;
    SET @SkillIdentityOn = 0;

    INSERT dbo.DEPARTMENTS (DepartmentName)
    SELECT x.Name FROM (VALUES (N'Unassigned'), (N'Engineering'), (N'Design'),
        (N'Management'), (N'Data & AI'), (N'Operations'), (N'Quality Assurance'),
        (N'Security'), (N'Marketing'), (N'Customer Success')) x(Name)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.DEPARTMENTS d WHERE d.NameKey = LOWER(x.Name) COLLATE Latin1_General_100_CI_AS_SC);
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @FolderIdentityOn = 1 SET IDENTITY_INSERT dbo.FOLDERS OFF;
    IF @SkillIdentityOn = 1 SET IDENTITY_INSERT dbo.SKILLS OFF;
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
