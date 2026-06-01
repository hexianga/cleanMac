import { useEffect, useState } from "react";
import { AppShell, Box, Container, Text } from "@mantine/core";
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
import { useScanSession } from "./hooks/useScanSession";
import { cacheDeleteHint } from "./lib/cacheImpactCopy";
import type { HomeTab } from "./lib/homeTab";
import { DETAIL_FOOTER_HEIGHT_PX, SIDEBAR_WIDTH_PX } from "./lib/layoutConstants";
import { glass } from "./lib/cleanMacTheme";
import type { PermissionCopyVariant } from "./lib/permissionCopy";
import { slowScanConfirmFor, SLOW_SCAN_CONFIRM } from "./lib/slowScanConfirmCopy";

export default function App() {
  // Mantine Modal lockScroll can leave body padding in Tauri WebView after close.
  useEffect(() => {
    document.body.style.paddingRight = "";
  }, []);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [permissionModalVariant, setPermissionModalVariant] =
    useState<PermissionCopyVariant>("fullDisk");
  const [activeHomeTab, setActiveHomeTab] = useState<HomeTab>("classification");

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
    runScan,
    handleScanAll,
  } = useScanSession({ onPermissionRequired: openPermissionModal });

  const { disk, appSettings, setAppSettings } = useAppBootstrap(refreshPermissions);

  const detail = useDetailView(
    categories,
    selectedIdsByCategory,
    setSelectedIdsByCategory,
    permissionStatus,
    runScan,
    setError,
    openPermissionModal,
  );

  const handleHomeTabChange = (tab: HomeTab) => {
    if (detail.view === "detail") {
      detail.handleBackToDashboard();
    }
    setActiveHomeTab(tab);
  };

  return (
    <AppShell
      padding="md"
      navbar={{ width: SIDEBAR_WIDTH_PX, breakpoint: "sm" }}
      style={{
        height: "100%",
        ["--app-title-bar-height" as string]: `${MAC_TITLE_BAR_HEIGHT}px`,
        ["--app-sidebar-width" as string]: `${SIDEBAR_WIDTH_PX}px`,
      }}
    >
      <AnimatedBackground />
      <MacWindowTitleBar />
      <AppShell.Navbar
        pt={`calc(${MAC_TITLE_BAR_HEIGHT}px + var(--mantine-spacing-md))`}
        style={{ background: "transparent", borderRight: "none" }}
      >
        <HomeSidebar activeTab={activeHomeTab} onTabChange={handleHomeTabChange} />
      </AppShell.Navbar>
      <AppShell.Main
        pt={`calc(${MAC_TITLE_BAR_HEIGHT}px + var(--mantine-spacing-md))`}
        style={{
          position: "relative",
          zIndex: 1,
          background: "transparent",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <Container
          fluid
          px={0}
          py={0}
          maw="100%"
          w="100%"
          style={{
            flex: 1,
            minHeight: 0,
            height: "100%",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
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
              className="detail-viewport no-overscroll"
              style={{
                ["--detail-footer-offset" as string]: detail.showDetailFooter
                  ? `${DETAIL_FOOTER_HEIGHT_PX + 8}px`
                  : "0px",
              }}
            >
              <CategoryDetailView
                category={detail.detailCategory}
                selectedIds={detail.detailSelectedIds}
                onBack={detail.handleBackToDashboard}
                onToggleItem={detail.handleToggleItem}
                onSelectAllDeletable={detail.handleSelectAllDeletable}
                onDeselectAllInCategory={detail.handleDeselectAllInCategory}
              />
            </Box>
          )}
        </Container>
      </AppShell.Main>

      {detail.showDetailFooter && (
        <Box
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            height: DETAIL_FOOTER_HEIGHT_PX,
            zIndex: 10,
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
      )}

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
    </AppShell>
  );
}
