# CleanMac（磁盘助手）

[English](#english) · [中文](#中文)

macOS disk cleanup utility. Scans caches, logs, large files, duplicates, and more — **100% local**, no data uploaded.

[![CI](https://github.com/hexianga/cleanMac/actions/workflows/ci.yml/badge.svg)](https://github.com/hexianga/cleanMac/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Download

Get the latest **macOS (Apple Silicon)** DMG from [GitHub Releases](https://github.com/hexianga/cleanMac/releases/latest).

## Features

- Large files, duplicate files, download leftovers
- App caches, developer caches (Xcode, npm, etc.)
- Logs & diagnostics, Trash
- Per-category or one-click scan; review before delete

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

## Project info

| Item | Value |
|------|-------|
| App name (UI) | 磁盘助手 |
| Bundle ID | `com.canglang.diskcleaner` |
| License | MIT |

---

## English

CleanMac is an open-source macOS app to find reclaimable disk space under your home directory. All scanning and deletion happens on your Mac.

## 中文

CleanMac（磁盘助手）是开源 macOS 磁盘清理工具，扫描主目录下的可清理项，勾选后移至废纸篓。纯本地运行，不上传任何数据。

```bash
# 开发
pnpm install && pnpm tauri:dev

# 测试
pnpm test && cargo test --manifest-path src-tauri/Cargo.toml
```

发布：打 tag `v*` 后 GitHub Actions 自动构建 DMG，详见 [CONTRIBUTING.md](CONTRIBUTING.md)。
