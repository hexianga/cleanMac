import { Button, Group, Text } from "@mantine/core";
import { glass } from "../lib/diskCleanerTheme";
import { formatBytes } from "../lib/formatBytes";

interface DetailFooterProps {
  selectedCount: number;
  selectedBytes: number;
  deleting: boolean;
  onClean: () => void;
}

export function DetailFooter({
  selectedCount,
  selectedBytes,
  deleting,
  onClean,
}: DetailFooterProps) {
  return (
    <Group
      justify="space-between"
      align="center"
      px="md"
      py="md"
      style={{
        borderTop: `1px solid ${glass.border}`,
        background: glass.footerBg,
        backdropFilter: glass.blur,
      }}
    >
      <Text size="sm" c="rgba(255, 255, 255, 0.95)">
        {selectedCount > 0
          ? `已选 ${selectedCount} 项 · ${formatBytes(selectedBytes)}`
          : "未选择任何项目"}
      </Text>
      <Button
        variant="light"
        onClick={onClean}
        disabled={selectedCount === 0 || deleting}
        loading={deleting}
      >
        清理所选
      </Button>
    </Group>
  );
}
