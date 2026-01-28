import React, { useState, useRef } from 'react';
import { useDrag } from 'react-dnd';
import { useMobile } from '../../contexts/MobileContext';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Search, ChevronDown, GripVertical } from 'lucide-react';

/* ================= TYPES ================= */

interface DataPreviewProps {
  headerData: Record<string, any> | null;
  headerFields: string[];
  itemsData: Record<string, any>[];
  itemsFields: string[];
  contentDetails?: Record<
    string,
    {
      data: Record<string, any>[] | Record<string, any> | null;
      fields: string[];
      sampleCount: number;
      dataType?: 'array' | 'object';
    }
  >;
}

interface ZoneField {
  fieldType: 'header' | 'item' | 'contentDetail';
  fieldName: string;
  bind: string;
  label: string;
  sampleValue: any;
  contentName?: string;
}

type ZoneKey =
  | 'pageHeader'
  | 'header'
  | 'billContent'
  | 'billFooter'
  | 'pageFooter';

const ZONE_META: Record<
  ZoneKey,
  { label: string; hint: string }
> = {
  pageHeader: { label: 'Page Header Fields', hint: 'Top of page' },
  header: { label: 'Bill Header Fields', hint: 'Main bill header' },
  billContent: {
    label: 'Bill Content Fields',
    hint: 'Items & detail tables',
  },
  billFooter: { label: 'Bill Footer Fields', hint: 'Totals & summaries' },
  pageFooter: { label: 'Page Footer Fields', hint: 'Bottom of page' },
};

/* ================= FIELD UI ================= */

const FieldBox: React.FC<{
  dragging?: boolean;
  children: React.ReactNode;
}> = ({ dragging, children }) => (
  <div
    className={cn(
      'rounded-md border bg-background px-3 py-2 text-sm space-y-1 cursor-grab',
      'hover:bg-muted transition',
      dragging && 'opacity-60 ring-2 ring-primary'
    )}
  >
    {children}
  </div>
);

/* ================= FIELD COMPONENTS ================= */

const DraggableHeaderField: React.FC<{
  field: string;
  sampleValue: any;
  targetSection: ZoneKey;
}> = ({ field, sampleValue, targetSection }) => {
  const { isMobile, enterPlacementMode } = useMobile();
  const [{ isDragging }, drag] = useDrag({
    type: 'data-field',
    item: {
      fieldType: 'header',
      fieldName: field,
      bind: `header.${field}`,
      label: field,
      targetSection,
    },
    collect: (m) => ({ isDragging: m.isDragging() }),
  });

  return (
    <div
      ref={!isMobile ? drag : undefined}
      onClick={
        isMobile
          ? () =>
              enterPlacementMode({
                type: 'data-field',
                field: `header.${field}`,
                targetSection,
              })
          : undefined
      }
    >
      <FieldBox dragging={isDragging}>
        <code className="text-xs font-mono text-primary">
          header.{field}
        </code>
        {sampleValue !== undefined && (
          <p className="text-xs text-muted-foreground">
            Sample: {String(sampleValue)}
          </p>
        )}
      </FieldBox>
    </div>
  );
};

const DraggableItemField: React.FC<{
  field: string;
  sampleValue: any;
}> = ({ field, sampleValue }) => {
  const { isMobile, enterPlacementMode } = useMobile();
  const [{ isDragging }, drag] = useDrag({
    type: 'data-field',
    item: {
      fieldType: 'item',
      fieldName: field,
      bind: field,
      label: field,
    },
    collect: (m) => ({ isDragging: m.isDragging() }),
  });

  return (
    <div
      ref={!isMobile ? drag : undefined}
      onClick={
        isMobile
          ? () =>
              enterPlacementMode({
                type: 'data-field',
                field,
                targetSection: 'billContent',
              })
          : undefined
      }
    >
      <FieldBox dragging={isDragging}>
        <code className="text-xs font-mono">{field}</code>
        {sampleValue !== undefined && (
          <p className="text-xs text-muted-foreground">
            Sample: {String(sampleValue)}
          </p>
        )}
      </FieldBox>
    </div>
  );
};

const DraggableContentDetailField: React.FC<{
  contentName: string;
  field: string;
  sampleValue: any;
  bind: string;
  label: string;
  dataType?: 'array' | 'object';
}> = ({
  contentName,
  field,
  sampleValue,
  bind,
  label,
  dataType,
}) => {
  const { isMobile, enterPlacementMode } = useMobile();
  const [{ isDragging }, drag] = useDrag({
    type: 'data-field',
    item: {
      fieldType: 'contentDetail',
      contentName,
      fieldName: field,
      bind,
      label,
    },
    collect: (m) => ({ isDragging: m.isDragging() }),
  });

  return (
    <div
      ref={!isMobile ? drag : undefined}
      onClick={
        isMobile
          ? () =>
              enterPlacementMode({
                type: 'data-field',
                field: bind,
                targetSection:
                  dataType === 'object'
                    ? 'header'
                    : 'billContent',
              })
          : undefined
      }
    >
      <FieldBox dragging={isDragging}>
        <div className="flex gap-2 items-center">
          <code className="text-xs font-mono">{label}</code>
          <Badge variant="secondary" className="text-[10px]">
            {contentName}
          </Badge>
        </div>
        {sampleValue !== undefined && (
          <p className="text-xs text-muted-foreground">
            Sample: {String(sampleValue)}
          </p>
        )}
      </FieldBox>
    </div>
  );
};

/* ================= SELECTION ZONE ================= */

const DraggableSelectionZone: React.FC<
  DataPreviewProps & {
    targetSection: ZoneKey;
    label: string;
    hint: string;
    searchTerm: string;
  }
> = ({
  targetSection,
  label,
  hint,
  headerData,
  headerFields,
  itemsData,
  itemsFields,
  contentDetails,
}) => {
  const [collapsed, setCollapsed] = useState(true);
  const [canDragZone, setCanDragZone] = useState(false);
  const zoneRef = useRef<HTMLDivElement>(null);

  const zoneFields: ZoneField[] = [];

  headerFields.forEach((f: string) => {
    zoneFields.push({
      fieldType: 'header',
      fieldName: f,
      bind: `header.${f}`,
      label: f,
      sampleValue: headerData?.[f],
    });
  });

  if (targetSection === 'billContent') {
    itemsFields.forEach((f: string) => {
      zoneFields.push({
        fieldType: 'item',
        fieldName: f,
        bind: f,
        label: f,
        sampleValue: itemsData[0]?.[f],
      });
    });
  }

  if (contentDetails) {
    const typedEntries = Object.entries(
      contentDetails
    ) as [
      string,
      {
        data: Record<string, any>[] | Record<string, any> | null;
        fields: string[];
        sampleCount: number;
        dataType?: 'array' | 'object';
      }
    ][];

    typedEntries.forEach(([name, data]) => {
      if (data.dataType === 'object') {
        data.fields.forEach((f: string) => {
          zoneFields.push({
            fieldType: 'contentDetail',
            fieldName: f,
            bind: `contentDetails.${name}.${f}`,
            label: `${name}.${f}`,
            sampleValue:
              data.data &&
              typeof data.data === 'object' &&
              !Array.isArray(data.data)
                ? (data.data as Record<string, any>)[f]
                : null,
            contentName: name,
          });
        });
      } else if (targetSection === 'billContent') {
        const arr = Array.isArray(data.data) ? data.data : [];
        data.fields.forEach((f: string) => {
          zoneFields.push({
            fieldType: 'contentDetail',
            fieldName: f,
            bind: f,
            label: f,
            sampleValue: arr[0]?.[f],
            contentName: name,
          });
        });
      }
    });
  }

  const [{ isDragging }, drag] = useDrag({
    type: 'data-field',
    item: {
      fieldType: 'selectionZone',
      targetSection,
      fields: zoneFields,
    },
    canDrag: canDragZone && zoneFields.length > 0,
    collect: (m) => ({ isDragging: m.isDragging() }),
    end: () => setCanDragZone(false),
  });

  React.useEffect(() => {
    if (zoneRef.current) drag(zoneRef);
  }, [drag]);

  return (
    <Card
      ref={zoneRef}
      onDoubleClick={() => setCanDragZone(true)}
      className={cn(
        canDragZone && 'ring-2 ring-primary cursor-grab',
        isDragging && 'opacity-60'
      )}
    >
      <CardHeader onClick={() => setCollapsed(!collapsed)}>
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm flex items-center gap-2">
            <GripVertical size={14} /> {label}
          </CardTitle>
          <ChevronDown
            size={16}
            className={cn('transition', collapsed && '-rotate-90')}
          />
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
        {canDragZone && (
          <p className="text-xs text-primary">
            🎯 Drag now to place all fields
          </p>
        )}
      </CardHeader>

      {!collapsed && (
        <CardContent className="p-0 overflow-hidden">
          <ScrollArea className="h-[280px]">
            <div className="flex flex-col gap-2 p-4">
              {zoneFields.map((zf, i) =>
                zf.fieldType === 'header' ? (
                  <DraggableHeaderField
                    key={i}
                    field={zf.fieldName}
                    sampleValue={zf.sampleValue}
                    targetSection={targetSection}
                  />
                ) : zf.fieldType === 'item' ? (
                  <DraggableItemField
                    key={i}
                    field={zf.fieldName}
                    sampleValue={zf.sampleValue}
                  />
                ) : (
                  <DraggableContentDetailField
                    key={i}
                    contentName={zf.contentName!}
                    field={zf.fieldName}
                    sampleValue={zf.sampleValue}
                    bind={zf.bind}
                    label={zf.label}
                    dataType={
                      contentDetails?.[zf.contentName!]?.dataType
                    }
                  />
                )
              )}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
};

/* ================= MAIN ================= */

const DataPreview: React.FC<DataPreviewProps> = (props) => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search fields..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {(Object.keys(ZONE_META) as ZoneKey[]).map((zone) => (
        <DraggableSelectionZone
          key={zone}
          {...props}
          targetSection={zone}
          label={ZONE_META[zone].label}
          hint={ZONE_META[zone].hint}
          searchTerm={searchTerm}
        />
      ))}
    </div>
  );
};

export default DataPreview;
