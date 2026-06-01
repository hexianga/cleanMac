import {
  ActionIcon,
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Stack,
  Switch,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import {
  CLASSIFICATION_SCANNER_ORDER,
  DEFAULT_ONE_CLICK_SCAN_IDS,
  SCANNER_META,
  isClassificationScannerId,
} from "../lib/categoryMeta";
import { getSettings, saveSettings } from "../lib/api";
import { cleanMacModalProps } from "../lib/cleanMacModalProps";
import type { AppSettings } from "../lib/types";
import { SettingsFieldRow } from "./SettingsFieldRow";

const MB = 1024 * 1024;

function FieldLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <Group gap={6} wrap="nowrap" component="span" align="center">
      <span>{label}</span>
      <Tooltip label={tooltip} multiline maw={280} withArrow>
        <ActionIcon
          variant="subtle"
          size="xs"
          color="gray"
          aria-label={`${label}说明`}
          tabIndex={-1}
        >
          <IconInfoCircle size={14} stroke={1.5} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

function normalizeSettings(raw: AppSettings): AppSettings {
  const oneClickScanIds = (
    raw.oneClickScanIds?.length > 0
      ? raw.oneClickScanIds
      : [...DEFAULT_ONE_CLICK_SCAN_IDS]
  ).filter(isClassificationScannerId);
  return { ...raw, oneClickScanIds };
}

interface SettingsPanelProps {
  opened: boolean;
  onClose: () => void;
  onSaved?: (settings: AppSettings) => void;
}

export function SettingsPanel({ opened, onClose, onSaved }: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) {
      return;
    }

    setError(null);
    getSettings()
      .then((loaded) => setSettings(normalizeSettings(loaded)))
      .catch((loadError) => setError(String(loadError)));
  }, [opened]);

  const handleSave = async () => {
    if (!settings) {
      return;
    }

    if (settings.oneClickScanIds.length === 0) {
      setError("请至少选择一项一键扫描类别");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveSettings(settings);
      onSaved?.(settings);
      onClose();
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      {...cleanMacModalProps}
      opened={opened}
      onClose={onClose}
      title="扫描设置"
      size="lg"
      autoFocus={false}
      withCloseButton
    >
      {!settings ? (
        <Text c="dimmed" size="sm">
          加载设置中…
        </Text>
      ) : (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            以下参数对单类扫描与一键扫描均生效。「文件类型」Tab 的一键扫描固定包含全部 5 类。
          </Text>
          <SettingsFieldRow
            label={
              <FieldLabel
                label="大文件阈值（MB）"
                tooltip="超过此大小的文件会出现在「大文件」类别"
              />
            }
          >
            <NumberInput
              w="100%"
              min={1}
              value={Math.round(settings.largeFileMinBytes / MB)}
              onChange={(value) => {
                const mb = typeof value === "number" ? value : 100;
                setSettings({
                  ...settings,
                  largeFileMinBytes: mb * MB,
                });
              }}
            />
          </SettingsFieldRow>
          <SettingsFieldRow
            label={
              <FieldLabel
                label="扫描 node_modules 目录"
                tooltip="默认跳过 node_modules 以加快扫描；开启后文件类型与大文件扫描也会进入 node_modules"
              />
            }
          >
            <Switch
              checked={settings.includeNodeModules}
              onChange={(event) => {
                setSettings({
                  ...settings,
                  includeNodeModules: event.currentTarget.checked,
                });
              }}
            />
          </SettingsFieldRow>

          <Text fw={600} size="sm" mt="md">
            一键扫描范围（文件分类）
          </Text>
          <Text size="sm" c="dimmed">
            仅决定「文件分类」Tab 的一键扫描包含哪些类别。点击单张卡片仍只扫描该类别。
          </Text>
          {CLASSIFICATION_SCANNER_ORDER.map((id) => (
            <Checkbox
              key={id}
              label={SCANNER_META[id].name}
              checked={settings.oneClickScanIds.includes(id)}
              onChange={(event) => {
                const next = event.currentTarget.checked
                  ? [...settings.oneClickScanIds, id]
                  : settings.oneClickScanIds.filter((scannerId) => scannerId !== id);
                setSettings({ ...settings, oneClickScanIds: next });
              }}
            />
          ))}

          {error && (
            <Text c="red" size="sm">
              {error}
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              关闭
            </Button>
            <Button onClick={handleSave} loading={saving}>
              保存
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
