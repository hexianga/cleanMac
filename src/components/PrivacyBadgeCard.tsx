import { Group, Paper, Text, ThemeIcon } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { glass } from "../lib/diskCleanerTheme";

export function PrivacyBadgeCard() {
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
        display: "flex",
        alignItems: "center",
      }}
    >
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon variant="light" color="teal" size="lg" radius="xl">
          <IconLock size={18} stroke={1.6} />
        </ThemeIcon>
        <Text size="sm" fw={500}>
          纯本地 · 不上传数据
        </Text>
      </Group>
    </Paper>
  );
}
