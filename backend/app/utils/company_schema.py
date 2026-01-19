"""
Ensure required tables exist in the *company database*.

We keep this idempotent: safe to run repeatedly.
Matches backend/migrations/001_initial_schema.sql tables/indexes.
"""

from app.database import db


def ensure_company_schema() -> None:
    # If objects exist but are missing columns (older schema), patch them.
    # We use COL_LENGTH checks to avoid failing on CREATE INDEX / FK.

    # Create ReportSqlPresets if missing
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportSqlPresets', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.ReportSqlPresets (
                PresetId INT IDENTITY(1,1) PRIMARY KEY,
                PresetName VARCHAR(100) NOT NULL,
                SqlJson NVARCHAR(MAX) NOT NULL,
                ExpectedParams NVARCHAR(500) NULL,
                CreatedBy VARCHAR(50) NULL,
                CreatedOn DATETIME DEFAULT GETDATE(),
                UpdatedOn DATETIME NULL,
                IsActive BIT DEFAULT 1
            );
        END
        """
    )

    # Patch missing columns in dbo.ReportSqlPresets (if table exists but schema differs)
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportSqlPresets', 'U') IS NOT NULL
        BEGIN
            IF COL_LENGTH('dbo.ReportSqlPresets','PresetId') IS NULL
                ALTER TABLE dbo.ReportSqlPresets ADD PresetId INT IDENTITY(1,1) NOT NULL;
            IF COL_LENGTH('dbo.ReportSqlPresets','PresetName') IS NULL
                ALTER TABLE dbo.ReportSqlPresets ADD PresetName VARCHAR(100) NULL;
            IF COL_LENGTH('dbo.ReportSqlPresets','SqlJson') IS NULL
                ALTER TABLE dbo.ReportSqlPresets ADD SqlJson NVARCHAR(MAX) NULL;
            IF COL_LENGTH('dbo.ReportSqlPresets','ExpectedParams') IS NULL
                ALTER TABLE dbo.ReportSqlPresets ADD ExpectedParams NVARCHAR(500) NULL;
            IF COL_LENGTH('dbo.ReportSqlPresets','CreatedBy') IS NULL
                ALTER TABLE dbo.ReportSqlPresets ADD CreatedBy VARCHAR(50) NULL;
            IF COL_LENGTH('dbo.ReportSqlPresets','CreatedOn') IS NULL
                ALTER TABLE dbo.ReportSqlPresets ADD CreatedOn DATETIME NULL;
            IF COL_LENGTH('dbo.ReportSqlPresets','UpdatedOn') IS NULL
                ALTER TABLE dbo.ReportSqlPresets ADD UpdatedOn DATETIME NULL;
            IF COL_LENGTH('dbo.ReportSqlPresets','IsActive') IS NULL
                ALTER TABLE dbo.ReportSqlPresets ADD IsActive BIT NULL;
        END
        """
    )

    # Create indexes if missing
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportSqlPresets', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.ReportSqlPresets','PresetName') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReportSqlPresets_PresetName' AND object_id = OBJECT_ID('dbo.ReportSqlPresets'))
        BEGIN
            CREATE INDEX IX_ReportSqlPresets_PresetName ON dbo.ReportSqlPresets(PresetName);
        END
        """
    )
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportSqlPresets', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.ReportSqlPresets','IsActive') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReportSqlPresets_IsActive' AND object_id = OBJECT_ID('dbo.ReportSqlPresets'))
        BEGIN
            CREATE INDEX IX_ReportSqlPresets_IsActive ON dbo.ReportSqlPresets(IsActive);
        END
        """
    )

    # Create ReportTemplates if missing
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportTemplates', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.ReportTemplates (
                TemplateId INT IDENTITY(1,1) PRIMARY KEY,
                PresetId INT NOT NULL,
                TemplateName VARCHAR(100) NOT NULL,
                TemplateJson NVARCHAR(MAX) NOT NULL,
                CreatedBy VARCHAR(50) NULL,
                CreatedOn DATETIME DEFAULT GETDATE(),
                UpdatedOn DATETIME NULL,
                IsActive BIT DEFAULT 1,
                FOREIGN KEY (PresetId) REFERENCES dbo.ReportSqlPresets(PresetId) ON DELETE CASCADE
            );
        END
        """
    )

    # Patch missing columns in dbo.ReportTemplates (if table exists but schema differs)
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportTemplates', 'U') IS NOT NULL
        BEGIN
            IF COL_LENGTH('dbo.ReportTemplates','TemplateId') IS NULL
                ALTER TABLE dbo.ReportTemplates ADD TemplateId INT IDENTITY(1,1) NOT NULL;
            IF COL_LENGTH('dbo.ReportTemplates','PresetId') IS NULL
                ALTER TABLE dbo.ReportTemplates ADD PresetId INT NULL;
            IF COL_LENGTH('dbo.ReportTemplates','TemplateName') IS NULL
                ALTER TABLE dbo.ReportTemplates ADD TemplateName VARCHAR(100) NULL;
            IF COL_LENGTH('dbo.ReportTemplates','TemplateJson') IS NULL
                ALTER TABLE dbo.ReportTemplates ADD TemplateJson NVARCHAR(MAX) NULL;
            IF COL_LENGTH('dbo.ReportTemplates','CreatedBy') IS NULL
                ALTER TABLE dbo.ReportTemplates ADD CreatedBy VARCHAR(50) NULL;
            IF COL_LENGTH('dbo.ReportTemplates','CreatedOn') IS NULL
                ALTER TABLE dbo.ReportTemplates ADD CreatedOn DATETIME NULL;
            IF COL_LENGTH('dbo.ReportTemplates','UpdatedOn') IS NULL
                ALTER TABLE dbo.ReportTemplates ADD UpdatedOn DATETIME NULL;
            IF COL_LENGTH('dbo.ReportTemplates','IsActive') IS NULL
                ALTER TABLE dbo.ReportTemplates ADD IsActive BIT NULL;
        END
        """
    )

    # Create indexes if missing
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportTemplates', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.ReportTemplates','PresetId') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReportTemplates_PresetId' AND object_id = OBJECT_ID('dbo.ReportTemplates'))
        BEGIN
            CREATE INDEX IX_ReportTemplates_PresetId ON dbo.ReportTemplates(PresetId);
        END
        """
    )
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportTemplates', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.ReportTemplates','TemplateName') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReportTemplates_TemplateName' AND object_id = OBJECT_ID('dbo.ReportTemplates'))
        BEGIN
            CREATE INDEX IX_ReportTemplates_TemplateName ON dbo.ReportTemplates(TemplateName);
        END
        """
    )
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportTemplates', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.ReportTemplates','IsActive') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReportTemplates_IsActive' AND object_id = OBJECT_ID('dbo.ReportTemplates'))
        BEGIN
            CREATE INDEX IX_ReportTemplates_IsActive ON dbo.ReportTemplates(IsActive);
        END
        """
    )

    # Add FK if possible and missing (optional if existing data prevents it)
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportTemplates', 'U') IS NOT NULL
           AND OBJECT_ID('dbo.ReportSqlPresets', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.ReportTemplates','PresetId') IS NOT NULL
           AND COL_LENGTH('dbo.ReportSqlPresets','PresetId') IS NOT NULL
           AND NOT EXISTS (
               SELECT 1
               FROM sys.foreign_keys
               WHERE name = 'FK_ReportTemplates_ReportSqlPresets'
                 AND parent_object_id = OBJECT_ID('dbo.ReportTemplates')
           )
        BEGIN
            BEGIN TRY
                ALTER TABLE dbo.ReportTemplates
                ADD CONSTRAINT FK_ReportTemplates_ReportSqlPresets
                FOREIGN KEY (PresetId) REFERENCES dbo.ReportSqlPresets(PresetId) ON DELETE CASCADE;
            END TRY
            BEGIN CATCH
                -- If existing data violates FK or permissions are limited, skip FK creation.
            END CATCH
        END
        """
    )


