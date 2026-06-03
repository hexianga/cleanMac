import { Box, Button, Checkbox, Text } from "@mantine/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useLayoutEffect, useMemo, useState, type RefObject } from "react";
import { Virtuoso } from "react-virtuoso";
import { revealInFinder } from "../lib/api";
import { glass } from "../lib/cleanMacTheme";
import { formatBytes } from "../lib/formatBytes";
import {
  DETAIL_GROUP_HEADER_HEIGHT,
  DETAIL_ITEM_ROW_HEIGHT,
  flattenDetailGroups,
  type DetailListRow,
} from "../lib/detailListRows";
import {
  categoryHasMultipleDetailGroups,
  groupItemsForCategory,
} from "../lib/groupScanItems";
import type { ScanItem } from "../lib/types";

const GRID_COLUMNS = "40px minmax(0, 1fr) 100px 120px 140px";

interface DetailItemListProps {
  scannerId: string;
  items: ScanItem[];
  selectedIds: Set<string>;
  onToggleItem: (itemId: string, checked: boolean) => void;
  scrollRef: RefObject<HTMLElement | null>;
}

export function DetailItemList({
  scannerId,
  items,
  selectedIds,
  onToggleItem,
  scrollRef,
}: DetailItemListProps) {
  const useGroupedList = useMemo(
    () => categoryHasMultipleDetailGroups(scannerId, items),
    [scannerId, items],
  );

  return (
    <Box w="100%">
      <ListColumnHeader />
      {useGroupedList ? (
        <GroupedVirtualList
          scannerId={scannerId}
          items={items}
          selectedIds={selectedIds}
          onToggleItem={onToggleItem}
          scrollRef={scrollRef}
        />
      ) : (
        <FlatVirtuosoList
          items={items}
          selectedIds={selectedIds}
          onToggleItem={onToggleItem}
          scrollRef={scrollRef}
        />
      )}
    </Box>
  );
}

function ListColumnHeader() {
  return (
    <Box
      style={{
        display: "grid",
        gridTemplateColumns: GRID_COLUMNS,
        gap: 0,
        padding: "8px 12px",
        borderBottom: `1px solid ${glass.border}`,
      }}
    >
      <Text size="xs" c="dimmed" fw={600} />
      <Text size="xs" c="dimmed" fw={600}>
        文件名
      </Text>
      <Text size="xs" c="dimmed" fw={600}>
        大小
      </Text>
      <Text size="xs" c="dimmed" fw={600}>
        类型
      </Text>
      <Text size="xs" c="dimmed" fw={600}>
        操作
      </Text>
    </Box>
  );
}

function FlatVirtuosoList({
  items,
  selectedIds,
  onToggleItem,
  scrollRef,
}: {
  items: ScanItem[];
  selectedIds: Set<string>;
  onToggleItem: (itemId: string, checked: boolean) => void;
  scrollRef: RefObject<HTMLElement | null>;
}) {
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setScrollParent(scrollRef.current);
  });

  if (!scrollParent || items.length === 0) {
    return null;
  }

  return (
    <Virtuoso
      customScrollParent={scrollParent}
      data={items}
      defaultItemHeight={DETAIL_ITEM_ROW_HEIGHT}
      fixedItemHeight={DETAIL_ITEM_ROW_HEIGHT}
      increaseViewportBy={{ top: 200, bottom: 400 }}
      itemContent={(_index, item) => (
        <ItemRow
          item={item}
          checked={selectedIds.has(item.id)}
          onToggleItem={onToggleItem}
        />
      )}
    />
  );
}

function GroupedVirtualList({
  scannerId,
  items,
  selectedIds,
  onToggleItem,
  scrollRef,
}: {
  scannerId: string;
  items: ScanItem[];
  selectedIds: Set<string>;
  onToggleItem: (itemId: string, checked: boolean) => void;
  scrollRef: RefObject<HTMLElement | null>;
}) {
  const rows = useMemo(() => {
    const groups = groupItemsForCategory(scannerId, items);
    return flattenDetailGroups(groups);
  }, [scannerId, items]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) =>
      rows[index]?.kind === "group-header"
        ? DETAIL_GROUP_HEADER_HEIGHT
        : DETAIL_ITEM_ROW_HEIGHT,
    overscan: 12,
  });

  return (
    <Box
      style={{
        height: virtualizer.getTotalSize(),
        position: "relative",
        width: "100%",
      }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const row = rows[virtualRow.index]!;
        return (
          <Box
            key={row.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {row.kind === "group-header" ? (
              <GroupHeaderRow row={row} />
            ) : (
              <ItemRow
                item={row.item}
                checked={selectedIds.has(row.item.id)}
                onToggleItem={onToggleItem}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}

function GroupHeaderRow({
  row,
}: {
  row: Extract<DetailListRow, { kind: "group-header" }>;
}) {
  return (
    <Box
      style={{
        height: DETAIL_GROUP_HEADER_HEIGHT,
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        background: glass.bgStrong,
      }}
    >
      <Text fw={600} size="sm" lineClamp={1}>
        {row.label} · {row.count} 项 · {formatBytes(row.totalBytes)}
      </Text>
    </Box>
  );
}

const ItemRow = memo(function ItemRow({
  item,
  checked,
  onToggleItem,
}: {
  item: ScanItem;
  checked: boolean;
  onToggleItem: (itemId: string, checked: boolean) => void;
}) {
  const name = basename(item.path);

  return (
    <Box
      style={{
        height: DETAIL_ITEM_ROW_HEIGHT,
        display: "grid",
        gridTemplateColumns: GRID_COLUMNS,
        alignItems: "center",
        padding: "0 12px",
        borderBottom: `1px solid ${glass.border}`,
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <Checkbox
        checked={checked}
        disabled={!item.deletable}
        onChange={(event) =>
          onToggleItem(item.id, event.currentTarget.checked)
        }
        aria-label={name}
      />
      <Text size="sm" lineClamp={1} title={item.path}>
        {name}
      </Text>
      <Text size="sm">{item.sizeHuman}</Text>
      <Text size="sm" c="dimmed" lineClamp={1}>
        {itemTypeLabel(item)}
      </Text>
      {item.deletable ? (
        <Button
          size="xs"
          variant="subtle"
          onClick={() => void revealInFinder(item.path).catch(console.error)}
        >
          在 Finder 中显示
        </Button>
      ) : (
        <Text size="sm" c="orange">
          受保护
        </Text>
      )}
    </Box>
  );
});

function itemTypeLabel(item: ScanItem) {
  if (item.fileCategory) {
    return item.fileCategory;
  }
  if (!item.deletable) {
    return "Docker/VM";
  }
  return "—";
}

function basename(path: string) {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}
