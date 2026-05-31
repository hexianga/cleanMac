export function diskUsedPercent(
  totalBytes: number,
  availableBytes: number,
): number {
  if (totalBytes <= 0) {
    return 0;
  }
  const used = totalBytes - availableBytes;
  return Math.min(100, Math.max(0, Math.round((used / totalBytes) * 100)));
}
