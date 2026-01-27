import { ActionBar } from "./ActionBar";
import { PageSettings } from "./sections/PageSettings";
import { ZoneSettings } from "./sections/ZoneSettings";
import { FieldEditor } from "./editors/FieldEditor";
import { ImageEditor } from "./editors/ImageEditor";
import { ItemsTableEditor } from "./editors/ItemsTableEditor";
import { BillContentTableEditor } from "./editors/BillContentTableEditor";
import { ContentDetailTableEditor } from "./editors/ContentDetailTableEditor";

import type {
  TemplateJson,
  TextFieldConfig,
  ImageFieldConfig,
  ItemsTableConfig,
  ContentDetailsTableConfig,
} from "../../../services/types";

/* -------------------- Types -------------------- */

export type SectionType =
  | "pageHeader"
  | "pageFooter"
  | "header"
  | "billContent"
  | "billFooter";

export type SelectedElement =
  | { type: "field"; index: number; section?: SectionType }
  | { type: "image"; index: number; section?: SectionType }
  | { type: "table" }
  | { type: "billContentTable"; index: number }
  | { type: "contentDetailTable"; index: number };

export interface PropertyPanelProps {
  selectedElement: SelectedElement | null;
  template: TemplateJson;

  onUpdateField: (
    index: number,
    updates: Partial<TextFieldConfig>,
    section: SectionType
  ) => void;

  onUpdateImage: (
    index: number,
    updates: Partial<ImageFieldConfig>,
    section: SectionType
  ) => void;

  onUpdateTable: (table: ItemsTableConfig) => void;

  onUpdateContentDetailTable: (
    index: number,
    table: ContentDetailsTableConfig
  ) => void;

  onUpdateBillContentTable: (
    index: number,
    table: ItemsTableConfig
  ) => void;

  onUpdatePage: (page: {
    size?: string;
    orientation?: "portrait" | "landscape";
  }) => void;

  onUpdatePagination: (pagination: {
    rowsPerPage?: number;
    repeatHeader?: boolean;
  }) => void;

  onSave?: () => void;
  isSaving?: boolean;
  onSetup?: () => void;

  onOpenTableModal?: (
    type: "itemsTable" | "billContentTable" | "contentDetailTable",
    index?: number
  ) => void;

  onOpenZoneConfig?: () => void;
}

/* -------------------- Component -------------------- */

const PropertyPanel: React.FC<PropertyPanelProps> = (props) => {
  const { selectedElement } = props;

  // No selection → global settings
  if (!selectedElement) {
    return (
      <>
        <PageSettings {...props} />
        <ZoneSettings {...props} />
        <ActionBar {...props} />
      </>
    );
  }

  // Element-specific editors
  switch (selectedElement.type) {
    case "field":
      return <FieldEditor {...props} />;

    case "image":
      return <ImageEditor {...props} />;

    case "table":
      return <ItemsTableEditor {...props} />;

    // case "billContentTable":
    //   return <BillContentTableEditor {...props} />;

    // case "contentDetailTable":
    //   return <ContentDetailTableEditor {...props} />;

    default:
      return null;
  }
};

export default PropertyPanel;
