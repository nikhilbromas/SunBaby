import React from 'react';
import { useDrag } from 'react-dnd';
import { useMobile } from '../../contexts/MobileContext';
import './Toolbar.css';

const Toolbar: React.FC = () => {
  type TargetSection = 'pageHeader' | 'header' | 'billContent' | 'billFooter' | 'pageFooter';
  
  const { isMobile, enterPlacementMode } = useMobile();

  const TextFieldDraggable: React.FC<{ targetSection: TargetSection; label?: string }> = ({
    targetSection,
    label,
  }) => {
    const [{ isDragging }, drag] = useDrag({
      type: 'text',
      item: { type: 'text', targetSection },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    const handleTap = () => {
      if (isMobile) {
        enterPlacementMode({ type: 'text', targetSection });
      }
    };

    return (
      <div
        ref={!isMobile ? drag : undefined}
        className={`toolbar-item ${isDragging ? 'dragging' : ''}`}
        onClick={isMobile ? handleTap : undefined}
        role={isMobile ? 'button' : undefined}
        tabIndex={isMobile ? 0 : undefined}
      >
        <span className="toolbar-icon">📝</span>
        <span>{label || 'Text Field'}</span>
      </div>
    );
  };

  const TableDraggable: React.FC<{ targetSection?: 'billContent' | 'itemsTable'; label?: string }> = ({
    targetSection,
    label,
  }) => {
    const [{ isDragging }, drag] = useDrag({
      type: 'table',
      item: { type: 'table', targetSection },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    const handleTap = () => {
      if (isMobile) {
        enterPlacementMode({ type: 'table', targetSection: targetSection as any });
      }
    };

    return (
      <div
        ref={!isMobile ? drag : undefined}
        className={`toolbar-item ${isDragging ? 'dragging' : ''}`}
        onClick={isMobile ? handleTap : undefined}
        role={isMobile ? 'button' : undefined}
        tabIndex={isMobile ? 0 : undefined}
      >
        <span className="toolbar-icon">📊</span>
        <span>{label || 'Items Table'}</span>
      </div>
    );
  };

  const PageNumberDraggable: React.FC<{ targetSection: 'pageHeader' | 'pageFooter' }> = ({
    targetSection,
  }) => {
    const [{ isDragging }, drag] = useDrag({
      type: 'pageNumber',
      item: { type: 'pageNumber', targetSection },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    const handleTap = () => {
      if (isMobile) {
        enterPlacementMode({ type: 'pageNumber', targetSection });
      }
    };

    return (
      <div
        ref={!isMobile ? drag : undefined}
        className={`toolbar-item ${isDragging ? 'dragging' : ''}`}
        onClick={isMobile ? handleTap : undefined}
        role={isMobile ? 'button' : undefined}
        tabIndex={isMobile ? 0 : undefined}
      >
        <span className="toolbar-icon">📄</span>
        <span>Page Number</span>
      </div>
    );
  };

  const TotalPagesDraggable: React.FC<{ targetSection: 'pageHeader' | 'pageFooter' }> = ({
    targetSection,
  }) => {
    const [{ isDragging }, drag] = useDrag({
      type: 'totalPages',
      item: { type: 'totalPages', targetSection },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    const handleTap = () => {
      if (isMobile) {
        enterPlacementMode({ type: 'totalPages', targetSection });
      }
    };

    return (
      <div
        ref={!isMobile ? drag : undefined}
        className={`toolbar-item ${isDragging ? 'dragging' : ''}`}
        onClick={isMobile ? handleTap : undefined}
        role={isMobile ? 'button' : undefined}
        tabIndex={isMobile ? 0 : undefined}
      >
        <span className="toolbar-icon">📑</span>
        <span>Total Pages</span>
      </div>
    );
  };

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <h3>Page Header</h3>
        <div className="toolbar-items">
          <TextFieldDraggable targetSection="pageHeader" />
          <PageNumberDraggable targetSection="pageHeader" />
          <TotalPagesDraggable targetSection="pageHeader" />
        </div>
      </div>

      <div className="toolbar-section">
        <h3>Bill Header</h3>
        <div className="toolbar-items">
          <TextFieldDraggable targetSection="header" />
        </div>
      </div>

      <div className="toolbar-section">
        <h3>Bill Content</h3>
        <div className="toolbar-items">
          <TextFieldDraggable targetSection="billContent" />
          <TableDraggable targetSection="billContent" label="Items Table (Bill Content)" />
        </div>
      </div>

      <div className="toolbar-section">
        <h3>Bill Footer</h3>
        <div className="toolbar-items">
          <TextFieldDraggable targetSection="billFooter" />
        </div>
      </div>

      <div className="toolbar-section">
        <h3>Page Footer</h3>
        <div className="toolbar-items">
          <TextFieldDraggable targetSection="pageFooter" />
          <PageNumberDraggable targetSection="pageFooter" />
          <TotalPagesDraggable targetSection="pageFooter" />
        </div>
      </div>
    </div>
  );
};

export default Toolbar;

