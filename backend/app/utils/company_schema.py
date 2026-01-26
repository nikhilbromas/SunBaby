"""
Ensure required tables exist in the *company database*.

We keep this idempotent: safe to run repeatedly.
Matches backend/migrations/001_initial_schema.sql tables/indexes.
"""

from app.database import db


def ensure_company_schema() -> None:
    """
    Ensure company schema exists. Only runs on company databases, not auth DB.
    """
    # Check if we're on auth DB - if so, skip schema creation
    # Auth DB has different tables and shouldn't have company-specific tables
    if db._current_db_context == "auth":
        return
    # If objects exist but are missing columns (older schema), patch them.
    # We use COL_LENGTH checks to avoid failing on CREATE INDEX / FK.
    # Use autocommit=True for DDL operations to avoid transaction issues

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
        """,
        autocommit=True
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
        """,
        autocommit=True
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
        """,
        autocommit=True
    )
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportSqlPresets', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.ReportSqlPresets','IsActive') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReportSqlPresets_IsActive' AND object_id = OBJECT_ID('dbo.ReportSqlPresets'))
        BEGIN
            CREATE INDEX IX_ReportSqlPresets_IsActive ON dbo.ReportSqlPresets(IsActive);
        END
        """,
        autocommit=True
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
        """,
        autocommit=True
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
        """,
        autocommit=True
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
        """,
        autocommit=True
    )
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportTemplates', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.ReportTemplates','TemplateName') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReportTemplates_TemplateName' AND object_id = OBJECT_ID('dbo.ReportTemplates'))
        BEGIN
            CREATE INDEX IX_ReportTemplates_TemplateName ON dbo.ReportTemplates(TemplateName);
        END
        """,
        autocommit=True
    )
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportTemplates', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.ReportTemplates','IsActive') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReportTemplates_IsActive' AND object_id = OBJECT_ID('dbo.ReportTemplates'))
        BEGIN
            CREATE INDEX IX_ReportTemplates_IsActive ON dbo.ReportTemplates(IsActive);
        END
        """,
        autocommit=True
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
        """,
        autocommit=True
    )

    # Create ReportImages if missing
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportImages', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.ReportImages (
                ImageId INT IDENTITY(1,1) PRIMARY KEY,
                ImageName VARCHAR(255) NOT NULL,
                FilePath NVARCHAR(500) NOT NULL,
                Base64Data NVARCHAR(MAX) NOT NULL,
                FileSize INT NOT NULL,
                Width INT NOT NULL,
                Height INT NOT NULL,
                MimeType VARCHAR(50) NOT NULL,
                CreatedBy VARCHAR(50) NULL,
                CreatedOn DATETIME DEFAULT GETDATE(),
                IsActive BIT DEFAULT 1
            );
        END
        """,
        autocommit=True
    )

    # Patch missing columns in dbo.ReportImages (if table exists but schema differs)
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportImages', 'U') IS NOT NULL
        BEGIN
            IF COL_LENGTH('dbo.ReportImages','ImageId') IS NULL
                ALTER TABLE dbo.ReportImages ADD ImageId INT IDENTITY(1,1) NOT NULL;
            IF COL_LENGTH('dbo.ReportImages','ImageName') IS NULL
                ALTER TABLE dbo.ReportImages ADD ImageName VARCHAR(255) NULL;
            IF COL_LENGTH('dbo.ReportImages','FilePath') IS NULL
                ALTER TABLE dbo.ReportImages ADD FilePath NVARCHAR(500) NULL;
            IF COL_LENGTH('dbo.ReportImages','Base64Data') IS NULL
                ALTER TABLE dbo.ReportImages ADD Base64Data NVARCHAR(MAX) NULL;
            IF COL_LENGTH('dbo.ReportImages','FileSize') IS NULL
                ALTER TABLE dbo.ReportImages ADD FileSize INT NULL;
            IF COL_LENGTH('dbo.ReportImages','Width') IS NULL
                ALTER TABLE dbo.ReportImages ADD Width INT NULL;
            IF COL_LENGTH('dbo.ReportImages','Height') IS NULL
                ALTER TABLE dbo.ReportImages ADD Height INT NULL;
            IF COL_LENGTH('dbo.ReportImages','MimeType') IS NULL
                ALTER TABLE dbo.ReportImages ADD MimeType VARCHAR(50) NULL;
            IF COL_LENGTH('dbo.ReportImages','CreatedBy') IS NULL
                ALTER TABLE dbo.ReportImages ADD CreatedBy VARCHAR(50) NULL;
            IF COL_LENGTH('dbo.ReportImages','CreatedOn') IS NULL
                ALTER TABLE dbo.ReportImages ADD CreatedOn DATETIME NULL;
            IF COL_LENGTH('dbo.ReportImages','IsActive') IS NULL
                ALTER TABLE dbo.ReportImages ADD IsActive BIT NULL;
        END
        """,
        autocommit=True
    )

    # Create indexes if missing
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportImages', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.ReportImages','IsActive') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReportImages_IsActive' AND object_id = OBJECT_ID('dbo.ReportImages'))
        BEGIN
            CREATE INDEX IX_ReportImages_IsActive ON dbo.ReportImages(IsActive);
        END
        """,
        autocommit=True
    )
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportImages', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.ReportImages','CreatedOn') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReportImages_CreatedOn' AND object_id = OBJECT_ID('dbo.ReportImages'))
        BEGIN
            CREATE INDEX IX_ReportImages_CreatedOn ON dbo.ReportImages(CreatedOn);
        END
        """,
        autocommit=True
    )

    # Create TemplateConfig if missing
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.TemplateConfig', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.TemplateConfig (
                ConfigId INT IDENTITY(1,1) PRIMARY KEY,
                TemplateId INT NOT NULL,
                PresetId INT NOT NULL,
                InterfaceId INT NOT NULL,
                DepartmentId INT NULL,
                ShopId INT NULL,
                Type NVARCHAR(100) NOT NULL,
                Description NVARCHAR(500) NULL,
                CreatedBy VARCHAR(50) NULL,
                CreatedOn DATETIME DEFAULT GETDATE(),
                UpdatedOn DATETIME NULL,
                IsActive BIT DEFAULT 1
            );
        END
        """,
        autocommit=True
    )

    # Patch missing columns in dbo.TemplateConfig (if table exists but schema differs)
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.TemplateConfig', 'U') IS NOT NULL
        BEGIN
            IF COL_LENGTH('dbo.TemplateConfig','ConfigId') IS NULL
                ALTER TABLE dbo.TemplateConfig ADD ConfigId INT IDENTITY(1,1) NOT NULL;
            IF COL_LENGTH('dbo.TemplateConfig','TemplateId') IS NULL
                ALTER TABLE dbo.TemplateConfig ADD TemplateId INT NULL;
            IF COL_LENGTH('dbo.TemplateConfig','PresetId') IS NULL
                ALTER TABLE dbo.TemplateConfig ADD PresetId INT NULL;
            IF COL_LENGTH('dbo.TemplateConfig','InterfaceId') IS NULL
                ALTER TABLE dbo.TemplateConfig ADD InterfaceId INT NULL;
            IF COL_LENGTH('dbo.TemplateConfig','DepartmentId') IS NULL
                ALTER TABLE dbo.TemplateConfig ADD DepartmentId INT NULL;
            IF COL_LENGTH('dbo.TemplateConfig','ShopId') IS NULL
                ALTER TABLE dbo.TemplateConfig ADD ShopId INT NULL;
            IF COL_LENGTH('dbo.TemplateConfig','Type') IS NULL
                ALTER TABLE dbo.TemplateConfig ADD Type NVARCHAR(100) NULL;
            IF COL_LENGTH('dbo.TemplateConfig','Description') IS NULL
                ALTER TABLE dbo.TemplateConfig ADD Description NVARCHAR(500) NULL;
            IF COL_LENGTH('dbo.TemplateConfig','CreatedBy') IS NULL
                ALTER TABLE dbo.TemplateConfig ADD CreatedBy VARCHAR(50) NULL;
            IF COL_LENGTH('dbo.TemplateConfig','CreatedOn') IS NULL
                ALTER TABLE dbo.TemplateConfig ADD CreatedOn DATETIME NULL;
            IF COL_LENGTH('dbo.TemplateConfig','UpdatedOn') IS NULL
                ALTER TABLE dbo.TemplateConfig ADD UpdatedOn DATETIME NULL;
            IF COL_LENGTH('dbo.TemplateConfig','IsActive') IS NULL
                ALTER TABLE dbo.TemplateConfig ADD IsActive BIT NULL;
        END
        """,
        autocommit=True
    )

    # Create indexes if missing
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.TemplateConfig', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.TemplateConfig','TemplateId') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TemplateConfig_TemplateId' AND object_id = OBJECT_ID('dbo.TemplateConfig'))
        BEGIN
            CREATE INDEX IX_TemplateConfig_TemplateId ON dbo.TemplateConfig(TemplateId);
        END
        """,
        autocommit=True
    )
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.TemplateConfig', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.TemplateConfig','PresetId') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TemplateConfig_PresetId' AND object_id = OBJECT_ID('dbo.TemplateConfig'))
        BEGIN
            CREATE INDEX IX_TemplateConfig_PresetId ON dbo.TemplateConfig(PresetId);
        END
        """,
        autocommit=True
    )
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.TemplateConfig', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.TemplateConfig','InterfaceId') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TemplateConfig_InterfaceId' AND object_id = OBJECT_ID('dbo.TemplateConfig'))
        BEGIN
            CREATE INDEX IX_TemplateConfig_InterfaceId ON dbo.TemplateConfig(InterfaceId);
        END
        """,
        autocommit=True
    )
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.TemplateConfig', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.TemplateConfig','DepartmentId') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TemplateConfig_DepartmentId' AND object_id = OBJECT_ID('dbo.TemplateConfig'))
        BEGIN
            CREATE INDEX IX_TemplateConfig_DepartmentId ON dbo.TemplateConfig(DepartmentId);
        END
        """,
        autocommit=True
    )
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.TemplateConfig', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.TemplateConfig','ShopId') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TemplateConfig_ShopId' AND object_id = OBJECT_ID('dbo.TemplateConfig'))
        BEGIN
            CREATE INDEX IX_TemplateConfig_ShopId ON dbo.TemplateConfig(ShopId);
        END
        """,
        autocommit=True
    )
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.TemplateConfig', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.TemplateConfig','IsActive') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TemplateConfig_IsActive' AND object_id = OBJECT_ID('dbo.TemplateConfig'))
        BEGIN
            CREATE INDEX IX_TemplateConfig_IsActive ON dbo.TemplateConfig(IsActive);
        END
        """,
        autocommit=True
    )
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.TemplateConfig', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.TemplateConfig','Type') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TemplateConfig_Type' AND object_id = OBJECT_ID('dbo.TemplateConfig'))
        BEGIN
            CREATE INDEX IX_TemplateConfig_Type ON dbo.TemplateConfig(Type);
        END
        """,
        autocommit=True
    )

    # Create ReportTemplateParameters if missing
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportTemplateParameters', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.ReportTemplateParameters (
                ParameterId INT IDENTITY(1,1) PRIMARY KEY,
                TemplateId INT NOT NULL,
                ParameterName VARCHAR(100) NOT NULL,
                ParameterValue NVARCHAR(MAX) NULL,
                CreatedBy VARCHAR(50) NULL,
                CreatedOn DATETIME DEFAULT GETDATE(),
                UpdatedOn DATETIME NULL,
                IsActive BIT DEFAULT 1
            );
        END
        """,
        autocommit=True
    )

    # Patch missing columns in dbo.ReportTemplateParameters (if table exists but schema differs)
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportTemplateParameters', 'U') IS NOT NULL
        BEGIN
            IF COL_LENGTH('dbo.ReportTemplateParameters','ParameterId') IS NULL
                ALTER TABLE dbo.ReportTemplateParameters ADD ParameterId INT IDENTITY(1,1) NOT NULL;
            IF COL_LENGTH('dbo.ReportTemplateParameters','TemplateId') IS NULL
                ALTER TABLE dbo.ReportTemplateParameters ADD TemplateId INT NULL;
            IF COL_LENGTH('dbo.ReportTemplateParameters','ParameterName') IS NULL
                ALTER TABLE dbo.ReportTemplateParameters ADD ParameterName VARCHAR(100) NULL;
            IF COL_LENGTH('dbo.ReportTemplateParameters','ParameterValue') IS NULL
                ALTER TABLE dbo.ReportTemplateParameters ADD ParameterValue NVARCHAR(MAX) NULL;
            IF COL_LENGTH('dbo.ReportTemplateParameters','CreatedBy') IS NULL
                ALTER TABLE dbo.ReportTemplateParameters ADD CreatedBy VARCHAR(50) NULL;
            IF COL_LENGTH('dbo.ReportTemplateParameters','CreatedOn') IS NULL
                ALTER TABLE dbo.ReportTemplateParameters ADD CreatedOn DATETIME NULL;
            IF COL_LENGTH('dbo.ReportTemplateParameters','UpdatedOn') IS NULL
                ALTER TABLE dbo.ReportTemplateParameters ADD UpdatedOn DATETIME NULL;
            IF COL_LENGTH('dbo.ReportTemplateParameters','IsActive') IS NULL
                ALTER TABLE dbo.ReportTemplateParameters ADD IsActive BIT NULL;
        END
        """,
        autocommit=True
    )

    # Create indexes if missing
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportTemplateParameters', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.ReportTemplateParameters','TemplateId') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReportTemplateParameters_TemplateId' AND object_id = OBJECT_ID('dbo.ReportTemplateParameters'))
        BEGIN
            CREATE INDEX IX_ReportTemplateParameters_TemplateId ON dbo.ReportTemplateParameters(TemplateId);
        END
        """,
        autocommit=True
    )
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportTemplateParameters', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.ReportTemplateParameters','ParameterName') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReportTemplateParameters_ParameterName' AND object_id = OBJECT_ID('dbo.ReportTemplateParameters'))
        BEGIN
            CREATE INDEX IX_ReportTemplateParameters_ParameterName ON dbo.ReportTemplateParameters(ParameterName);
        END
        """,
        autocommit=True
    )
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportTemplateParameters', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.ReportTemplateParameters','IsActive') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReportTemplateParameters_IsActive' AND object_id = OBJECT_ID('dbo.ReportTemplateParameters'))
        BEGIN
            CREATE INDEX IX_ReportTemplateParameters_IsActive ON dbo.ReportTemplateParameters(IsActive);
        END
        """,
        autocommit=True
    )

    # Create unique index for TemplateId + ParameterName (filtered index for IsActive = 1)
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportTemplateParameters', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.ReportTemplateParameters','TemplateId') IS NOT NULL
           AND COL_LENGTH('dbo.ReportTemplateParameters','ParameterName') IS NOT NULL
           AND COL_LENGTH('dbo.ReportTemplateParameters','IsActive') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReportTemplateParameters_TemplateId_ParameterName_Unique' AND object_id = OBJECT_ID('dbo.ReportTemplateParameters'))
        BEGIN
            CREATE UNIQUE NONCLUSTERED INDEX IX_ReportTemplateParameters_TemplateId_ParameterName_Unique
            ON dbo.ReportTemplateParameters(TemplateId, ParameterName)
            WHERE IsActive = 1;
        END
        """,
        autocommit=True
    )

    # Add FK if possible and missing (optional if existing data prevents it)
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportTemplateParameters', 'U') IS NOT NULL
           AND OBJECT_ID('dbo.ReportTemplates', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.ReportTemplateParameters','TemplateId') IS NOT NULL
           AND COL_LENGTH('dbo.ReportTemplates','TemplateId') IS NOT NULL
           AND NOT EXISTS (
               SELECT 1
               FROM sys.foreign_keys
               WHERE name = 'FK_ReportTemplateParameters_ReportTemplates'
                 AND parent_object_id = OBJECT_ID('dbo.ReportTemplateParameters')
           )
        BEGIN
            BEGIN TRY
                ALTER TABLE dbo.ReportTemplateParameters
                ADD CONSTRAINT FK_ReportTemplateParameters_ReportTemplates
                FOREIGN KEY (TemplateId) REFERENCES dbo.ReportTemplates(TemplateId) ON DELETE CASCADE;
            END TRY
            BEGIN CATCH
                -- If existing data violates FK or permissions are limited, skip FK creation.
            END CATCH
        END
        """,
        autocommit=True
    )

    # Final safety check: ensure ReportTemplateParameters table exists
    # This handles edge cases where table creation might have failed earlier
    db.execute_non_query(
        """
        IF OBJECT_ID('dbo.ReportTemplateParameters', 'U') IS NULL
           AND OBJECT_ID('dbo.ReportTemplates', 'U') IS NOT NULL
        BEGIN
            BEGIN TRY
                CREATE TABLE dbo.ReportTemplateParameters (
                    ParameterId INT IDENTITY(1,1) PRIMARY KEY,
                    TemplateId INT NOT NULL,
                    ParameterName VARCHAR(100) NOT NULL,
                    ParameterValue NVARCHAR(MAX) NULL,
                    CreatedBy VARCHAR(50) NULL,
                    CreatedOn DATETIME DEFAULT GETDATE(),
                    UpdatedOn DATETIME NULL,
                    IsActive BIT DEFAULT 1
                );
            END TRY
            BEGIN CATCH
                -- Table might already exist or creation failed, ignore
            END CATCH
        END
        """,
        autocommit=True
    )


