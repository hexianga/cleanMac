import type { ScannerId } from "./categoryMeta";

export const CACHE_IMPACT_COPY: Partial<
  Record<ScannerId, { title: string; body: string; deleteHint: string }>
> = {
  app_caches: {
    title: "应用缓存 — 删除影响",
    body: "浏览器、聊天与影音应用的缓存删除后会在使用时重新生成，首次打开可能变慢。部分游戏会重新下载资源包。",
    deleteHint: "删除应用缓存可能导致应用需重新加载数据或首次启动变慢。",
  },
  dev_caches: {
    title: "开发缓存 — 删除影响",
    body: "Xcode DerivedData 删除后需完整重新编译。npm、cargo 等包管理缓存删除后需重新下载依赖，离线环境可能暂时无法构建。",
    deleteHint: "删除开发缓存可能导致项目需重新编译或重新下载依赖。",
  },
};

export function cacheDeleteHint(scannerId: string): string | undefined {
  return CACHE_IMPACT_COPY[scannerId as ScannerId]?.deleteHint;
}
