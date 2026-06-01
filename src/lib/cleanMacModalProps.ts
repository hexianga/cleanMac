import type { ModalProps } from "@mantine/core";

/** Shared Modal behavior for CleanMac dialogs (permission, scan confirm, etc.) */
export const cleanMacModalProps: Pick<
  ModalProps,
  "centered" | "withCloseButton" | "lockScroll" | "transitionProps" | "overlayProps"
> = {
  centered: true,
  withCloseButton: false,
  // Tauri WebView: avoid body padding-right that shifts the dashboard layout
  lockScroll: false,
  transitionProps: { transition: "fade-down", duration: 200, timingFunction: "ease" },
  overlayProps: { backgroundOpacity: 0.55, blur: 3 },
};
