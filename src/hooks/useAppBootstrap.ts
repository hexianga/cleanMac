import { useCallback, useEffect, useState } from "react";
import { getDiskOverview, getSettings } from "../lib/api";
import type { AppSettings, DiskOverview } from "../lib/types";

export function useAppBootstrap(refreshPermissions: () => Promise<unknown>) {
  const [disk, setDisk] = useState<DiskOverview | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  const refreshDisk = useCallback(async () => {
    try {
      const overview = await getDiskOverview();
      setDisk(overview);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    refreshDisk().catch(console.error);
    getSettings().then(setAppSettings).catch(console.error);
    refreshPermissions().catch(console.error);
  }, [refreshDisk, refreshPermissions]);

  useEffect(() => {
    const onFocus = () => {
      refreshPermissions().catch(console.error);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshPermissions]);

  return { disk, appSettings, setAppSettings, refreshDisk };
}
