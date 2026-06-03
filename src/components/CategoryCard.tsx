import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { SCANNER_META, type ScannerId } from "../lib/categoryMeta";
import {
  categoryCardMainValue,
  categoryCardSubText,
} from "../lib/categoryCardCopy";
import { glass } from "../lib/cleanMacTheme";
import type { CategoryScanState, ScanCategoryResult } from "../lib/types";

interface CategoryCardProps {
  scannerId: ScannerId;
  category: ScanCategoryResult | null;
  scanState: CategoryScanState;
  selectedCount: number;
  devCacheAvailable?: boolean;
  onScan: (scannerId: ScannerId) => void;
  onOpen: (scannerId: ScannerId) => void;
  onShowCacheImpact?: () => void;
}

export function CategoryCard({
  scannerId,
  category,
  scanState,
  selectedCount,
  devCacheAvailable = false,
  onScan,
  onOpen,
  onShowCacheImpact,
}: CategoryCardProps) {
  const meta = SCANNER_META[scannerId];
  const Icon = meta.icon;
  const itemCount = category?.items.length ?? 0;
  const hasItems = itemCount > 0;
  const isDevFileImage = import.meta.env.DEV && scannerId === "file_image";
  const isScanning = scanState === "scanning";
  const canOpen = isDevFileImage
    ? !isScanning
    : scanState === "scanned" || devCacheAvailable;
  const needsPermission = scanState === "needs_permission";
  const isUnscanned = scanState === "unscanned";
  const showBadge = selectedCount > 0 && scanState === "scanned";

  const scanButtonLabel =
    isDevFileImage && devCacheAvailable
      ? "重载缓存"
      : scanState === "error"
        ? "重试"
        : hasItems || !isUnscanned
          ? "重扫"
          : "扫描";
  const scanButtonDisabled =
    isScanning ||
    (needsPermission &&
      scannerId !== "trash" &&
      scannerId !== "downloads" &&
      scannerId !== "applications");

  const mainValue = categoryCardMainValue(scanState, category?.totalBytes ?? 0);
  const subText = categoryCardSubText(
    scanState,
    itemCount,
    scannerId,
    devCacheAvailable,
  );

  const handleCardClick = () => {
    if (canOpen) {
      onOpen(scannerId);
    }
  };

  return (
    <Paper
      radius="md"
      px="sm"
      py="lg"
      w="100%"
      h="100%"
      onClick={canOpen ? handleCardClick : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        cursor: canOpen ? "pointer" : "default",
        background: glass.bg,
        backdropFilter: glass.blur,
        border: `1px solid ${glass.border}`,
        transition: "box-shadow 150ms ease, transform 150ms ease",
        opacity:
          canOpen || isScanning || needsPermission || scanState === "error" || isUnscanned
            ? 1
            : 0.85,
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.35)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.boxShadow = "none";
      }}
    >
      <Group align="flex-start" gap="sm" wrap="nowrap" w="100%">
        <ThemeIcon size={40} radius="xl" color={meta.color} variant="light">
          <Icon size={22} stroke={1.6} />
        </ThemeIcon>
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group
            align="flex-start"
            justify="space-between"
            wrap="nowrap"
            gap="sm"
            w="100%"
          >
            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
              <Text fw={600} size="sm" lineClamp={1}>
                {meta.name}
              </Text>
              <Box
                style={{
                  minHeight: 24,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {mainValue !== null ? (
                  <Text size="lg" fw={700} lh={1.2}>
                    {mainValue}
                  </Text>
                ) : isScanning ? (
                  <Text size="sm" c="dimmed">
                    —
                  </Text>
                ) : null}
              </Box>
            </Stack>
            <Button
              size="xs"
              variant="light"
              disabled={scanButtonDisabled}
              onClick={(event) => {
                event.stopPropagation();
                onScan(scannerId);
              }}
              style={{ flexShrink: 0 }}
            >
              {scanButtonLabel}
            </Button>
          </Group>
          <Group
            mt="md"
            gap="xs"
            wrap="nowrap"
            align="center"
            justify="space-between"
            w="100%"
            style={{ minHeight: 20 }}
          >
            <Text size="xs" c="dimmed" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
              {subText}
            </Text>
            {onShowCacheImpact ? (
              <Button
                size="compact-xs"
                variant="subtle"
                style={{ flexShrink: 0 }}
                onClick={(event) => {
                  event.stopPropagation();
                  onShowCacheImpact();
                }}
              >
                影响说明
              </Button>
            ) : null}
            {showBadge ? (
              <Badge size="sm" variant="filled" color={meta.color} style={{ flexShrink: 0 }}>
                已选 {selectedCount}
              </Badge>
            ) : null}
          </Group>
        </Stack>
      </Group>
    </Paper>
  );
}
