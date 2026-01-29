import { PropertyGroup } from "../ui/PropertyGroup";

export const PageSettings = ({ template, onUpdatePage }: any) => {
  if (!onUpdatePage) return null;

  return (
    <PropertyGroup title="Page Layout">
      <select
        value={template.page.size}
        onChange={e => onUpdatePage({ size: e.target.value })}
      >
        <option value="A4">A4</option>
        <option value="Letter">Letter</option>
        <option value="Legal">Legal</option>
      </select>

      <select
        value={template.page.orientation}
        onChange={e =>
          onUpdatePage({ orientation: e.target.value })
        }
      >
        <option value="portrait">Portrait</option>
        <option value="landscape">Landscape</option>
      </select>
    </PropertyGroup>
  );
};
