import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PropertyGroup } from "../ui/PropertyGroup";

export const FieldEditor = ({
  selectedElement,
  template,
  onUpdateField,
}: any) => {
  const section = selectedElement.section ?? "header";
  const field = template[section]?.[selectedElement.index];
  if (!field) return null;

  return (
    <>
      <PropertyGroup title="Field">
        <Input
          value={field.label}
          onChange={e =>
            onUpdateField(selectedElement.index, { label: e.target.value }, section)
          }
          placeholder="Label"
        />
        <Input
          value={field.bind || ""}
          onChange={e =>
            onUpdateField(selectedElement.index, { bind: e.target.value }, section)
          }
          placeholder="Binding"
        />
      </PropertyGroup>

      <PropertyGroup title="Position">
        <Input
          type="number"
          value={field.x}
          onChange={e =>
            onUpdateField(selectedElement.index, { x: +e.target.value }, section)
          }
          placeholder="X"
        />
        <Input
          type="number"
          value={field.y}
          onChange={e =>
            onUpdateField(selectedElement.index, { y: +e.target.value }, section)
          }
          placeholder="Y"
        />
      </PropertyGroup>

      <PropertyGroup title="Visibility">
        <Checkbox
          checked={field.visible}
          onCheckedChange={v =>
            onUpdateField(selectedElement.index, { visible: !!v }, section)
          }
        />
        Visible
      </PropertyGroup>
    </>
  );
};
