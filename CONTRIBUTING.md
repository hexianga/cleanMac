# Contributing to CleanMac

Thank you for your interest in contributing.

## Development setup

Requirements: Node 20+, pnpm 10+, Rust stable, Xcode Command Line Tools (macOS).

```bash
git clone git@github.com:hexianga/cleanMac.git
cd cleanMac
pnpm install
pnpm tauri:dev
```

## Tests

```bash
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml
pnpm build
```

## Pull requests

1. Fork and create a feature branch from `main`.
2. Keep changes focused; run tests before opening a PR.
3. Describe what changed and why.

## Releases (maintainers)

1. Bump version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
2. `git tag vX.Y.Z && git push origin vX.Y.Z`
3. GitHub Actions builds the DMG and attaches it to the Release.

Optional signed builds: copy `.env.signing.example` to `.env.signing`, configure Apple credentials, and add the same secrets to the repository.
