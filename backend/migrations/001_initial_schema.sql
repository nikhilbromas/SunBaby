-- Dynamic Bill Preview System - Initial Database Schema
-- MSSQL Server Migration Script

-- SQL Presets Table
-- Stores predefined SQL queries with their expected parameters
CREATE TABLE ReportSqlPresets (
    PresetId INT IDENTITY(1,1) PRIMARY KEY,
    PresetName VARCHAR(100) NOT NULL,
    SqlJson NVARCHAR(MAX) NOT NULL,
    ExpectedParams NVARCHAR(500) NULL,
    CreatedBy VARCHAR(50) NULL,
    CreatedOn DATETIME DEFAULT GETDATE(),
    UpdatedOn DATETIME NULL,
    IsActive BIT DEFAULT 1
);

-- Index for faster lookups
CREATE INDEX IX_ReportSqlPresets_PresetName ON ReportSqlPresets(PresetName);
CREATE INDEX IX_ReportSqlPresets_IsActive ON ReportSqlPresets(IsActive);

-- Templates Table
-- Stores visual template designs linked to SQL presets
CREATE TABLE ReportTemplates (
    TemplateId INT IDENTITY(1,1) PRIMARY KEY,
    PresetId INT NOT NULL,
    TemplateName VARCHAR(100) NOT NULL,
    TemplateJson NVARCHAR(MAX) NOT NULL,
    CreatedBy VARCHAR(50) NULL,
    CreatedOn DATETIME DEFAULT GETDATE(),
    UpdatedOn DATETIME NULL,
    IsActive BIT DEFAULT 1,
    FOREIGN KEY (PresetId) REFERENCES ReportSqlPresets(PresetId) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IX_ReportTemplates_PresetId ON ReportTemplates(PresetId);
CREATE INDEX IX_ReportTemplates_TemplateName ON ReportTemplates(TemplateName);
CREATE INDEX IX_ReportTemplates_IsActive ON ReportTemplates(IsActive);

-- Example data (optional - for testing)
-- INSERT INTO ReportSqlPresets (PresetName, SqlJson, ExpectedParams, CreatedBy)
-- VALUES (
--     'Bill Preview',
--     '{"headerQuery": "SELECT * FROM BillHeader WHERE BillId = @BillId", "itemQuery": "SELECT * FROM BillItem WHERE BillId = @BillId"}',
--     'BillId',
--     'System'
-- );

