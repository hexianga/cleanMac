import { getActiveScanners } from "./api";

const SCAN_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_MS = 300;

export async function waitForScansToFinish(
  scannerIds: string[],
  signal?: AbortSignal,
): Promise<void> {
  const deadline = Date.now() + SCAN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error("扫描已取消");
    }

    const active = await getActiveScanners();
    const stillRunning = scannerIds.some((id) => active.includes(id));
    if (!stillRunning) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, POLL_MS));
  }

  throw new Error("扫描超时，请重试");
}
