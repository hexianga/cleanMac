import { Box, Button, Group, Text } from "@mantine/core";
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
    <Box h="100%" w="100%" style={{ boxSizing: "border-box" }}>
      <Group
        justify="space-between"
        align="center"
        h="100%"
        px="md"
        wrap="nowrap"
        gap="md"
      >
        <Text size="sm" c="rgba(255, 255, 255, 0.95)" lineClamp={1}>
          {selectedCount > 0
            ? `已选 ${selectedCount} 项 · ${formatBytes(selectedBytes)}`
            : "未选择任何项目"}
        </Text>
        <Button
          variant="light"
          onClick={onClean}
          disabled={selectedCount === 0 || deleting}
          loading={deleting}
          style={{ flexShrink: 0 }}
        >
          清理所选
        </Button>
      </Group>
    </Box>
  );
}
