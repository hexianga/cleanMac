# App icons

| File | Purpose |
|------|---------|
| `app-icon.png` | 1024×1024 opaque square master (macOS applies Dock squircle) |
| `image.png` | Optional source artwork |
| `icon.icns` / `*.png` | Generated bundle assets (do not hand-edit) |

Regenerate from a new square source (≥1024px):

```bash
pip3 install pillow   # once
python3 scripts/prepare-macos-icon.py src-tauri/icons/image.png src-tauri/icons/app-icon.png
pnpm tauri icon src-tauri/icons/app-icon.png -o src-tauri/icons
cp src-tauri/icons/32x32.png public/favicon.png
```

Do not pre-cut squircle corners in the PNG — macOS applies that mask in the Dock. Rebuild the `.app` (`pnpm tauri:build`) or restart the dev app to refresh Dock icons.
