import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { cleanMacModalProps } from "../lib/cleanMacModalProps";
import type { SlowScanConfirmCopy } from "../lib/slowScanConfirmCopy";

interface ScanConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  copy: SlowScanConfirmCopy;
}

export function ScanConfirmModal({
  opened,
  onClose,
  onConfirm,
  copy,
}: ScanConfirmModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={copy.title} {...cleanMacModalProps}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {copy.body}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            取消
          </Button>
          <Button data-autofocus onClick={onConfirm}>
            {copy.confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
