import { useColumnSelection } from "../hooks/useColumnSelection";
import { PropertyGroup } from "../ui/PropertyGroup";

export const ItemsTableEditor = ({ template, onUpdateTable }: any) => {
  const table = template.itemsTable;
  const { selected, toggle, toggleAll, clear } =
    useColumnSelection(table.columns.length);

  const deleteColumns = () => {
    onUpdateTable({
      ...table,
      columns: table.columns.filter((_: any, i: number) => !selected.has(i)),
    });
    clear();
  };

  return (
    <PropertyGroup title={`Columns (${table.columns.length})`}>
      <button onClick={toggleAll}>Toggle All</button>
      <button onClick={deleteColumns}>Delete</button>
    </PropertyGroup>
  );
};
