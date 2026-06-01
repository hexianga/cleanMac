# CleanMac

[English](#english) · [中文](#中文)

macOS disk cleanup utility. Scans caches, logs, large files, media by type, and more — **100% local**, no data uploaded.

[![CI](https://github.com/hexianga/cleanMac/actions/workflows/ci.yml/badge.svg)](https://github.com/hexianga/cleanMac/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Download

Get the latest **macOS (Apple Silicon)** DMG from [GitHub Releases](https://github.com/hexianga/cleanMac/releases/latest).

## Features

- **文件分类:** download leftovers, Trash, applications (.app), app/dev caches, logs, large files
- **文件类型:** video, audio, images, PDF, Office — scan by extension under home directory
- Sidebar tabs; per-category or one-click scan; review before delete
- Cache impact hints for app and developer caches

## Development

Requirements: Node 20+, pnpm, Rust stable, Xcode CLT.

```bash
pnpm install
pnpm tauri:dev
```

## Build

```bash
pnpm tauri:build
# DMG: src-tauri/target/release/bundle/dmg/*.dmg
```

Ad-hoc signing is configured by default (`signingIdentity: "-"`). For signed releases, see [CONTRIBUTING.md](CONTRIBUTING.md) and `.env.signing.example`.

## Project layout

| Directory | Role |
|-----------|------|
| `src/` | Web UI (React + Vite) |
| `src-tauri/` | Tauri official Rust backend — scan, delete, settings, permissions (`tauri.conf.json` for bundle/window) |

## Project info

| Item | Value |
|------|-------|
| App name (UI) | CleanMac |
| Bundle ID | `com.canglang.cleanmac` |
| License | MIT |

---

## English

CleanMac is an open-source macOS app to find reclaimable disk space under your home directory. All scanning and deletion happens on your Mac.

## 中文

CleanMac 是开源 macOS 磁盘清理工具，扫描主目录下的可清理项，勾选后移至废纸篓。纯本地运行，不上传任何数据。若从旧版「磁盘助手」升级，设置会自动迁移；请在系统设置中为新应用重新授权完全磁盘访问。

```bash
# 开发
pnpm install && pnpm tauri:dev

# 测试
pnpm test && cargo test --manifest-path src-tauri/Cargo.toml
```

发布：打 tag `v*` 后 GitHub Actions 自动构建 DMG，详见 [CONTRIBUTING.md](CONTRIBUTING.md)。
