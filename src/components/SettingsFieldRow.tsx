import { Box, Group } from "@mantine/core";
import type { ReactNode } from "react";

interface SettingsFieldRowProps {
  label: ReactNode;
  children: ReactNode;
}

export function SettingsFieldRow({ label, children }: SettingsFieldRowProps) {
  return (
    <Group align="center" wrap="nowrap" gap="md">
      <Box component="span" style={{ flex: "0 0 42%", minWidth: 0 }}>
        {label}
      </Box>
      <Box style={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Group>
  );
}
