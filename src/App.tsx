import { useEffect, useRef, useState } from "react";
import { Box, Text } from "@mantine/core";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { MacWindowTitleBar, MAC_TITLE_BAR_HEIGHT } from "./components/MacWindowTitleBar";
import { CategoryDetailView } from "./components/CategoryDetailView";
import { DashboardView } from "./components/DashboardView";
import { DeleteConfirmModal } from "./components/DeleteConfirmModal";
import { DetailFooter } from "./components/DetailFooter";
import { HomeSidebar } from "./components/HomeSidebar";
import { PermissionModal } from "./components/PermissionModal";
import { ScanConfirmModal } from "./components/ScanConfirmModal";
import { SettingsPanel } from "./components/SettingsPanel";
import { useAppBootstrap } from "./hooks/useAppBootstrap";
import { useDetailView } from "./hooks/useDetailView";
import { useDevtoolsShortcut } from "./hooks/useDevtoolsShortcut";
import { useScanSession } from "./hooks/useScanSession";
import { cacheDeleteHint } from "./lib/cacheImpactCopy";
import type { HomeTab } from "./lib/homeTab";
import { DETAIL_FOOTER_HEIGHT_PX, SIDEBAR_WIDTH_PX } from "./lib/layoutConstants";
import { glass } from "./lib/cleanMacTheme";
import type { PermissionCopyVariant } from "./lib/permissionCopy";
import { slowScanConfirmFor, SLOW_SCAN_CONFIRM } from "./lib/slowScanConfirmCopy";

export default function App() {
  useDevtoolsShortcut();

  // Mantine Modal lockScroll can leave body padding in Tauri WebView after close.
  useEffect(() => {
    document.body.style.paddingRight = "";
  }, []);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [permissionModalVariant, setPermissionModalVariant] =
    useState<PermissionCopyVariant>("fullDisk");
  const [activeHomeTab, setActiveHomeTab] = useState<HomeTab>(
    import.meta.env.DEV ? "file_type" : "classification",
  );
  const detailScrollRef = useRef<HTMLDivElement>(null);

  const openPermissionModal = (variant: PermissionCopyVariant) => {
    setPermissionModalVariant(variant);
    setPermissionModalOpen(true);
  };

  const {
    permissionStatus,
    refreshPermissions,
    categories,
    scanState,
    selectedIdsByCategory,
    setSelectedIdsByCategory,
    error,
    setError,
    devCacheAvailable,
    runScan,
    loadDevScanCache,
    handleScanAll,
  } = useScanSession({ onPermissionRequired: openPermissionModal });

  const { disk, appSettings, setAppSettings, refreshDisk } =
    useAppBootstrap(refreshPermissions);

  const detail = useDetailView(
    categories,
    selectedIdsByCategory,
    setSelectedIdsByCategory,
    permissionStatus,
    runScan,
    setError,
    openPermissionModal,
    refreshDisk,
    loadDevScanCache,
    devCacheAvailable,
  );

  const handleHomeTabChange = (tab: HomeTab) => {
    if (detail.view === "detail") {
      detail.handleBackToDashboard();
    }
    setActiveHomeTab(tab);
  };

  return (
    <Box
      className="app-root"
      style={{
        height: "100%",
        position: "relative",
        overflow: "hidden",
        ["--app-title-bar-height" as string]: `${MAC_TITLE_BAR_HEIGHT}px`,
        ["--app-sidebar-width" as string]: `${SIDEBAR_WIDTH_PX}px`,
      }}
    >
      <AnimatedBackground />
      <MacWindowTitleBar />

      <Box
        className="app-frame"
        style={{
          position: "relative",
          zIndex: 1,
          boxSizing: "border-box",
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "row",
          gap: "var(--mantine-spacing-md)",
          padding: "var(--mantine-spacing-md)",
          paddingTop: `calc(${MAC_TITLE_BAR_HEIGHT}px + var(--mantine-spacing-md))`,
        }}
      >
        <Box
          component="nav"
          aria-label="主导航"
          style={{
            width: SIDEBAR_WIDTH_PX,
            flexShrink: 0,
            minHeight: 0,
          }}
        >
          <HomeSidebar activeTab={activeHomeTab} onTabChange={handleHomeTabChange} />
        </Box>

        <Box
          component="main"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {detail.view === "dashboard" && (
            <Box
              px="md"
              py="md"
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <DashboardView
                activeHomeTab={activeHomeTab}
                disk={disk}
                categories={categories}
                scanState={scanState}
                selectedIdsByCategory={selectedIdsByCategory}
                devCacheAvailable={devCacheAvailable}
                onOpenCategory={detail.handleOpenCategory}
                onScanCategory={detail.handleScanCategory}
                onScanAll={() => handleScanAll(appSettings, activeHomeTab)}
                onOpenSettings={() => setSettingsOpen(true)}
              />
              {error ? (
                <Text c="red" size="sm" mt="md" style={{ flexShrink: 0 }}>
                  {error}
                </Text>
              ) : null}
            </Box>
          )}

          {detail.view === "detail" && detail.detailCategory && (
            <Box
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box
                ref={detailScrollRef}
                className="app-main-scroll no-overscroll"
                px="md"
                py="md"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflow: "auto",
                }}
              >
                <CategoryDetailView
                  category={detail.detailCategory}
                  selectedIds={detail.detailSelectedIds}
                  scrollRef={detailScrollRef}
                  onBack={detail.handleBackToDashboard}
                  onToggleItem={detail.handleToggleItem}
                  onSelectAllDeletable={detail.handleSelectAllDeletable}
                  onDeselectAllInCategory={detail.handleDeselectAllInCategory}
                />
              </Box>
              {detail.showDetailFooter ? (
                <Box
                  style={{
                    flexShrink: 0,
                    height: DETAIL_FOOTER_HEIGHT_PX,
                    boxSizing: "border-box",
                    borderTop: `1px solid ${glass.border}`,
                    background: glass.footerBg,
                    backdropFilter: glass.blur,
                  }}
                >
                  <DetailFooter
                    selectedCount={detail.selectedCount}
                    selectedBytes={detail.selectedBytes}
                    deleting={detail.deleting}
                    onClean={detail.handleOpenDeleteConfirm}
                  />
                </Box>
              ) : null}
            </Box>
          )}
        </Box>
      </Box>

      <SettingsPanel
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={setAppSettings}
      />

      <DeleteConfirmModal
        opened={detail.deleteConfirmOpen}
        onClose={() => detail.setDeleteConfirmOpen(false)}
        onConfirm={detail.handleConfirmDelete}
        confirming={detail.deleting}
        categoryName={detail.detailCategory?.name ?? ""}
        groups={detail.deleteConfirmGroups}
        extraWarning={
          detail.detailCategory
            ? cacheDeleteHint(detail.detailCategory.scannerId)
            : undefined
        }
      />

      <PermissionModal
        opened={permissionModalOpen}
        onClose={() => setPermissionModalOpen(false)}
        variant={permissionModalVariant}
      />

      <ScanConfirmModal
        opened={detail.slowScanConfirmId !== null}
        onClose={() => detail.setSlowScanConfirmId(null)}
        onConfirm={detail.handleConfirmSlowScan}
        copy={
          (detail.slowScanConfirmId && slowScanConfirmFor(detail.slowScanConfirmId)) ||
          SLOW_SCAN_CONFIRM.large_files!
        }
      />
    </Box>
  );
}
