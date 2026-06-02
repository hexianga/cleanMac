import { Box, ScrollArea, Stack } from "@mantine/core";
import { useState } from "react";
import {
  CLASSIFICATION_SCANNER_ORDER,
  FILE_TYPE_SCANNER_ORDER,
  mergeCategories,
  type ScannerId,
} from "../lib/categoryMeta";
import type { HomeTab } from "../lib/homeTab";
import type {
  CategoryScanState,
  DiskOverview,
  ScanCategoryResult,
} from "../lib/types";
import { CacheImpactModal } from "./CacheImpactModal";
import { CategoryCard } from "./CategoryCard";
import { DashboardHeader } from "./DashboardHeader";

/** Room below last card row for hover box-shadow (0 8px 24px) inside ScrollArea */
const DASHBOARD_GRID_SHADOW_PADDING_PX = 32;

const scrollAreaStyles = {
  root: {
    flex: 1,
    minHeight: 0,
  },
  viewport: {
    scrollbarGutter: "stable",
  },
};

interface DashboardViewProps {
  activeHomeTab: HomeTab;
  disk: DiskOverview | null;
  categories: ScanCategoryResult[];
  scanState: Record<ScannerId, CategoryScanState>;
  selectedIdsByCategory: Record<ScannerId, Set<string>>;
  onOpenCategory: (scannerId: ScannerId) => void;
  onScanCategory: (scannerId: ScannerId) => void;
  onScanAll: () => void;
  onOpenSettings: () => void;
}

interface CardGridProps {
  scannerOrder: readonly ScannerId[];
  categories: ScanCategoryResult[];
  scanState: Record<ScannerId, CategoryScanState>;
  selectedIdsByCategory: Record<ScannerId, Set<string>>;
  onOpenCategory: (scannerId: ScannerId) => void;
  onScanCategory: (scannerId: ScannerId) => void;
  onShowCacheImpact: (scannerId: "app_caches" | "dev_caches") => void;
}

function CategoryCardGrid({
  scannerOrder,
  categories,
  scanState,
  selectedIdsByCategory,
  onOpenCategory,
  onScanCategory,
  onShowCacheImpact,
}: CardGridProps) {
  const merged = mergeCategories(categories, scannerOrder);
  const categoryById = new Map(merged.map((c) => [c.scannerId, c]));

  const selectedCountInCategory = (scannerId: ScannerId) => {
    const ids = selectedIdsByCategory[scannerId];
    const category = categoryById.get(scannerId);
    if (!category || !ids) {
      return 0;
    }
    return category.items.filter((item) => ids.has(item.id)).length;
  };

  return (
    <Box
      className="category-card-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "var(--mantine-spacing-md)",
        width: "100%",
        alignItems: "stretch",
      }}
    >
      {scannerOrder.map((scannerId) => (
        <Box key={scannerId} style={{ display: "flex", minWidth: 0 }}>
          <CategoryCard
            scannerId={scannerId}
            category={categoryById.get(scannerId) ?? null}
            scanState={scanState[scannerId]}
            selectedCount={selectedCountInCategory(scannerId)}
            onScan={onScanCategory}
            onOpen={onOpenCategory}
            onShowCacheImpact={
              scannerId === "app_caches" || scannerId === "dev_caches"
                ? () => onShowCacheImpact(scannerId)
                : undefined
            }
          />
        </Box>
      ))}
    </Box>
  );
}

export function DashboardView({
  activeHomeTab,
  disk,
  categories,
  scanState,
  selectedIdsByCategory,
  onOpenCategory,
  onScanCategory,
  onScanAll,
  onOpenSettings,
}: DashboardViewProps) {
  const [cacheImpactId, setCacheImpactId] = useState<
    "app_caches" | "dev_caches" | null
  >(null);

  const anyClassScanning = CLASSIFICATION_SCANNER_ORDER.some(
    (id) => scanState[id] === "scanning",
  );
  const anyFileTypeScanning = FILE_TYPE_SCANNER_ORDER.some(
    (id) => scanState[id] === "scanning",
  );

  const gridProps = {
    categories,
    scanState,
    selectedIdsByCategory,
    onOpenCategory,
    onScanCategory,
    onShowCacheImpact: (id: "app_caches" | "dev_caches") => setCacheImpactId(id),
  };

  return (
    <Stack gap="md" style={{ flex: 1, minHeight: 0, width: "100%" }}>
      {disk ? (
        <DashboardHeader
          disk={disk}
          scanning={
            activeHomeTab === "classification"
              ? anyClassScanning
              : anyFileTypeScanning
          }
          onScanAll={onScanAll}
          onOpenSettings={onOpenSettings}
        />
      ) : null}

      <ScrollArea
        flex={1}
        type="auto"
        offsetScrollbars
        scrollbars="y"
        styles={scrollAreaStyles}
        style={{ minHeight: 0, width: "100%" }}
      >
        <Box style={{ paddingBottom: DASHBOARD_GRID_SHADOW_PADDING_PX }}>
          <Box
            style={{
              display: activeHomeTab === "classification" ? "block" : "none",
            }}
          >
            <CategoryCardGrid
              scannerOrder={CLASSIFICATION_SCANNER_ORDER}
              {...gridProps}
            />
          </Box>
          <Box
            style={{
              display: activeHomeTab === "file_type" ? "block" : "none",
            }}
          >
            <CategoryCardGrid
              scannerOrder={FILE_TYPE_SCANNER_ORDER}
              {...gridProps}
            />
          </Box>
        </Box>
      </ScrollArea>

      <CacheImpactModal
        scannerId={cacheImpactId}
        onClose={() => setCacheImpactId(null)}
      />
    </Stack>
  );
}
