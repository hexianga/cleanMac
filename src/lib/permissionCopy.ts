export type PermissionCopyVariant =
  | "fullDisk"
  | "trash"
  | "downloads"
  | "applications";

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
  downloads: {
    title: "需要完全磁盘访问权限",
    body: "无法读取「下载」或「桌面」文件夹（macOS 会拦截未授权访问）。请在「系统设置 → 隐私与安全性 → 完全磁盘访问权限」中允许本应用，完全退出后重新打开，再点击扫描。",
  },
  applications: {
    title: "需要完全磁盘访问权限",
    body: "无法读取 /Applications。请在「系统设置 → 隐私与安全性 → 完全磁盘访问权限」中允许本应用，然后再次点击扫描。",
  },
};
