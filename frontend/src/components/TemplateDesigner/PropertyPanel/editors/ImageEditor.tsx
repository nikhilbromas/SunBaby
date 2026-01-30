import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PropertyGroup } from "../ui/PropertyGroup";

export const ImageEditor = ({
  selectedElement,
  template,
  onUpdateImage,
}: any) => {
  const section = selectedElement.section ?? "header";
  const images = template[`${section}Images`] || [];
  const image = images[selectedElement.index];
  if (!image) return null;

  return (
    <>
      <PropertyGroup title="Position">
        <Input
          type="number"
          value={image.x}
          onChange={e =>
            onUpdateImage(selectedElement.index, { x: +e.target.value }, section)
          }
          placeholder="X"
        />
        <Input
          type="number"
          value={image.y}
          onChange={e =>
            onUpdateImage(selectedElement.index, { y: +e.target.value }, section)
          }
          placeholder="Y"
        />
      </PropertyGroup>

      <PropertyGroup title="Options">
        <Checkbox
          checked={image.visible}
          onCheckedChange={v =>
            onUpdateImage(selectedElement.index, { visible: !!v }, section)
          }
        />
        Visible
      </PropertyGroup>
    </>
  );
};
