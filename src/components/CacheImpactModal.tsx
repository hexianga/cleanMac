import { Button, Modal, Stack, Text } from "@mantine/core";
import { CACHE_IMPACT_COPY } from "../lib/cacheImpactCopy";
import { cleanMacModalProps } from "../lib/cleanMacModalProps";

interface CacheImpactModalProps {
  scannerId: "app_caches" | "dev_caches" | null;
  onClose: () => void;
}

export function CacheImpactModal({ scannerId, onClose }: CacheImpactModalProps) {
  const copy = scannerId ? CACHE_IMPACT_COPY[scannerId] : null;

  return (
    <Modal
      {...cleanMacModalProps}
      opened={copy !== null}
      onClose={onClose}
      title={copy?.title ?? ""}
      size="md"
      autoFocus={false}
      withCloseButton
    >
      {copy ? (
        <Stack gap="md">
          <Text size="sm">{copy.body}</Text>
          <Button onClick={onClose}>知道了</Button>
        </Stack>
      ) : null}
    </Modal>
  );
}
