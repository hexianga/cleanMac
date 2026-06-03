import { useCallback, useMemo, useState } from "react";
import { mergeCategories, type ScannerId } from "../lib/categoryMeta";
import { deleteItems, devScanCacheExists } from "../lib/api";
import { groupItemsForCategory } from "../lib/groupScanItems";
import type { PermissionCopyVariant } from "../lib/permissionCopy";
import { slowScanConfirmFor } from "../lib/slowScanConfirmCopy";
import type {
  AppView,
  PermissionStatus,
  ScanCategoryResult,
} from "../lib/types";

export function useDetailView(
  categories: ScanCategoryResult[],
  selectedIdsByCategory: Record<ScannerId, Set<string>>,
  setSelectedIdsByCategory: React.Dispatch<
    React.SetStateAction<Record<ScannerId, Set<string>>>
  >,
  permissionStatus: PermissionStatus | null,
  runScan: (scannerIds: ScannerId[]) => Promise<void>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  onPermissionRequired: (variant: PermissionCopyVariant) => void,
  refreshDisk: () => Promise<void>,
  loadDevScanCache: (scannerId: ScannerId) => Promise<boolean>,
) {
  const [view, setView] = useState<AppView>("dashboard");
  const [detailScannerId, setDetailScannerId] = useState<ScannerId | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [slowScanConfirmId, setSlowScanConfirmId] = useState<ScannerId | null>(null);

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
        onPermissionRequired("trash");
        return;
      }
      if (scannerId === "downloads" && permissionStatus?.needsDownloadsAccess) {
        onPermissionRequired("downloads");
        return;
      }
      if (slowScanConfirmFor(scannerId)) {
        setSlowScanConfirmId(scannerId);
        return;
      }
      void runScan([scannerId]);
    },
    [
      onPermissionRequired,
      permissionStatus?.needsDownloadsAccess,
      permissionStatus?.needsTrashAccess,
      runScan,
    ],
  );

  const handleConfirmSlowScan = useCallback(() => {
    if (!slowScanConfirmId) {
      return;
    }
    const scannerId = slowScanConfirmId;
    setSlowScanConfirmId(null);
    void runScan([scannerId]);
  }, [runScan, slowScanConfirmId]);

  const handleOpenCategory = useCallback(
    (scannerId: ScannerId) => {
      const open = () => {
        setDetailScannerId(scannerId);
        setView("detail");
      };

      if (import.meta.env.DEV && scannerId === "file_image") {
        void devScanCacheExists(scannerId)
          .then((exists) => (exists ? loadDevScanCache(scannerId) : false))
          .finally(open);
        return;
      }

      open();
    },
    [loadDevScanCache],
  );

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
    [detailScannerId, setSelectedIdsByCategory],
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
  }, [detailCategory, detailScannerId, setSelectedIdsByCategory]);

  const handleDeselectAllInCategory = useCallback(() => {
    if (!detailScannerId) {
      return;
    }
    setSelectedIdsByCategory((current) => ({
      ...current,
      [detailScannerId]: new Set<string>(),
    }));
  }, [detailScannerId, setSelectedIdsByCategory]);

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
        await Promise.all([
          refreshDisk(),
          runScan([detailScannerId]),
        ]);
      }
    } catch (deleteError) {
      setError(String(deleteError));
    } finally {
      setDeleting(false);
    }
  }, [
    detailScannerId,
    detailSelectedIds,
    refreshDisk,
    runScan,
    selectedCount,
    setError,
    setSelectedIdsByCategory,
  ]);

  const showDetailFooter = view === "detail" && detailCategory !== null;

  return {
    view,
    detailCategory,
    detailSelectedIds,
    selectedCount,
    selectedBytes,
    deleteConfirmGroups,
    deleting,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    slowScanConfirmId,
    setSlowScanConfirmId,
    showDetailFooter,
    handleScanCategory,
    handleConfirmSlowScan,
    handleOpenCategory,
    handleBackToDashboard,
    handleToggleItem,
    handleSelectAllDeletable,
    handleDeselectAllInCategory,
    handleOpenDeleteConfirm,
    handleConfirmDelete,
  };
}
