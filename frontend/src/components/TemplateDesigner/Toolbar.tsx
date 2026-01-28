import React from 'react';
import { useDrag } from 'react-dnd';
import { useMobile } from '../../contexts/MobileContext';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FileText, Table, File, Files } from 'lucide-react';

const Toolbar: React.FC = () => {
  type TargetSection =
    | 'pageHeader'
    | 'header'
    | 'billContent'
    | 'billFooter'
    | 'pageFooter';

  const { isMobile, enterPlacementMode } = useMobile();

  const ToolbarItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    dragRef?: any;
    isDragging?: boolean;
    onClick?: () => void;
  }> = ({ icon, label, dragRef, isDragging, onClick }) => (
    <div
      ref={dragRef}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer',
        'border border-neutral-200 bg-white',
        'hover:bg-neutral-100 transition',
        isDragging && 'opacity-50'
      )}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded bg-black text-white">
        {icon}
      </div>
      <span className="text-sm font-medium text-black">{label}</span>
    </div>
  );

  const useDraggable = (type: string, targetSection?: string) =>
    useDrag({
      type,
      item: { type, targetSection },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

  const TextField = ({ targetSection }: { targetSection: TargetSection }) => {
    const [{ isDragging }, drag] = useDraggable('text', targetSection);
    const tap = () =>
      isMobile && enterPlacementMode({ type: 'text', targetSection });

    return (
      <ToolbarItem
        icon={<FileText size={16} />}
        label="Text Field"
        dragRef={!isMobile ? drag : undefined}
        isDragging={isDragging}
        onClick={isMobile ? tap : undefined}
      />
    );
  };

  const ItemsTable = ({ targetSection }: { targetSection: any }) => {
    const [{ isDragging }, drag] = useDraggable('table', targetSection);
    const tap = () =>
      isMobile && enterPlacementMode({ type: 'table', targetSection });

    return (
      <ToolbarItem
        icon={<Table size={16} />}
        label="Items Table"
        dragRef={!isMobile ? drag : undefined}
        isDragging={isDragging}
        onClick={isMobile ? tap : undefined}
      />
    );
  };

  const PageNumber = ({ targetSection }: any) => {
    const [{ isDragging }, drag] = useDraggable('pageNumber', targetSection);
    const tap = () =>
      isMobile && enterPlacementMode({ type: 'pageNumber', targetSection });

    return (
      <ToolbarItem
        icon={<File size={16} />}
        label="Page Number"
        dragRef={!isMobile ? drag : undefined}
        isDragging={isDragging}
        onClick={isMobile ? tap : undefined}
      />
    );
  };

  const TotalPages = ({ targetSection }: any) => {
    const [{ isDragging }, drag] = useDraggable('totalPages', targetSection);
    const tap = () =>
      isMobile && enterPlacementMode({ type: 'totalPages', targetSection });

    return (
      <ToolbarItem
        icon={<Files size={16} />}
        label="Total Pages"
        dragRef={!isMobile ? drag : undefined}
        isDragging={isDragging}
        onClick={isMobile ? tap : undefined}
      />
    );
  };

  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <Card className="p-4 space-y-3 border-neutral-200">
      <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
        {title}
      </h3>
      <div className="grid gap-2">{children}</div>
    </Card>
  );

  return (
    <div className="w-full space-y-4 p-4 bg-neutral-50">
      <Section title="Page Header">
        <TextField targetSection="pageHeader" />
        <PageNumber targetSection="pageHeader" />
        <TotalPages targetSection="pageHeader" />
      </Section>

      <Section title="Bill Header">
        <TextField targetSection="header" />
      </Section>

      <Section title="Bill Content">
        <TextField targetSection="billContent" />
        <ItemsTable targetSection="billContent" />
      </Section>

      <Section title="Bill Footer">
        <TextField targetSection="billFooter" />
      </Section>

      <Section title="Page Footer">
        <TextField targetSection="pageFooter" />
        <PageNumber targetSection="pageFooter" />
        <TotalPages targetSection="pageFooter" />
      </Section>
    </div>
  );
};

export default Toolbar;
