import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { TemplateJson, ZoneConfig } from '../../services/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import './ZoneConfigModal.css';

interface ZoneConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: TemplateJson;
  onSave: (zoneConfigs: Record<string, ZoneConfig>) => void;
}

type ZoneType = 'pageHeader' | 'pageFooter' | 'billHeader' | 'billContent' | 'billFooter';

interface ZoneInfo {
  type: ZoneType;
  label: string;
  color: string;
  defaultHeight: number;
  defaultY: number;
}

const ZONE_INFO: Record<ZoneType, ZoneInfo> = {
  pageHeader: { type: 'pageHeader', label: 'Page Header', color: '#4A90E2', defaultHeight: 60, defaultY: 0 },
  billHeader: { type: 'billHeader', label: 'Bill Header', color: '#50C878', defaultHeight: 200, defaultY: 70 },
  billContent: { type: 'billContent', label: 'Bill Content', color: '#FFB347', defaultHeight: 100, defaultY: 280 },
  billFooter: { type: 'billFooter', label: 'Bill Footer', color: '#FF6B6B', defaultHeight: 100, defaultY: 390 },
  pageFooter: { type: 'pageFooter', label: 'Page Footer', color: '#9B59B6', defaultHeight: 60, defaultY: 500 },
};

const ZoneConfigModal: React.FC<ZoneConfigModalProps> = ({ isOpen, onClose, template, onSave }) => {
  const [zoneConfigs, setZoneConfigs] = useState<Record<string, ZoneConfig>>({});
  const [selectedZone, setSelectedZone] = useState<ZoneType | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<{ zone: ZoneType; handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' } | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Initialize zone configs from template or defaults
  useEffect(() => {
    if (isOpen) {
      const configs: Record<string, ZoneConfig> = {};
      const pageWidth = template.page.orientation === 'landscape' ? 1123 : 794;
      const pageHeight = template.page.orientation === 'landscape' ? 794 : 1123;

      // Convert sectionHeights to zoneConfigs if zoneConfigs don't exist
      if (template.zoneConfigs) {
        Object.assign(configs, template.zoneConfigs);
      } else if (template.sectionHeights) {
        // Convert sectionHeights to zoneConfigs format
        let currentY = 40; // Starting Y position
        const spacing = 10;

        if (template.sectionHeights.pageHeader) {
          configs.pageHeader = {
            x: 0,
            y: currentY,
            width: pageWidth,
            height: template.sectionHeights.pageHeader,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            padding: 10,
            align: 'left',
            verticalAlign: 'top',
          };
          currentY += template.sectionHeights.pageHeader + spacing;
        }

        if (template.sectionHeights.billHeader) {
          configs.billHeader = {
            x: 0,
            y: currentY,
            width: pageWidth,
            height: template.sectionHeights.billHeader,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            padding: 10,
            align: 'left',
            verticalAlign: 'top',
          };
          currentY += template.sectionHeights.billHeader + spacing;
        }

        if (template.sectionHeights.billContent) {
          configs.billContent = {
            x: 0,
            y: currentY,
            width: pageWidth,
            height: template.sectionHeights.billContent,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            padding: 10,
            align: 'left',
            verticalAlign: 'top',
          };
          currentY += template.sectionHeights.billContent + spacing;
        }

        if (template.sectionHeights.billFooter) {
          configs.billFooter = {
            x: 0,
            y: currentY,
            width: pageWidth,
            height: template.sectionHeights.billFooter,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            padding: 10,
            align: 'left',
            verticalAlign: 'top',
          };
          currentY += template.sectionHeights.billFooter + spacing;
        }

        if (template.sectionHeights.pageFooter) {
          configs.pageFooter = {
            x: 0,
            y: pageHeight - template.sectionHeights.pageFooter - 40,
            width: pageWidth,
            height: template.sectionHeights.pageFooter,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            padding: 10,
            align: 'left',
            verticalAlign: 'bottom',
          };
        }
      } else {
        // Use defaults
        let currentY = 40;
        const spacing = 10;

        Object.values(ZONE_INFO).forEach((zoneInfo) => {
          if (zoneInfo.type === 'pageFooter') {
            configs[zoneInfo.type] = {
              x: 0,
              y: pageHeight - zoneInfo.defaultHeight - 40,
              width: pageWidth,
              height: zoneInfo.defaultHeight,
              marginTop: 0,
              marginBottom: 0,
              marginLeft: 0,
              marginRight: 0,
              padding: 10,
              align: 'left',
              verticalAlign: 'bottom',
            };
          } else {
            configs[zoneInfo.type] = {
              x: 0,
              y: currentY,
              width: pageWidth,
              height: zoneInfo.defaultHeight,
              marginTop: 0,
              marginBottom: 0,
              marginLeft: 0,
              marginRight: 0,
              padding: 10,
              align: 'left',
              verticalAlign: 'top',
            };
            currentY += zoneInfo.defaultHeight + spacing;
          }
        });
      }

      setZoneConfigs(configs);
      setSelectedZone(null);
    }
  }, [isOpen, template]);

  const getZoneConfig = (zoneType: ZoneType): ZoneConfig => {
    return zoneConfigs[zoneType] || {
      x: 0,
      y: 0,
      width: template.page.orientation === 'landscape' ? 1123 : 794,
      height: ZONE_INFO[zoneType].defaultHeight,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      padding: 10,
      align: 'left',
      verticalAlign: 'top',
    };
  };

  const updateZoneConfig = (zoneType: ZoneType, updates: Partial<ZoneConfig>) => {
    setZoneConfigs((prev) => ({
      ...prev,
      [zoneType]: { ...getZoneConfig(zoneType), ...updates },
    }));
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, zoneType: ZoneType) => {
    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
      return; // Don't start drag if clicking resize handle
    }
    e.preventDefault();
    e.stopPropagation();
    setSelectedZone(zoneType);
    setIsDragging(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const config = getZoneConfig(zoneType);
      setDragStart({
        x: e.clientX - rect.left - (config.x || 0),
        y: e.clientY - rect.top - (config.y || 0),
      });
    }
  }, [zoneConfigs, template.page.orientation]);

  const handleResizeStart = useCallback((e: React.MouseEvent, zoneType: ZoneType, handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing({ zone: zoneType, handle });
    const config = getZoneConfig(zoneType);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setResizeStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        width: config.width || 0,
        height: config.height || 0,
      });
    }
  }, [zoneConfigs, template.page.orientation]);

  useEffect(() => {
    if (isDragging && selectedZone) {
      const handleMouseMove = (e: MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect && selectedZone) {
          const newX = e.clientX - rect.left - dragStart.x;
          const newY = e.clientY - rect.top - dragStart.y;
          const pageWidth = template.page.orientation === 'landscape' ? 1123 : 794;
          const pageHeight = template.page.orientation === 'landscape' ? 794 : 1123;
          const config = getZoneConfig(selectedZone);
          const width = config.width || pageWidth;
          const height = config.height || 60;

          updateZoneConfig(selectedZone, {
            x: Math.max(0, Math.min(newX, pageWidth - width)),
            y: Math.max(0, Math.min(newY, pageHeight - height)),
          });
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, selectedZone, dragStart, template.page.orientation]);

  useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e: MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect && isResizing) {
          const deltaX = e.clientX - rect.left - resizeStart.x;
          const deltaY = e.clientY - rect.top - resizeStart.y;
          const config = getZoneConfig(isResizing.zone);
          const pageWidth = template.page.orientation === 'landscape' ? 1123 : 794;
          const pageHeight = template.page.orientation === 'landscape' ? 794 : 1123;

          let newX = config.x || 0;
          let newY = config.y || 0;
          let newWidth = resizeStart.width;
          let newHeight = resizeStart.height;

          // Handle resize based on handle
          if (isResizing.handle.includes('e')) {
            newWidth = Math.max(50, Math.min(resizeStart.width + deltaX, pageWidth - (config.x || 0)));
          }
          if (isResizing.handle.includes('w')) {
            const widthChange = -deltaX;
            newWidth = Math.max(50, Math.min(resizeStart.width + widthChange, (config.x || 0) + resizeStart.width));
            newX = Math.max(0, (config.x || 0) + deltaX);
          }
          if (isResizing.handle.includes('s')) {
            newHeight = Math.max(40, Math.min(resizeStart.height + deltaY, pageHeight - (config.y || 0)));
          }
          if (isResizing.handle.includes('n')) {
            const heightChange = -deltaY;
            newHeight = Math.max(40, Math.min(resizeStart.height + heightChange, (config.y || 0) + resizeStart.height));
            newY = Math.max(0, (config.y || 0) + deltaY);
          }

          updateZoneConfig(isResizing.zone, {
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
          });
        }
      };

      const handleMouseUp = () => {
        setIsResizing(null);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, resizeStart, template.page.orientation]);

  const handleSave = () => {
    onSave(zoneConfigs);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  const pageWidth = template.page.orientation === 'landscape' ? 1123 : 794;
  const pageHeight = template.page.orientation === 'landscape' ? 794 : 1123;
  const scale = 0.5; // Scale for preview
  const previewWidth = pageWidth * scale;
  const previewHeight = pageHeight * scale;

  const selectedConfig = selectedZone ? getZoneConfig(selectedZone) : null;

  return (
    <>
      <div className="zone-config-modal-backdrop" onClick={handleCancel} />
      <div className="zone-config-modal">
        <div className="zone-config-modal-header">
          <h2>Configure Zones</h2>
          <button className="zone-config-modal-close" onClick={handleCancel}>×</button>
        </div>

        <div className="zone-config-modal-content">
          <div className="zone-config-preview-container">
            <div className="zone-config-preview-header">
              <h3>Page Preview ({template.page.size} - {template.page.orientation})</h3>
            </div>
            <div
              ref={canvasRef}
              className="zone-config-canvas"
              style={{
                width: `${previewWidth}px`,
                height: `${previewHeight}px`,
                position: 'relative',
              }}
            >
              {Object.values(ZONE_INFO).map((zoneInfo) => {
                const config = getZoneConfig(zoneInfo.type);
                const isSelected = selectedZone === zoneInfo.type;
                return (
                  <div
                    key={zoneInfo.type}
                    className={`zone-preview ${isSelected ? 'selected' : ''}`}
                    style={{
                      position: 'absolute',
                      left: `${(config.x || 0) * scale}px`,
                      top: `${(config.y || 0) * scale}px`,
                      width: `${(config.width || pageWidth) * scale}px`,
                      height: `${(config.height || 60) * scale}px`,
                      backgroundColor: zoneInfo.color,
                      opacity: 0.6,
                      border: `2px solid ${isSelected ? '#0B63FF' : zoneInfo.color}`,
                      cursor: isDragging ? 'grabbing' : 'grab',
                      zIndex: isSelected ? 10 : 1,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, zoneInfo.type)}
                  >
                    <div className="zone-label">{zoneInfo.label}</div>
                    {isSelected && (
                      <>
                        <div className="resize-handle resize-handle-n" onMouseDown={(e) => handleResizeStart(e, zoneInfo.type, 'n')} />
                        <div className="resize-handle resize-handle-s" onMouseDown={(e) => handleResizeStart(e, zoneInfo.type, 's')} />
                        <div className="resize-handle resize-handle-e" onMouseDown={(e) => handleResizeStart(e, zoneInfo.type, 'e')} />
                        <div className="resize-handle resize-handle-w" onMouseDown={(e) => handleResizeStart(e, zoneInfo.type, 'w')} />
                        <div className="resize-handle resize-handle-ne" onMouseDown={(e) => handleResizeStart(e, zoneInfo.type, 'ne')} />
                        <div className="resize-handle resize-handle-nw" onMouseDown={(e) => handleResizeStart(e, zoneInfo.type, 'nw')} />
                        <div className="resize-handle resize-handle-se" onMouseDown={(e) => handleResizeStart(e, zoneInfo.type, 'se')} />
                        <div className="resize-handle resize-handle-sw" onMouseDown={(e) => handleResizeStart(e, zoneInfo.type, 'sw')} />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="zone-config-properties">
            <h3>Zone Properties</h3>
            {selectedZone && selectedConfig ? (
              <div className="zone-properties-form">
                <div className="form-group">
                  <label>Zone: <strong>{ZONE_INFO[selectedZone].label}</strong></label>
                </div>

                <div className="form-section">
                  <h4>Position</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>X Position (px)</label>
                      <input
                        type="number"
                        value={selectedConfig.x || 0}
                        onChange={(e) => updateZoneConfig(selectedZone, { x: parseFloat(e.target.value) || 0 })}
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label>Y Position (px)</label>
                      <input
                        type="number"
                        value={selectedConfig.y || 0}
                        onChange={(e) => updateZoneConfig(selectedZone, { y: parseFloat(e.target.value) || 0 })}
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4>Size</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Width (px)</label>
                      <input
                        type="number"
                        value={selectedConfig.width || pageWidth}
                        onChange={(e) => updateZoneConfig(selectedZone, { width: parseFloat(e.target.value) || pageWidth })}
                        min="50"
                        max={pageWidth}
                      />
                    </div>
                    <div className="form-group">
                      <label>Height (px)</label>
                      <input
                        type="number"
                        value={selectedConfig.height || 60}
                        onChange={(e) => updateZoneConfig(selectedZone, { height: parseFloat(e.target.value) || 60 })}
                        min="40"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4>Alignment</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Horizontal Align</label>
                      <select
                        value={selectedConfig.align || 'left'}
                        onChange={(e) => updateZoneConfig(selectedZone, { align: e.target.value as 'left' | 'center' | 'right' })}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Vertical Align</label>
                      <select
                        value={selectedConfig.verticalAlign || 'top'}
                        onChange={(e) => updateZoneConfig(selectedZone, { verticalAlign: e.target.value as 'top' | 'middle' | 'bottom' })}
                      >
                        <option value="top">Top</option>
                        <option value="middle">Middle</option>
                        <option value="bottom">Bottom</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4>Margins</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Top (px)</label>
                      <input
                        type="number"
                        value={selectedConfig.marginTop || 0}
                        onChange={(e) => updateZoneConfig(selectedZone, { marginTop: parseFloat(e.target.value) || 0 })}
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label>Bottom (px)</label>
                      <input
                        type="number"
                        value={selectedConfig.marginBottom || 0}
                        onChange={(e) => updateZoneConfig(selectedZone, { marginBottom: parseFloat(e.target.value) || 0 })}
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Left (px)</label>
                      <input
                        type="number"
                        value={selectedConfig.marginLeft || 0}
                        onChange={(e) => updateZoneConfig(selectedZone, { marginLeft: parseFloat(e.target.value) || 0 })}
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label>Right (px)</label>
                      <input
                        type="number"
                        value={selectedConfig.marginRight || 0}
                        onChange={(e) => updateZoneConfig(selectedZone, { marginRight: parseFloat(e.target.value) || 0 })}
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4>Padding</h4>
                  <div className="form-group">
                    <label>Padding (px)</label>
                    <input
                      type="number"
                      value={selectedConfig.padding || 10}
                      onChange={(e) => updateZoneConfig(selectedZone, { padding: parseFloat(e.target.value) || 10 })}
                      min="0"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-selection">
                <p>Click on a zone in the preview to configure it</p>
              </div>
            )}
          </div>
        </div>

        <div className="zone-config-modal-footer">
          <button className="action-btn" onClick={handleCancel}>Cancel</button>
          <button className="action-btn primary" onClick={handleSave}>Save Zones</button>
        </div>
      </div>
    </>
  );
};

export default ZoneConfigModal;

