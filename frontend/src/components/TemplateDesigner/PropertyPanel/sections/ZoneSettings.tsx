import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";
import { PropertyGroup } from "../ui/PropertyGroup";

export const ZoneSettings = ({ onOpenZoneConfig }: any) => {
  if (!onOpenZoneConfig) return null;

  return (
    <PropertyGroup title="Zones">
      <Button className="w-full" onClick={onOpenZoneConfig}>
        <Target className="mr-2 h-4 w-4" />
        Configure Zones
      </Button>
    </PropertyGroup>
  );
};
