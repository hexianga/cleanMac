export function formatBytes(bytes: number) {
  const kb = 1024;
  if (bytes >= kb * kb * kb) {
    return `${(bytes / (kb * kb * kb)).toFixed(1)} GB`;
  }
  if (bytes >= kb * kb) {
    return `${(bytes / (kb * kb)).toFixed(1)} MB`;
  }
  if (bytes >= kb) {
    return `${(bytes / kb).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}
