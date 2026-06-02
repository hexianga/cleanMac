import { createTheme, type MantineThemeOverride } from "@mantine/core";

export const glass = {
  bg: "rgba(255, 255, 255, 0.08)",
  bgStrong: "rgba(255, 255, 255, 0.12)",
  border: "rgba(255, 255, 255, 0.12)",
  blur: "blur(16px)",
  footerBg: "rgba(15, 23, 42, 0.72)",
} as const;

export const cleanMacTheme: MantineThemeOverride = createTheme({
  primaryColor: "indigo",
  defaultRadius: "md",
  activeClassName: "",
  components: {
    Paper: {
      defaultProps: {
        withBorder: true,
      },
      styles: {
        root: {
          backgroundColor: glass.bg,
          backdropFilter: glass.blur,
          borderColor: glass.border,
        },
      },
    },
    Modal: {
      styles: {
        content: {
          backgroundColor: glass.bg,
          backdropFilter: glass.blur,
          border: `1px solid ${glass.border}`,
        },
        header: {
          backgroundColor: "transparent",
        },
      },
    },
    Table: {
      styles: {
        table: {
          backgroundColor: "transparent",
        },
        tr: {
          backgroundColor: "transparent",
        },
      },
    },
    Alert: {
      styles: {
        root: {
          backgroundColor: "rgba(255, 255, 255, 0.06)",
          borderColor: glass.border,
        },
      },
    },
    Button: {
      styles: {
        root: {
          "&[data-variant='light']": {
            backgroundColor: "rgba(255, 255, 255, 0.12)",
            color: "rgba(255, 255, 255, 0.95)",
          },
          "&[data-variant='default']": {
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            borderColor: glass.border,
            color: "rgba(255, 255, 255, 0.95)",
          },
          "&[data-variant='subtle']": {
            color: "rgba(255, 255, 255, 0.85)",
          },
        },
      },
    },
    Accordion: {
      styles: {
        item: {
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          borderColor: glass.border,
        },
        control: {
          backgroundColor: "transparent",
        },
      },
    },
  },
});
