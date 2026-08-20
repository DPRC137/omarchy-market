# Omarchy Quattro & Quickshell Environment Research

**Date:** 2026-08-21  
**Plugin ID:** `io.github.dpr.omarchy-market`  
**Environment:** Linux 7.1.8-arch1-3 x86_64, Omarchy 4.0.0.alpha, Quickshell 0.3.0 (git revision 28771c7c), Qt 6.11.1, qmllint 1.0.

---

## 1. Quattro Shell & Plugin Architecture

### Host Process
Omarchy runs as a single long-lived Quickshell process (`omarchy-shell`) located at `/usr/share/omarchy/shell/shell.qml`.
- **Top-Level Root**: `ShellRoot` in `shell.qml`.
- **Registry**: `services/PluginRegistry.qml` scans first-party plugins from `/usr/share/omarchy/shell/plugins` and user third-party plugins from `~/.config/omarchy/plugins/<id>/`.
- **Hot-Reloading**: Changes under `~/.config/omarchy/plugins/` are watched via `inotifywait` (`localPluginWatcher`) and trigger hot-reloading via `shell.reloadPlugins()`.
- **Configuration**: User state lives in `~/.config/omarchy/shell.json`. Setting an entry in `bar.layout.*` or `plugins[]` enables the plugin.

### Plugin Contracts & Lifecycles

1. **Service Plugins (`kind: "service"`)**:
   - Long-lived headless singletons mounted inside `serviceHost` in `shell.qml`.
   - Loaded when the plugin is enabled in `shell.json`.
   - Injected properties from shell:
     - `property var shell: null`
     - `property string omarchyPath: ""`
     - `property var manifest: null`
     - `property var barWidgetRegistry: null`
     - `property var pluginRegistry: null`
   - Retrieved by widgets using `bar.shell.serviceFor("io.github.dpr.omarchy-market")`.

2. **Bar Widget Plugins (`kind: "bar-widget"`)**:
   - Instantiated inside `Bar.qml` `ModuleSlot` from `BarWidgetRegistry`.
   - Inherits from `qs.Ui.BarWidget` (`/usr/share/omarchy/shell/Ui/BarWidget.qml`).
   - Injected properties:
     - `property QtObject bar: null`
     - `property string moduleName: ""`
     - `property var settings: ({})`
   - Base helpers: `setting(key, fallback)`, `broadcast(method)`, `vertical`, `barSize`.
   - Bar Popout Contract:
     - `readonly property bool opened`
     - `function open()`
     - `function close()`
     - `function closeForPopoutSwitch()`
     - `readonly property bool popoutSwitchClosing`

3. **Panel Plugins (`Panel.qml`)**:
   - Extends `KeyboardPanel` from `qs.Ui.KeyboardPanel`.
   - Layer-shell overlay attached to the bar widget anchor button.
   - Provides outside click dismissal, Escape key handling, and focus priming.

---

## 2. Networking Capabilities & Constraints

### Runtime Discovery
1. **`QtWebSockets`**: The `qt6-websockets` package is not part of the standard Arch Qt6 installation. `import QtWebSockets` in QML fails at runtime. Sudo / package installation is forbidden.
2. **`XMLHttpRequest`**: Fully functional in QML JS engine. HTTP 200 returned reliably from public crypto APIs.
3. **Raw WebSocket Streaming with `curl 8.21.0` & `Quickshell.Io.Process`**:
   - `curl 8.21.0` natively supports `ws://` and `wss://` protocols with `curl -N --raw "wss://..."`.
   - `Quickshell.Io.Process` with `SplitParser` (splitting by line/frame) streams real-time market data directly into QML with zero daemons.
   - Reconnect logic uses exponential backoff with random jitter.

---

## 3. UI Styling & Typography Tokens

- Theme colors are accessible via `qs.Commons.Color`:
  - `Color.foreground`, `Color.background`, `Color.accent`, `Color.urgent`, `Color.muted`.
  - `Color.popups.background`, `Color.popups.border`, `Color.popups.text`.
- Layout and geometry tokens from `qs.Commons.Style`:
  - `Style.font.family`, `Style.font.body`, `Style.font.title`, `Style.font.caption`, `Style.font.small`.
  - `Style.space(px)` for responsive DPI scaling.
  - `Style.cornerRadius`, `Style.gapsOut`.

---

## 4. Verification & Validation Commands

- **Manifest & Structure Validation**:
  ```bash
  omarchy plugin validate ~/.config/omarchy/plugins/io.github.dpr.omarchy-market
  ```
- **QML Linting**:
  ```bash
  qmllint -I /usr/share/omarchy/shell MarketService.qml BarWidget.qml Panel.qml
  ```
- **Shell Rescan & Reload**:
  ```bash
  omarchy-shell shell rescanPlugins
  ```
