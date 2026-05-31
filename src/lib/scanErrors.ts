export function isScannerBusyError(error: unknown): boolean {
  return String(error).includes("正在扫描中");
}

export function isScanWaitAborted(error: unknown): boolean {
  return String(error).includes("扫描已取消");
}
