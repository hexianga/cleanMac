import { Button, Group, Paper, Progress, Stack, Text } from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";
import { glass } from "../lib/cleanMacTheme";
import { diskUsedPercent } from "../lib/diskUsage";
import type { DiskOverview } from "../lib/types";

interface DashboardHeaderProps {
  disk: DiskOverview;
  scanning: boolean;
  onScanAll: () => void;
  onOpenSettings: () => void;
}

export function DashboardHeader({
  disk,
  scanning,
  onScanAll,
  onOpenSettings,
}: DashboardHeaderProps) {
  const usedPercent = diskUsedPercent(disk.totalBytes, disk.availableBytes);

  return (
    <Paper
      px="lg"
      py="lg"
      radius="md"
      w="100%"
      style={{
        background: glass.bg,
        backdropFilter: glass.blur,
        border: `1px solid ${glass.border}`,
        boxSizing: "border-box",
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Text size="sm" fw={600}>
            磁盘空间
          </Text>
          <Button
            variant="subtle"
            size="compact-sm"
            leftSection={<IconSettings size={16} stroke={1.6} />}
            onClick={onOpenSettings}
          >
            设置
          </Button>
        </Group>

        <Stack gap="xs">
          <Text size="sm">
            可用 {disk.availableHuman} / {disk.totalHuman}
          </Text>
          <Group gap="sm" align="center" wrap="nowrap">
            <Progress value={usedPercent} size="sm" style={{ flex: 1 }} />
            <Text size="sm" fw={600} style={{ flexShrink: 0 }}>
              {usedPercent}%
            </Text>
          </Group>
        </Stack>

        <Group justify="flex-start">
          <Button
            variant="filled"
            size="md"
            loading={scanning}
            onClick={onScanAll}
          >
            开始扫描
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
