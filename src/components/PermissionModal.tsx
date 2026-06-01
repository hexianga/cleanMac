import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { openFullDiskAccessSettings } from "../lib/api";
import { cleanMacModalProps } from "../lib/cleanMacModalProps";
import {
  PERMISSION_COPY,
  type PermissionCopyVariant,
} from "../lib/permissionCopy";

interface PermissionModalProps {
  opened: boolean;
  onClose: () => void;
  variant: PermissionCopyVariant;
}

export function PermissionModal({
  opened,
  onClose,
  variant,
}: PermissionModalProps) {
  const { title, body } = PERMISSION_COPY[variant];

  return (
    <Modal opened={opened} onClose={onClose} title={title} {...cleanMacModalProps}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {body}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            知道了
          </Button>
          <Button
            data-autofocus
            onClick={() => {
              openFullDiskAccessSettings().catch(console.error);
            }}
          >
            打开系统设置
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
