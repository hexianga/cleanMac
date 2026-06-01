import { useEffect, useState } from "react";
import { getDiskOverview, getSettings } from "../lib/api";
import type { AppSettings, DiskOverview } from "../lib/types";

export function useAppBootstrap(refreshPermissions: () => Promise<unknown>) {
  const [disk, setDisk] = useState<DiskOverview | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    getDiskOverview().then(setDisk).catch(console.error);
    getSettings().then(setAppSettings).catch(console.error);
    refreshPermissions().catch(console.error);
  }, [refreshPermissions]);

  useEffect(() => {
    const onFocus = () => {
      refreshPermissions().catch(console.error);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshPermissions]);

  return { disk, appSettings, setAppSettings };
}
