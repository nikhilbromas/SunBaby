-- Template Config Table
-- Stores template configurations linking templates with presets, interfaces, departments, and shops
CREATE TABLE TemplateConfig (
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

-- Indexes for faster lookups
CREATE INDEX IX_TemplateConfig_TemplateId ON TemplateConfig(TemplateId);
CREATE INDEX IX_TemplateConfig_PresetId ON TemplateConfig(PresetId);
CREATE INDEX IX_TemplateConfig_InterfaceId ON TemplateConfig(InterfaceId);
CREATE INDEX IX_TemplateConfig_DepartmentId ON TemplateConfig(DepartmentId);
CREATE INDEX IX_TemplateConfig_ShopId ON TemplateConfig(ShopId);
CREATE INDEX IX_TemplateConfig_IsActive ON TemplateConfig(IsActive);
CREATE INDEX IX_TemplateConfig_Type ON TemplateConfig(Type);

