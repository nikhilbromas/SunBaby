import React from 'react';
import { useDrag } from 'react-dnd';
import './Toolbar.css';

const Toolbar: React.FC = () => {
  const TextFieldDraggable = () => {
    const [{ isDragging }, drag] = useDrag({
      type: 'text',
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    return (
      <div
        ref={drag}
        className={`toolbar-item ${isDragging ? 'dragging' : ''}`}
      >
        <span className="toolbar-icon">📝</span>
        <span>Text Field</span>
      </div>
    );
  };

  const TableDraggable = () => {
    const [{ isDragging }, drag] = useDrag({
      type: 'table',
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    return (
      <div
        ref={drag}
        className={`toolbar-item ${isDragging ? 'dragging' : ''}`}
      >
        <span className="toolbar-icon">📊</span>
        <span>Items Table</span>
      </div>
    );
  };

  return (
    <div className="toolbar">
      <div className="toolbar-items">
        <TextFieldDraggable />
        <TableDraggable />
      </div>
    </div>
  );
};

export default Toolbar;

