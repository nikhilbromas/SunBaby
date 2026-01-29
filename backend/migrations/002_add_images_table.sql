-- Dynamic Bill Preview System - Images Table Migration
-- MSSQL Server Migration Script
-- Adds ReportImages table for storing uploaded images

-- Images Table
-- Stores uploaded images with metadata and base64 data
CREATE TABLE ReportImages (
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

-- Index for faster lookups
CREATE INDEX IX_ReportImages_IsActive ON ReportImages(IsActive);
CREATE INDEX IX_ReportImages_CreatedOn ON ReportImages(CreatedOn);

