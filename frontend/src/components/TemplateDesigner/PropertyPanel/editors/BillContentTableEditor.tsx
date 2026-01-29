import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useColumnSelection } from "../hooks/useColumnSelection";
import { PropertyGroup } from "../ui/PropertyGroup";
import type { ItemsTableConfig, TableColumnConfig, FinalRowConfig } from "../../../../services/types";

interface Props {
  selectedElement: { index: number };
  template: any;
  onUpdateBillContentTable: (index: number, table: ItemsTableConfig) => void;
  onOpenTableModal?: (type: "billContentTable", index?: number) => void;
}

export const BillContentTableEditor: React.FC<Props> = ({
  selectedElement,
  template,
  onUpdateBillContentTable,
  onOpenTableModal,
}) => {
  const table = template.billContentTables?.[selectedElement.index];
  if (!table) return null;

  const { selected, toggle, toggleAll, clear } =
    useColumnSelection(table.columns.length);

  const updateColumn = (i: number, updates: Partial<TableColumnConfig>) => {
    const columns = table.columns.map((c: any, idx: number) =>
      idx === i ? { ...c, ...updates } : c
    );
    onUpdateBillContentTable(selectedElement.index, { ...table, columns });
  };

  const deleteSelected = () => {
    onUpdateBillContentTable(selectedElement.index, {
      ...table,
      columns: table.columns.filter((_: any, i: number) => !selected.has(i)),
    });
    clear();
  };

  return (
    <>
  {/* ===== Header ===== */}
  <div className="px-4 py-2 border-b bg-white">
    <div className="flex items-center justify-between">
      <div className="text-sm font-medium">Bill Content Table</div>

      {onOpenTableModal && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onOpenTableModal("billContentTable", selectedElement.index)
          }
        >
          Open Table Editor
        </Button>
      )}
    </div>
  </div>

  {/* ===== Layout (Sheets style small inputs) ===== */}
  <div className="px-4 py-2 flex gap-2 border-b bg-[#f8f9fa]">
    <Input
      type="number"
      placeholder="X"
      className="h-7 w-20"
      value={table.x ?? 0}
      onChange={e =>
        onUpdateBillContentTable(selectedElement.index, {
          ...table,
          x: +e.target.value,
        })
      }
    />
    <Input
      type="number"
      placeholder="Y"
      className="h-7 w-20"
      value={table.y ?? 0}
      onChange={e =>
        onUpdateBillContentTable(selectedElement.index, {
          ...table,
          y: +e.target.value,
        })
      }
    />
  </div>

  {/* ===== Toolbar ===== */}
  <div className="px-4 py-2 flex gap-2 border-b bg-[#f8f9fa]">
    <Button size="sm" variant="outline" onClick={toggleAll}>
      Select all
    </Button>

    {selected.size > 0 && (
      <Button size="sm" variant="destructive" onClick={deleteSelected}>
        Delete ({selected.size})
      </Button>
    )}
  </div>

  {/* ===== Spreadsheet Grid ===== */}
  <div className="overflow-auto">
    <div className="min-w-[600px] border-t border-l border-[#e0e0e0] text-sm">

      {/* Header row */}
      <div className="grid grid-cols-[40px_1fr_1fr_80px] bg-[#f1f3f4]">
        {["", "Label", "Binding", "Visible"].map((h, i) => (
          <div
            key={i}
            className="px-2 py-1 border-r border-b border-[#e0e0e0] font-medium text-gray-700"
          >
            {h}
          </div>
        ))}
      </div>

      {/* Data rows */}
      {table.columns.map((col: TableColumnConfig, i: number) => (
        <div
          key={i}
          className={`grid grid-cols-[40px_1fr_1fr_80px]
            ${selected.has(i) ? "bg-[#e8f0fe]" : "bg-white"}
          `}
        >
          {/* Row selector */}
          <div className="flex items-center justify-center border-r border-b border-[#e0e0e0]">
            <Checkbox
              checked={selected.has(i)}
              onCheckedChange={() => toggle(i)}
            />
          </div>

          {/* Label cell */}
          <div className="border-r border-b border-[#e0e0e0] px-1">
            <Input
              value={col.label}
              className="
                h-7 rounded-none border-none px-1
                focus-visible:ring-0 focus:bg-white
              "
              onChange={e =>
                updateColumn(i, { label: e.target.value })
              }
            />
          </div>

          {/* Binding cell */}
          <div className="border-r border-b border-[#e0e0e0] px-1">
            <Input
              value={col.bind}
              className="
                h-7 rounded-none border-none px-1
                focus-visible:ring-0 focus:bg-white
              "
              onChange={e =>
                updateColumn(i, { bind: e.target.value })
              }
            />
          </div>

          {/* Visible cell */}
          <div className="flex items-center justify-center border-b border-[#e0e0e0]">
            <Checkbox
              checked={col.visible !== false}
              onCheckedChange={v =>
                updateColumn(i, { visible: !!v })
              }
            />
          </div>
        </div>
      ))}
    </div>
  </div>

  {/* ===== Final Rows ===== */}
  <div className="px-4 py-3 border-t bg-white">
    <Button
      size="sm"
      onClick={() => {
        const row: FinalRowConfig = {
          visible: true,
          cells: table.columns
            .filter((c: any) => c.visible !== false)
            .map(() => ({
              label: "",
              valueType: "static",
              value: "",
              colSpan: 1,
              align: "left",
            })),
        };

        onUpdateBillContentTable(selectedElement.index, {
          ...table,
          finalRows: [...(table.finalRows || []), row],
        });
      }}
    >
      + Add Row
    </Button>
  </div>
</>

  );
};

export default BillContentTableEditor;
