import { Button } from "@/components/ui/button";
import { Save, Settings } from "lucide-react";

export const ActionBar = ({
  onSave,
  onSetup,
  isSaving,
}: {
  onSave?: () => void;
  onSetup?: () => void;
  isSaving?: boolean;
}) => {
  if (!onSave && !onSetup) return null;

  return (
    <div className="sticky bottom-0 flex gap-2 border-t bg-background p-3">
      {onSetup && (
        <Button variant="secondary" onClick={onSetup}>
          <Settings className="mr-2 h-4 w-4" />
          Start
        </Button>
      )}
      {onSave && (
        <Button onClick={onSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Saving..." : "Save"}
        </Button>
      )}
    </div>
  );
};
