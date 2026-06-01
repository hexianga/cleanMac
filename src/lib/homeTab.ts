import { FILE_TYPE_SCANNER_ORDER, type FileTypeScannerId } from "./categoryMeta";

export type HomeTab = "classification" | "file_type";

export const FILE_TYPE_ONE_CLICK_IDS: FileTypeScannerId[] = [
  ...FILE_TYPE_SCANNER_ORDER,
];
