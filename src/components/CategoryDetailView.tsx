import {
  Alert,
  Box,
  Button,
  Group,
  Text,
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { cacheDeleteHint } from "../lib/cacheImpactCopy";
import { formatBytes } from "../lib/formatBytes";
import type { ScanCategoryResult } from "../lib/types";
import { DetailItemList } from "./DetailItemList";

interface CategoryDetailViewProps {
  category: ScanCategoryResult;
  selectedIds: Set<string>;
  onBack: () => void;
  onToggleItem: (itemId: string, checked: boolean) => void;
  onSelectAllDeletable: () => void;
  onDeselectAllInCategory: () => void;
}

export function CategoryDetailView({
  category,
  selectedIds,
  onBack,
  onToggleItem,
  onSelectAllDeletable,
  onDeselectAllInCategory,
}: CategoryDetailViewProps) {
  const isCacheCategory =
    category.scannerId === "app_caches" || category.scannerId === "dev_caches";
  const [cacheAlertDismissed, setCacheAlertDismissed] = useState(false);

  useEffect(() => {
    setCacheAlertDismissed(false);
  }, [category.scannerId]);

  const cacheHint = cacheDeleteHint(category.scannerId);

  return (
    <Box
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: "var(--mantine-spacing-md)",
      }}
    >
      <Box
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: "var(--mantine-spacing-md)",
        }}
      >
        <Group justify="space-between" align="center" wrap="nowrap">
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={onBack}
            style={{ flexShrink: 0 }}
          >
            返回
          </Button>
          <Text fw={600} size="lg" lineClamp={1} style={{ flex: 1, textAlign: "center" }}>
            {category.name}
          </Text>
          <div style={{ width: 72, flexShrink: 0 }} aria-hidden />
        </Group>

        {isCacheCategory && !cacheAlertDismissed && cacheHint ? (
          <Alert
            variant="light"
            color="yellow"
            withCloseButton
            onClose={() => setCacheAlertDismissed(true)}
          >
            {cacheHint}
          </Alert>
        ) : null}

        <Text size="sm" c="dimmed">
          {category.items.length} 项，磁盘占用合计 {formatBytes(category.totalBytes)}
        </Text>

        <Group gap="sm">
          <Button size="xs" variant="light" onClick={onSelectAllDeletable}>
            全选可删
          </Button>
          <Button size="xs" variant="default" onClick={onDeselectAllInCategory}>
            取消全选
          </Button>
        </Group>
      </Box>

      <DetailItemList
        scannerId={category.scannerId}
        items={category.items}
        selectedIds={selectedIds}
        onToggleItem={onToggleItem}
      />
    </Box>
  );
}
