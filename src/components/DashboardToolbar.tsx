import { Button, Group } from "@mantine/core";

interface DashboardToolbarProps {
  scanning: boolean;
  onOpenSettings: () => void;
  onScanAll: () => void;
}

export function DashboardToolbar({
  scanning,
  onOpenSettings,
  onScanAll,
}: DashboardToolbarProps) {
  return (
    <Group justify="flex-end" gap="sm">
      <Button variant="default" onClick={onOpenSettings}>
        设置
      </Button>
      <Button variant="filled" size="md" loading={scanning} onClick={onScanAll}>
        一键扫描
      </Button>
    </Group>
  );
}
