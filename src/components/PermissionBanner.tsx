import { Alert, Button, Stack, Text } from "@mantine/core";
import { openFullDiskAccessSettings } from "../lib/api";
import { PERMISSION_COPY, type PermissionCopyVariant } from "../lib/permissionCopy";

interface PermissionBannerProps {
  variant: PermissionCopyVariant;
}

export function PermissionBanner({ variant }: PermissionBannerProps) {
  const { title, body } = PERMISSION_COPY[variant];

  return (
    <Alert color="yellow" title={title} variant="light">
      <Stack gap="sm">
        <Text size="sm">{body}</Text>
        <Button
          size="sm"
          variant="light"
          w="fit-content"
          onClick={() => {
            openFullDiskAccessSettings().catch(console.error);
          }}
        >
          打开系统设置
        </Button>
      </Stack>
    </Alert>
  );
}
