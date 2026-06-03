import { useCallback, useEffect, useRef, useState } from "react";
import {
  ALL_SCANNER_IDS,
  DEFAULT_ONE_CLICK_SCAN_IDS,
  isClassificationScannerId,
  type ScannerId,
} from "../lib/categoryMeta";
import {
  checkPermissions,
  devScanCacheExists,
  getScanResults,
  readDevScanCache,
  startScan,
} from "../lib/api";
import { FILE_TYPE_ONE_CLICK_IDS, type HomeTab } from "../lib/homeTab";
import type { PermissionCopyVariant } from "../lib/permissionCopy";
import { permissionVariantForScanner } from "../lib/permissionWarnings";
import { initialScanState, scanErrorMessage, scanStateAfterResult } from "../lib/scanState";
import { isScanWaitAborted, isScannerBusyError } from "../lib/scanErrors";
import { waitForScansToFinish } from "../lib/waitForScan";
import type {
  AppSettings,
  PermissionStatus,
  ScanCategoryResult,
} from "../lib/types";

function emptySelectedIdsByCategory(): Record<ScannerId, Set<string>> {
  return Object.fromEntries(
    ALL_SCANNER_IDS.map((id) => [id, new Set<string>()]),
  ) as Record<ScannerId, Set<string>>;
}

function scannerBlockedByPermission(
  id: ScannerId,
  permissionStatus: PermissionStatus | null,
): boolean {
  if (!permissionStatus) {
    return false;
  }
  if (id === "trash") {
    return permissionStatus.needsTrashAccess;
  }
  if (id === "downloads") {
    return permissionStatus.needsDownloadsAccess;
  }
  return false;
}

export function useScanSession(hooks?: {
  onPermissionRequired?: (variant: PermissionCopyVariant) => void;
}) {
  const onPermissionRequired = hooks?.onPermissionRequired;
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus | null>(null);
  const [categories, setCategories] = useState<ScanCategoryResult[]>([]);
  const [scanState, setScanState] = useState(initialScanState);
  const [selectedIdsByCategory, setSelectedIdsByCategory] = useState(
    emptySelectedIdsByCategory,
  );
  const [error, setError] = useState<string | null>(null);
  const [devCacheAvailable, setDevCacheAvailable] = useState<
    Partial<Record<ScannerId, boolean>>
  >({});
  const activeWaitControllersRef = useRef<Set<AbortController>>(new Set());

  const refreshDevCacheAvailability = useCallback(() => {
    if (!import.meta.env.DEV) {
      return;
    }
    devScanCacheExists("file_image")
      .then((exists) => setDevCacheAvailable({ file_image: exists }))
      .catch(console.error);
  }, []);

  useEffect(() => {
    refreshDevCacheAvailability();
  }, [refreshDevCacheAvailability]);

  const runScan = useCallback(
    async (scannerIds: ScannerId[]) => {
      if (scannerIds.length === 0) {
        return;
      }

      setError(null);
      setScanState((s) => {
        const next = { ...s };
        for (const id of scannerIds) {
          if (next[id] === "scanning") {
            continue;
          }
          if (scannerBlockedByPermission(id, permissionStatus)) {
            next[id] = "needs_permission";
          } else {
            next[id] = "scanning";
          }
        }
        return next;
      });

      const blocked = scannerIds.filter((id) =>
        scannerBlockedByPermission(id, permissionStatus),
      );
      if (blocked.length > 0) {
        onPermissionRequired?.(permissionVariantForScanner(blocked[0]!));
      }

      const idsToScan = scannerIds.filter(
        (id) => !scannerBlockedByPermission(id, permissionStatus),
      );
      if (idsToScan.length === 0) {
        return;
      }

      const abort = new AbortController();
      activeWaitControllersRef.current.add(abort);

      try {
        try {
          await startScan(idsToScan);
        } catch (startError) {
          if (!isScannerBusyError(startError)) {
            throw startError;
          }
        }

        await waitForScansToFinish(idsToScan, abort.signal);

        const results = await getScanResults();
        if (!results) {
          throw new Error("扫描未返回结果");
        }

        setCategories(results);
        setScanState((s) => {
          const next = { ...s };
          for (const id of idsToScan) {
            const cat = results.find((c) => c.scannerId === id);
            next[id] = scanStateAfterResult(id, cat, permissionStatus);
          }
          return next;
        });

        const permissionIds = idsToScan.filter((id) => {
          const cat = results.find((c) => c.scannerId === id);
          return (
            scanStateAfterResult(id, cat, permissionStatus) === "needs_permission"
          );
        });
        if (permissionIds.length > 0) {
          onPermissionRequired?.(permissionVariantForScanner(permissionIds[0]!));
        } else {
          const firstError = idsToScan
            .map((id) => results.find((c) => c.scannerId === id))
            .find(
              (cat, index) =>
                cat &&
                scanStateAfterResult(
                  idsToScan[index]!,
                  cat,
                  permissionStatus,
                ) === "error",
            );
          if (firstError) {
            setError(scanErrorMessage(firstError) ?? "扫描失败");
          }
        }

        setSelectedIdsByCategory((prev) => {
          const next = { ...prev };
          for (const id of idsToScan) {
            const cat = results.find((c) => c.scannerId === id);
            if (!cat) {
              continue;
            }
            if (scanStateAfterResult(id, cat, permissionStatus) !== "scanned") {
              continue;
            }
            const set = new Set<string>();
            for (const item of cat.items) {
              if (item.selectedByDefault && item.deletable) {
                set.add(item.id);
              }
            }
            next[id] = set;
          }
          return next;
        });
      } catch (startError) {
        if (abort.signal.aborted || isScanWaitAborted(startError)) {
          return;
        }
        setError(String(startError));
        setScanState((s) => {
          const next = { ...s };
          for (const id of idsToScan) {
            if (next[id] === "scanning") {
              next[id] = "error";
            }
          }
          return next;
        });
      } finally {
        activeWaitControllersRef.current.delete(abort);
      }
    },
    [onPermissionRequired, permissionStatus],
  );

  useEffect(() => {
    return () => {
      for (const controller of activeWaitControllersRef.current) {
        controller.abort();
      }
      activeWaitControllersRef.current.clear();
    };
  }, []);

  const refreshPermissions = useCallback(async () => {
    try {
      const status = await checkPermissions();
      setPermissionStatus(status);
      setScanState((s) => {
        let next = { ...s };
        if (status.needsTrashAccess) {
          next = { ...next, trash: "needs_permission" };
        } else if (next.trash === "needs_permission") {
          next = { ...next, trash: "unscanned" };
        }
        if (status.needsDownloadsAccess) {
          next = { ...next, downloads: "needs_permission" };
        } else if (next.downloads === "needs_permission") {
          next = { ...next, downloads: "unscanned" };
        }
        return next;
      });
      return status;
    } catch (permissionError) {
      console.error(permissionError);
      return null;
    }
  }, []);

  const loadDevScanCache = useCallback(async (scannerId: ScannerId): Promise<boolean> => {
    try {
      const category = await readDevScanCache(scannerId);
      setCategories((prev) => {
        const rest = prev.filter((c) => c.scannerId !== scannerId);
        return [...rest, category];
      });
      setScanState((s) => ({ ...s, [scannerId]: "scanned" }));
      setSelectedIdsByCategory((prev) => {
        const set = new Set<string>();
        for (const item of category.items) {
          if (item.selectedByDefault && item.deletable) {
            set.add(item.id);
          }
        }
        return { ...prev, [scannerId]: set };
      });
      setDevCacheAvailable((prev) => ({ ...prev, [scannerId]: true }));
      setError(null);
      return true;
    } catch (loadError) {
      console.error(loadError);
      setError(String(loadError));
      return false;
    }
  }, []);

  const handleScanAll = useCallback(
    (appSettings: AppSettings | null, activeTab: HomeTab) => {
      if (activeTab === "file_type") {
        void runScan([...FILE_TYPE_ONE_CLICK_IDS]);
        return;
      }

      const rawIds =
        appSettings?.oneClickScanIds?.length
          ? appSettings.oneClickScanIds
          : DEFAULT_ONE_CLICK_SCAN_IDS;

      const ids = rawIds.filter(isClassificationScannerId) as ScannerId[];
      void runScan(ids.length > 0 ? ids : [...DEFAULT_ONE_CLICK_SCAN_IDS]);
    },
    [runScan],
  );

  return {
    permissionStatus,
    refreshPermissions,
    categories,
    scanState,
    selectedIdsByCategory,
    setSelectedIdsByCategory,
    devCacheAvailable,
    error,
    setError,
    runScan,
    loadDevScanCache,
    refreshDevCacheAvailability,
    handleScanAll,
  };
}
