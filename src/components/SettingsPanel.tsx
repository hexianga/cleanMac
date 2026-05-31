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
  DEFAULT_ONE_CLICK_SCAN_IDS,
  SCANNER_META,
  SCANNER_ORDER,
} from "../lib/categoryMeta";
import { getSettings, saveSettings } from "../lib/api";
import type { AppSettings } from "../lib/types";

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
  const oneClickScanIds =
    raw.oneClickScanIds?.length > 0
      ? raw.oneClickScanIds
      : [...DEFAULT_ONE_CLICK_SCAN_IDS];
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
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) {
      return;
    }

    setSaved(false);
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
    setSaved(false);
    try {
      await saveSettings(settings);
      setSaved(true);
      onSaved?.(settings);
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="扫描设置"
      centered
      withCloseButton={false}
    >
      {!settings ? (
        <Text c="dimmed" size="sm">
          加载设置中…
        </Text>
      ) : (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            以下参数对单类扫描与一键扫描均生效。
          </Text>
          <NumberInput
            label={
              <FieldLabel
                label="大文件阈值（MB）"
                tooltip="超过此大小的文件会出现在「大文件」类别"
              />
            }
            min={1}
            data-autofocus
            value={Math.round(settings.largeFileMinBytes / MB)}
            onChange={(value) => {
              const mb = typeof value === "number" ? value : 100;
              setSettings({
                ...settings,
                largeFileMinBytes: mb * MB,
              });
              setSaved(false);
            }}
          />
          <NumberInput
            label={
              <FieldLabel
                label="重复文件最小大小（MB）"
                tooltip="仅检测大于此大小的重复文件"
              />
            }
            min={1}
            decimalScale={2}
            value={settings.duplicateMinBytes / MB}
            onChange={(value) => {
              const mb = typeof value === "number" ? value : 1;
              setSettings({
                ...settings,
                duplicateMinBytes: Math.round(mb * MB),
              });
              setSaved(false);
            }}
          />
          <Switch
            label={
              <FieldLabel
                label="扫描重复文件"
                tooltip="默认关闭；开启后会显著增加扫描时间"
              />
            }
            checked={settings.scanDuplicates}
            onChange={(event) => {
              setSettings({
                ...settings,
                scanDuplicates: event.currentTarget.checked,
              });
              setSaved(false);
            }}
          />
          <NumberInput
            label={
              <FieldLabel
                label="重复文件哈希上限（MB）"
                tooltip="逻辑大小超过此值的文件不参与重复检测（避免 Docker.raw 等巨型稀疏文件）"
              />
            }
            min={1}
            value={Math.round(settings.maxHashBytes / MB)}
            onChange={(value) => {
              const mb = typeof value === "number" ? value : 512;
              setSettings({
                ...settings,
                maxHashBytes: mb * MB,
              });
              setSaved(false);
            }}
          />
          <Switch
            label={
              <FieldLabel
                label="扫描 node_modules 目录"
                tooltip="默认跳过 node_modules 以加快扫描"
              />
            }
            checked={settings.includeNodeModules}
            onChange={(event) => {
              setSettings({
                ...settings,
                includeNodeModules: event.currentTarget.checked,
              });
              setSaved(false);
            }}
          />

          <Text fw={600} size="sm" mt="md">
            一键扫描范围
          </Text>
          <Text size="sm" c="dimmed">
            仅决定「一键扫描」包含哪些类别。点击单张卡片仍只扫描该类别。
          </Text>
          {SCANNER_ORDER.map((id) => (
            <Checkbox
              key={id}
              label={SCANNER_META[id].name}
              checked={settings.oneClickScanIds.includes(id)}
              onChange={(event) => {
                const next = event.currentTarget.checked
                  ? [...settings.oneClickScanIds, id]
                  : settings.oneClickScanIds.filter((scannerId) => scannerId !== id);
                setSettings({ ...settings, oneClickScanIds: next });
                setSaved(false);
              }}
            />
          ))}

          {saved && (
            <Text c="teal" size="sm">
              已保存，下次扫描生效
            </Text>
          )}
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
