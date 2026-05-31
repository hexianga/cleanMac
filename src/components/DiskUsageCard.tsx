import { Paper, Progress, Text } from "@mantine/core";
import { glass } from "../lib/diskCleanerTheme";
import { diskUsedPercent } from "../lib/diskUsage";
import type { DiskOverview } from "../lib/types";

interface DiskUsageCardProps {
  disk: DiskOverview;
}

export function DiskUsageCard({ disk }: DiskUsageCardProps) {
  const usedPercent = diskUsedPercent(disk.totalBytes, disk.availableBytes);

  return (
    <Paper
      px="md"
      py="sm"
      radius="md"
      h="100%"
      style={{
        background: glass.bg,
        backdropFilter: glass.blur,
        border: `1px solid ${glass.border}`,
      }}
    >
      <Text size="sm" fw={600} mb="xs">
        磁盘空间
      </Text>
      <Progress value={usedPercent} size="sm" mb="xs" />
      <Text size="sm">
        可用 {disk.availableHuman} / {disk.totalHuman}
      </Text>
      <Text size="xs" c="dimmed">
        已用 {usedPercent}%
      </Text>
    </Paper>
  );
}
