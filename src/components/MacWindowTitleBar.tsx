import { Box, Text } from "@mantine/core";
import { APP_DISPLAY_NAME } from "../lib/appIdentity";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, type MouseEvent } from "react";

/** macOS overlay title-bar strip — keep in sync with AppShell.Main padding-top. */
export const MAC_TITLE_BAR_HEIGHT = 34;

const DRAG_DELAY_MS = 160;

const noSelectStyle = {
  userSelect: "none" as const,
  WebkitUserSelect: "none" as const,
};

/** Centered title in the macOS title-bar strip (requires hiddenTitle + Overlay in tauri.conf). */
export function MacWindowTitleBar() {
  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDragTimeout = useCallback(() => {
    if (dragTimeoutRef.current !== null) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearDragTimeout(), [clearDragTimeout]);

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    clearDragTimeout();
    void getCurrentWindow().toggleMaximize().catch(console.error);
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    clearDragTimeout();
    dragTimeoutRef.current = setTimeout(() => {
      dragTimeoutRef.current = null;
      void getCurrentWindow().startDragging().catch(console.error);
    }, DRAG_DELAY_MS);
  };

  return (
    <Box
      pos="fixed"
      top={0}
      left={0}
      right={0}
      h={MAC_TITLE_BAR_HEIGHT}
      onMouseDown={handleMouseDown}
      onMouseUp={clearDragTimeout}
      onMouseLeave={clearDragTimeout}
      onDoubleClick={handleDoubleClick}
      style={{
        zIndex: 200,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 8,
        pointerEvents: "auto",
        cursor: "default",
        ...noSelectStyle,
      }}
    >
      <Text
        fw={600}
        component="span"
        style={{
          color: "rgba(255, 255, 255, 0.95)",
          fontSize: 13,
          lineHeight: 1,
          pointerEvents: "none",
          ...noSelectStyle,
        }}
      >
        {APP_DISPLAY_NAME}
      </Text>
    </Box>
  );
}
