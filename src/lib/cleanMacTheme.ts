import { createTheme, type MantineThemeOverride } from "@mantine/core";

export const glass = {
  bg: "rgba(255, 255, 255, 0.08)",
  bgStrong: "rgba(255, 255, 255, 0.12)",
  border: "rgba(255, 255, 255, 0.12)",
  blur: "blur(16px)",
  footerBg: "rgba(15, 23, 42, 0.72)",
} as const;

/** Shared glass-outline tokens for Checkbox, Button, and similar controls. */
export const control = {
  border: "rgba(255, 255, 255, 0.22)",
  bg: "rgba(255, 255, 255, 0.04)",
  bgChecked: "rgba(255, 255, 255, 0.14)",
  check: "#a5b4fc",
  label: "rgba(255, 255, 255, 0.9)",
  disabledOpacity: 0.35,
  buttonBgLight: "rgba(255, 255, 255, 0.14)",
  buttonBgDefault: "rgba(255, 255, 255, 0.05)",
  buttonBorderMuted: "rgba(255, 255, 255, 0.14)",
  buttonBgFilled: "rgba(99, 102, 241, 0.42)",
  buttonBorderFilled: "rgba(129, 140, 248, 0.45)",
  buttonBgFilledRed: "rgba(239, 68, 68, 0.35)",
  buttonHover: "rgba(255, 255, 255, 0.16)",
  focusRing: "rgba(165, 180, 252, 0.45)",
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
    Checkbox: {
      styles: {
        root: {
          "--checkbox-color": control.bgChecked,
          "--checkbox-icon-color": control.check,
        },
        input: {
          backgroundColor: control.bg,
          border: `1px solid ${control.border}`,
          transition: "background-color 120ms ease, border-color 120ms ease",
          "&:checked": {
            borderColor: control.border,
          },
          "&:disabled": {
            opacity: control.disabledOpacity,
            cursor: "not-allowed",
          },
          "&:focus-visible": {
            outline: `2px solid ${control.focusRing}`,
            outlineOffset: 2,
          },
        },
        label: {
          color: control.label,
        },
      },
    },
    Button: {
      styles: {
        root: {
          transition: "background-color 120ms ease, border-color 120ms ease",
          "&[data-variant='subtle']": {
            color: "rgba(255, 255, 255, 0.85)",
            "&:hover:not([data-disabled])": {
              backgroundColor: control.buttonHover,
            },
          },
          "&[data-variant='light']": {
            backgroundColor: control.buttonBgLight,
            border: `1px solid ${glass.border}`,
            color: "rgba(255, 255, 255, 0.95)",
            "&:hover:not([data-disabled])": {
              backgroundColor: control.buttonHover,
            },
          },
          "&[data-variant='default']": {
            backgroundColor: control.buttonBgDefault,
            border: `1px solid ${control.buttonBorderMuted}`,
            color: "rgba(255, 255, 255, 0.82)",
            "&:hover:not([data-disabled])": {
              backgroundColor: control.buttonHover,
              borderColor: glass.border,
            },
          },
          "&[data-variant='filled']": {
            backgroundColor: control.buttonBgFilled,
            border: `1px solid ${control.buttonBorderFilled}`,
            color: "rgba(255, 255, 255, 0.98)",
            "&:hover:not([data-disabled])": {
              backgroundColor: "rgba(99, 102, 241, 0.52)",
            },
          },
          "&[data-variant='filled'][data-color='red']": {
            backgroundColor: control.buttonBgFilledRed,
            border: "1px solid rgba(248, 113, 113, 0.45)",
            color: "rgba(255, 255, 255, 0.98)",
            "&:hover:not([data-disabled])": {
              backgroundColor: "rgba(239, 68, 68, 0.48)",
            },
          },
          "&[data-disabled]": {
            opacity: control.disabledOpacity,
          },
          "&:focus-visible": {
            outline: `2px solid ${control.focusRing}`,
            outlineOffset: 2,
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
