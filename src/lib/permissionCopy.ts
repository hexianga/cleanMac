export type PermissionCopyVariant = "fullDisk" | "trash";

export const PERMISSION_COPY: Record<
  PermissionCopyVariant,
  { title: string; body: string }
> = {
  fullDisk: {
    title: "需要完全磁盘访问权限",
    body: "无法读取系统缓存目录。请在「系统设置 → 隐私与安全性 → 完全磁盘访问权限」中允许本应用，然后重新扫描。",
  },
  trash: {
    title: "需要完全磁盘访问权限",
    body: "无法读取废纸篓。请在「系统设置 → 隐私与安全性 → 完全磁盘访问权限」中允许本应用，然后再次点击扫描。",
  },
};
