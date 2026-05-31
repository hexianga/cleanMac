import {
  Button,
  Checkbox,
  Group,
  Radio,
  ScrollArea,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useMemo, type ReactNode } from "react";
import { revealInFinder } from "../lib/api";
import { glass } from "../lib/diskCleanerTheme";
import { formatBytes } from "../lib/formatBytes";
import { groupItemsForCategory } from "../lib/groupScanItems";
import type { ScanCategoryResult, ScanItem } from "../lib/types";

interface CategoryDetailViewProps {
  category: ScanCategoryResult;
  selectedIds: Set<string>;
  onBack: () => void;
  onToggleItem: (itemId: string, checked: boolean) => void;
  onSelectAllDeletable: () => void;
  onDeselectAllInCategory: () => void;
  onSetDuplicateKeeper: (
    groupItemIds: string[],
    keeperId: string,
  ) => void;
}

export function CategoryDetailView({
  category,
  selectedIds,
  onBack,
  onToggleItem,
  onSelectAllDeletable,
  onDeselectAllInCategory,
  onSetDuplicateKeeper,
}: CategoryDetailViewProps) {
  const isDuplicates = category.scannerId === "duplicates";

  const groups = useMemo(
    () => groupItemsForCategory(category.scannerId, category.items),
    [category.scannerId, category.items],
  );

  return (
    <Stack gap="md" h="100%">
      <Group justify="space-between" align="center">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={onBack}
        >
          返回
        </Button>
        <Text fw={600} size="lg">
          {category.name}
        </Text>
        <div style={{ width: 72 }} />
      </Group>

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

      <ScrollArea flex={1} type="auto" offsetScrollbars>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40} />
              <Table.Th>文件名</Table.Th>
              <Table.Th w={100}>大小</Table.Th>
              <Table.Th w={120}>类型</Table.Th>
              <Table.Th w={140}>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {groups.flatMap((group) => {
              const rows: ReactNode[] = [
                <Table.Tr
                  key={`h-${group.groupKey}`}
                  style={{ background: glass.bgStrong }}
                >
                  <Table.Td colSpan={5}>
                    <Text fw={600} size="sm">
                      {group.groupLabel} · {group.items.length} 项 ·{" "}
                      {formatBytes(group.totalBytes)}
                    </Text>
                  </Table.Td>
                </Table.Tr>,
              ];

              if (isDuplicates) {
                const groupItemIds = group.items.map((item) => item.id);
                const keeperId =
                  group.items.find((item) => !selectedIds.has(item.id))?.id ??
                  group.items[0]?.id ??
                  "";

                rows.push(
                  ...group.items.map((item) => (
                    <DuplicateItemRow
                      key={item.id}
                      item={item}
                      groupLabel={group.groupLabel}
                      keeperId={keeperId}
                      groupItemIds={groupItemIds}
                      onSetDuplicateKeeper={onSetDuplicateKeeper}
                    />
                  )),
                );
              } else {
                rows.push(
                  ...group.items.map((item) => (
                    <ItemTableRow
                      key={item.id}
                      item={item}
                      checked={selectedIds.has(item.id)}
                      onToggleItem={onToggleItem}
                    />
                  )),
                );
              }

              return rows;
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
}

function DuplicateItemRow({
  item,
  groupLabel,
  keeperId,
  groupItemIds,
  onSetDuplicateKeeper,
}: {
  item: ScanItem;
  groupLabel: string;
  keeperId: string;
  groupItemIds: string[];
  onSetDuplicateKeeper: (
    groupItemIds: string[],
    keeperId: string,
  ) => void;
}) {
  return (
    <Table.Tr>
      <Table.Td>
        <Radio
          checked={keeperId === item.id}
          onChange={() => onSetDuplicateKeeper(groupItemIds, item.id)}
          aria-label="保留此文件"
        />
      </Table.Td>
      <Table.Td>
        <Text size="sm" lineClamp={1} title={item.path}>
          {basename(item.path)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{item.sizeHuman}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          {groupLabel}
        </Text>
      </Table.Td>
      <Table.Td>
        <FinderAction item={item} />
      </Table.Td>
    </Table.Tr>
  );
}

function ItemTableRow({
  item,
  checked,
  onToggleItem,
}: {
  item: ScanItem;
  checked: boolean;
  onToggleItem: (itemId: string, checked: boolean) => void;
}) {
  return (
    <Table.Tr>
      <Table.Td>
        <Checkbox
          checked={checked}
          disabled={!item.deletable}
          onChange={(event) =>
            onToggleItem(item.id, event.currentTarget.checked)
          }
          aria-label={basename(item.path)}
        />
      </Table.Td>
      <Table.Td>
        <Text size="sm" lineClamp={1} title={item.path}>
          {basename(item.path)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{item.sizeHuman}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          {itemTypeLabel(item)}
        </Text>
      </Table.Td>
      <Table.Td>
        {item.deletable ? (
          <FinderAction item={item} />
        ) : (
          <Text size="sm" c="orange">
            受保护
          </Text>
        )}
      </Table.Td>
    </Table.Tr>
  );
}

function FinderAction({ item }: { item: ScanItem }) {
  return (
    <Button
      size="xs"
      variant="subtle"
      onClick={() => void revealInFinder(item.path).catch(console.error)}
    >
      在 Finder 中显示
    </Button>
  );
}

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
