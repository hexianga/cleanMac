import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";

/** Toggle Web Inspector (⌥⌘I). Requires `devtools` Cargo feature in release builds. */
export function useDevtoolsShortcut() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || !event.altKey || event.key.toLowerCase() !== "i") {
        return;
      }
      event.preventDefault();
      void invoke("toggle_devtools").catch(console.error);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
