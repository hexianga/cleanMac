import {
  Accordion,
  Button,
  Group,
  Modal,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { formatBytes } from "../lib/formatBytes";
import type { ItemGroup } from "../lib/groupScanItems";

interface DeleteConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirming: boolean;
  categoryName: string;
  groups: ItemGroup[];
  extraWarning?: string;
}

export function DeleteConfirmModal({
  opened,
  onClose,
  onConfirm,
  confirming,
  categoryName,
  groups,
  extraWarning,
}: DeleteConfirmModalProps) {
  const itemCount = groups.reduce((sum, group) => sum + group.items.length, 0);
  const totalBytes = groups.reduce((sum, group) => sum + group.totalBytes, 0);

  if (itemCount === 0) {
    return null;
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`确认删除「${categoryName}」中的 ${itemCount} 项`}
      centered
      size="lg"
      withCloseButton={false}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          将释放约 {formatBytes(totalBytes)}。文件将移至废纸篓（废纸篓类别为清空废纸篓），可在
          Finder 中恢复。
        </Text>
        {extraWarning ? (
          <Text size="sm" c="orange">
            {extraWarning}
          </Text>
        ) : null}

        <Accordion variant="separated">
          {groups.map((group) => (
            <Accordion.Item key={group.groupKey} value={group.groupKey}>
              <Accordion.Control>
                {group.groupLabel} · {group.items.length} 项 ·{" "}
                {formatBytes(group.totalBytes)}
              </Accordion.Control>
              <Accordion.Panel>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>文件名</Table.Th>
                      <Table.Th w={100}>大小</Table.Th>
                      <Table.Th w={120}>类型</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {group.items.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>
                          <Text size="sm" lineClamp={1} title={item.path}>
                            {basename(item.path)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{item.sizeHuman}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {itemTypeLabel(item, group.groupLabel)}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={confirming} data-autofocus>
            取消
          </Button>
          <Button color="red" onClick={onConfirm} loading={confirming}>
            确认删除
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function itemTypeLabel(item: { fileCategory?: string; deletable: boolean }, groupLabel: string) {
  if (item.fileCategory) {
    return item.fileCategory;
  }
  if (!item.deletable) {
    return "Docker/VM";
  }
  return groupLabel;
}

function basename(path: string) {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}
