import { Stack, Text, UnstyledButton } from "@mantine/core";
import { glass } from "../lib/cleanMacTheme";
import type { HomeTab } from "../lib/homeTab";

const activeBg = "rgba(99, 102, 241, 0.24)";
const activeHoverBg = "rgba(99, 102, 241, 0.32)";

interface HomeSidebarProps {
  activeTab: HomeTab;
  onTabChange: (tab: HomeTab) => void;
}

interface SidebarNavItemProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function SidebarNavItem({ label, active, onClick }: SidebarNavItemProps) {
  return (
    <UnstyledButton
      onClick={onClick}
      w="100%"
      styles={{
        root: {
          display: "block",
          width: "100%",
          padding: "8px 12px",
          borderRadius: "var(--mantine-radius-md)",
          fontSize: "var(--mantine-font-size-sm)",
          fontWeight: 500,
          lineHeight: 1.4,
          color: active ? "rgba(255, 255, 255, 0.98)" : "rgba(255, 255, 255, 0.62)",
          backgroundColor: active ? activeBg : "transparent",
          border: active
            ? "1px solid rgba(129, 140, 248, 0.35)"
            : "1px solid transparent",
          transition:
            "background-color 150ms ease, color 150ms ease, border-color 150ms ease",
          "&:hover": {
            backgroundColor: active ? activeHoverBg : glass.bg,
            color: "rgba(255, 255, 255, 0.95)",
            borderColor: active
              ? "rgba(129, 140, 248, 0.45)"
              : "rgba(255, 255, 255, 0.1)",
          },
        },
      }}
    >
      {label}
    </UnstyledButton>
  );
}

export function HomeSidebar({ activeTab, onTabChange }: HomeSidebarProps) {
  return (
    <Stack gap="xs" p="sm" h="100%">
      <Text size="xs" c="dimmed" fw={600} px={4}>
        浏览
      </Text>
      <SidebarNavItem
        label="文件分类"
        active={activeTab === "classification"}
        onClick={() => onTabChange("classification")}
      />
      <SidebarNavItem
        label="文件类型"
        active={activeTab === "file_type"}
        onClick={() => onTabChange("file_type")}
      />
    </Stack>
  );
}
