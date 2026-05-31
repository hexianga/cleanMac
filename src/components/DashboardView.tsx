import { Grid, Stack } from "@mantine/core";
import { mergeCategories, SCANNER_ORDER, type ScannerId } from "../lib/categoryMeta";
import type { CategoryScanState, DiskOverview, ScanCategoryResult, ScanProgress } from "../lib/types";
import { CategoryCard } from "./CategoryCard";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardToolbar } from "./DashboardToolbar";

interface DashboardViewProps {
  disk: DiskOverview | null;
  categories: ScanCategoryResult[];
  scanState: Record<ScannerId, CategoryScanState>;
  scanProgressByCategory: Partial<Record<ScannerId, ScanProgress>>;
  selectedIdsByCategory: Record<ScannerId, Set<string>>;
  onOpenCategory: (scannerId: ScannerId) => void;
  onScanCategory: (scannerId: ScannerId) => void;
  onScanAll: () => void;
  onOpenSettings: () => void;
}

export function DashboardView({
  disk,
  categories,
  scanState,
  scanProgressByCategory,
  selectedIdsByCategory,
  onOpenCategory,
  onScanCategory,
  onScanAll,
  onOpenSettings,
}: DashboardViewProps) {
  const merged = mergeCategories(categories);
  const categoryById = new Map(merged.map((c) => [c.scannerId, c]));

  const selectedCountInCategory = (scannerId: ScannerId) => {
    const ids = selectedIdsByCategory[scannerId];
    const category = categoryById.get(scannerId);
    if (!category || !ids) {
      return 0;
    }
    return category.items.filter((item) => ids.has(item.id)).length;
  };

  const anyScanning = SCANNER_ORDER.some((id) => scanState[id] === "scanning");

  return (
    <Stack gap="md">
      {disk ? <DashboardHeader disk={disk} /> : null}
      <DashboardToolbar
        scanning={anyScanning}
        onOpenSettings={onOpenSettings}
        onScanAll={onScanAll}
      />

      <Grid gutter="md" align="stretch">
        {SCANNER_ORDER.map((scannerId) => (
          <Grid.Col
            key={scannerId}
            span={{ base: 12, sm: 6, md: 3 }}
            style={{ display: "flex", minWidth: 0 }}
          >
            <CategoryCard
              scannerId={scannerId}
              category={categoryById.get(scannerId) ?? null}
              scanState={scanState[scannerId]}
              scanProgress={scanProgressByCategory[scannerId]}
              selectedCount={selectedCountInCategory(scannerId)}
              onScan={onScanCategory}
              onOpen={onOpenCategory}
            />
          </Grid.Col>
        ))}
      </Grid>
    </Stack>
  );
}
