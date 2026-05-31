import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell, Container, Stack, Text } from "@mantine/core";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { MacWindowTitleBar, MAC_TITLE_BAR_HEIGHT } from "./components/MacWindowTitleBar";
import { CategoryDetailView } from "./components/CategoryDetailView";
import { DashboardView } from "./components/DashboardView";
import { DeleteConfirmModal } from "./components/DeleteConfirmModal";
import { DetailFooter } from "./components/DetailFooter";
import { PermissionModal } from "./components/PermissionModal";
import { ScanConfirmModal } from "./components/ScanConfirmModal";
import { SettingsPanel } from "./components/SettingsPanel";
import {
  DEFAULT_ONE_CLICK_SCAN_IDS,
  mergeCategories,
  SCANNER_ORDER,
  type ScannerId,
} from "./lib/categoryMeta";
import {
  checkPermissions,
  deleteItems,
  getDiskOverview,
  getScanResults,
  getSettings,
  listenScanProgress,
  startScan,
} from "./lib/api";
import { groupItemsForCategory } from "./lib/groupScanItems";
import { initialScanState, scanErrorMessage, scanStateAfterResult } from "./lib/scanState";
import { isScanWaitAborted, isScannerBusyError } from "./lib/scanErrors";
import { slowScanConfirmFor, SLOW_SCAN_CONFIRM } from "./lib/slowScanConfirmCopy";
import { waitForScansToFinish } from "./lib/waitForScan";
import type {
  AppSettings,
  AppView,
  DiskOverview,
  PermissionStatus,
  ScanCategoryResult,
  ScanProgress,
} from "./lib/types";

function emptySelectedIdsByCategory(): Record<ScannerId, Set<string>> {
  return Object.fromEntries(
    SCANNER_ORDER.map((id) => [id, new Set<string>()]),
  ) as Record<ScannerId, Set<string>>;
}

export default function App() {
  const [disk, setDisk] = useState<DiskOverview | null>(null);
  const [view, setView] = useState<AppView>("dashboard");
  const [detailScannerId, setDetailScannerId] = useState<ScannerId | null>(null);
  const [categories, setCategories] = useState<ScanCategoryResult[]>([]);
  const [scanState, setScanState] = useState(initialScanState);
  const [scanProgressByCategory, setScanProgressByCategory] = useState<
    Partial<Record<ScannerId, ScanProgress>>
  >({});
  const [selectedIdsByCategory, setSelectedIdsByCategory] =
    useState(emptySelectedIdsByCategory);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [slowScanConfirmId, setSlowScanConfirmId] = useState<ScannerId | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const activeWaitControllersRef = useRef<Set<AbortController>>(new Set());

  const mergedCategories = useMemo(
    () => mergeCategories(categories),
    [categories],
  );

  const detailCategory = useMemo(
    () =>
      detailScannerId
        ? mergedCategories.find((c) => c.scannerId === detailScannerId) ?? null
        : null,
    [detailScannerId, mergedCategories],
  );

  const detailSelectedIds = useMemo(() => {
    if (!detailScannerId) {
      return new Set<string>();
    }
    return selectedIdsByCategory[detailScannerId] ?? new Set<string>();
  }, [detailScannerId, selectedIdsByCategory]);

  const refreshPermissions = useCallback(async () => {
    try {
      const status = await checkPermissions();
      setPermissionStatus(status);
      setScanState((s) => {
        if (status.needsTrashAccess) {
          return { ...s, trash: "needs_permission" };
        }
        if (s.trash === "needs_permission") {
          return { ...s, trash: "unscanned" };
        }
        return s;
      });
      return status;
    } catch (permissionError) {
      console.error(permissionError);
      return null;
    }
  }, []);

  const runScan = useCallback(
    async (scannerIds: ScannerId[]) => {
      if (scannerIds.length === 0) {
        return;
      }

      setError(null);
      setScanProgressByCategory((prev) => {
        const next = { ...prev };
        for (const id of scannerIds) {
          delete next[id];
        }
        return next;
      });
      setScanState((s) => {
        const next = { ...s };
        for (const id of scannerIds) {
          if (next[id] === "scanning") {
            continue;
          }
          if (id === "trash" && permissionStatus?.needsTrashAccess) {
            next[id] = "needs_permission";
          } else {
            next[id] = "scanning";
          }
        }
        return next;
      });

      const idsToScan = scannerIds.filter(
        (id) => !(id === "trash" && permissionStatus?.needsTrashAccess),
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
    [permissionStatus],
  );

  useEffect(() => {
    return () => {
      for (const controller of activeWaitControllersRef.current) {
        controller.abort();
      }
      activeWaitControllersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listenScanProgress((progress) => {
      const id = progress.scannerId as ScannerId;
      if (!(SCANNER_ORDER as readonly string[]).includes(id)) {
        return;
      }
      if (progress.phase === "done") {
        setScanProgressByCategory((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return;
      }
      setScanProgressByCategory((prev) => ({ ...prev, [id]: progress }));
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

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

  const selectedCount = detailSelectedIds.size;
  const selectedBytes = useMemo(() => {
    if (!detailCategory) {
      return 0;
    }
    let total = 0;
    for (const item of detailCategory.items) {
      if (detailSelectedIds.has(item.id)) {
        total += item.sizeBytes;
      }
    }
    return total;
  }, [detailCategory, detailSelectedIds]);

  const deleteConfirmGroups = useMemo(() => {
    if (!detailCategory || selectedCount === 0) {
      return [];
    }

    return groupItemsForCategory(detailCategory.scannerId, detailCategory.items)
      .map((group) => {
        const items = group.items.filter((item) => detailSelectedIds.has(item.id));
        return {
          ...group,
          items,
          totalBytes: items.reduce((sum, item) => sum + item.sizeBytes, 0),
        };
      })
      .filter((group) => group.items.length > 0);
  }, [detailCategory, detailSelectedIds, selectedCount]);

  const handleScanCategory = useCallback(
    (scannerId: ScannerId) => {
      if (scannerId === "trash" && permissionStatus?.needsTrashAccess) {
        setPermissionModalOpen(true);
        return;
      }
      if (slowScanConfirmFor(scannerId)) {
        setSlowScanConfirmId(scannerId);
        return;
      }
      void runScan([scannerId]);
    },
    [permissionStatus?.needsTrashAccess, runScan],
  );

  const handleConfirmSlowScan = useCallback(() => {
    if (!slowScanConfirmId) {
      return;
    }
    const scannerId = slowScanConfirmId;
    setSlowScanConfirmId(null);
    void runScan([scannerId]);
  }, [runScan, slowScanConfirmId]);

  const handleScanAll = useCallback(() => {
    const ids = (
      appSettings?.oneClickScanIds?.length
        ? appSettings.oneClickScanIds
        : DEFAULT_ONE_CLICK_SCAN_IDS
    ) as ScannerId[];
    void runScan(ids);
  }, [appSettings, runScan]);

  const handleOpenCategory = useCallback((scannerId: ScannerId) => {
    setDetailScannerId(scannerId);
    setView("detail");
  }, []);

  const handleBackToDashboard = useCallback(() => {
    setView("dashboard");
    setDetailScannerId(null);
  }, []);

  const handleToggleItem = useCallback(
    (itemId: string, checked: boolean) => {
      if (!detailScannerId) {
        return;
      }
      setSelectedIdsByCategory((current) => {
        const next = { ...current };
        const set = new Set(current[detailScannerId]);
        if (checked) {
          set.add(itemId);
        } else {
          set.delete(itemId);
        }
        next[detailScannerId] = set;
        return next;
      });
    },
    [detailScannerId],
  );

  const handleSetDuplicateKeeper = useCallback(
    (groupItemIds: string[], keeperId: string) => {
      if (!detailScannerId) {
        return;
      }
      setSelectedIdsByCategory((current) => {
        const next = { ...current };
        const set = new Set(current[detailScannerId]);
        for (const id of groupItemIds) {
          if (id === keeperId) {
            set.delete(id);
          } else {
            set.add(id);
          }
        }
        next[detailScannerId] = set;
        return next;
      });
    },
    [detailScannerId],
  );

  const handleSelectAllDeletable = useCallback(() => {
    if (!detailCategory || !detailScannerId) {
      return;
    }
    setSelectedIdsByCategory((current) => {
      const next = { ...current };
      const set = new Set(current[detailScannerId]);
      for (const item of detailCategory.items) {
        if (item.deletable) {
          set.add(item.id);
        }
      }
      next[detailScannerId] = set;
      return next;
    });
  }, [detailCategory, detailScannerId]);

  const handleDeselectAllInCategory = useCallback(() => {
    if (!detailScannerId) {
      return;
    }
    setSelectedIdsByCategory((current) => ({
      ...current,
      [detailScannerId]: new Set<string>(),
    }));
  }, [detailScannerId]);

  const handleOpenDeleteConfirm = useCallback(() => {
    if (selectedCount === 0) {
      return;
    }
    setDeleteConfirmOpen(true);
  }, [selectedCount]);

  const handleConfirmDelete = useCallback(async () => {
    if (!detailScannerId || selectedCount === 0) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      const results = await deleteItems(Array.from(detailSelectedIds));
      const failed = results.filter((result) => !result.success);
      const succeeded = results.filter((result) => result.success);

      if (failed.length > 0) {
        const detail =
          failed.length === results.length
            ? (failed[0]?.error ?? "未知错误")
            : `${failed.length}/${results.length} 项`;
        setError(`删除失败（${detail}）`);
      } else {
        setError(null);
      }

      if (succeeded.length > 0) {
        setSelectedIdsByCategory((current) => {
          const next = { ...current };
          const set = new Set(current[detailScannerId]);
          for (const result of succeeded) {
            set.delete(result.itemId);
          }
          next[detailScannerId] = set;
          return next;
        });
        setDeleteConfirmOpen(false);
        await runScan([detailScannerId]);
      }
    } catch (deleteError) {
      setError(String(deleteError));
    } finally {
      setDeleting(false);
    }
  }, [detailScannerId, detailSelectedIds, runScan, selectedCount]);

  const showDetailFooter = view === "detail" && detailCategory !== null;

  return (
    <AppShell
      padding="md"
      footer={
        showDetailFooter
          ? {
              height: 72,
              offset: false,
            }
          : undefined
      }
    >
      <AnimatedBackground />
      <MacWindowTitleBar />
      <AppShell.Main
        pt={`calc(${MAC_TITLE_BAR_HEIGHT}px + var(--mantine-spacing-md))`}
        pb={showDetailFooter ? 88 : undefined}
        style={{ position: "relative", zIndex: 1, background: "transparent" }}
      >
        <Container fluid px="md" py="md">
          <Stack gap="md">
            {view === "dashboard" && (
              <DashboardView
                disk={disk}
                categories={categories}
                scanState={scanState}
                scanProgressByCategory={scanProgressByCategory}
                selectedIdsByCategory={selectedIdsByCategory}
                onOpenCategory={handleOpenCategory}
                onScanCategory={handleScanCategory}
                onScanAll={handleScanAll}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            )}

            {view === "detail" && detailCategory && (
              <CategoryDetailView
                category={detailCategory}
                selectedIds={detailSelectedIds}
                onBack={handleBackToDashboard}
                onToggleItem={handleToggleItem}
                onSelectAllDeletable={handleSelectAllDeletable}
                onDeselectAllInCategory={handleDeselectAllInCategory}
                onSetDuplicateKeeper={handleSetDuplicateKeeper}
              />
            )}

            {error && (
              <Text c="red" size="sm">
                {error}
              </Text>
            )}
          </Stack>
        </Container>
      </AppShell.Main>

      {showDetailFooter && (
        <AppShell.Footer>
          <DetailFooter
            selectedCount={selectedCount}
            selectedBytes={selectedBytes}
            deleting={deleting}
            onClean={handleOpenDeleteConfirm}
          />
        </AppShell.Footer>
      )}

      <SettingsPanel
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={setAppSettings}
      />

      <DeleteConfirmModal
        opened={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        confirming={deleting}
        categoryName={detailCategory?.name ?? ""}
        groups={deleteConfirmGroups}
      />

      <PermissionModal
        opened={permissionModalOpen}
        onClose={() => setPermissionModalOpen(false)}
        variant="trash"
      />

      <ScanConfirmModal
        opened={slowScanConfirmId !== null}
        onClose={() => setSlowScanConfirmId(null)}
        onConfirm={handleConfirmSlowScan}
        copy={
          (slowScanConfirmId && slowScanConfirmFor(slowScanConfirmId)) ||
          SLOW_SCAN_CONFIRM.large_files!
        }
      />
    </AppShell>
  );
}
