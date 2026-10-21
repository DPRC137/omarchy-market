#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
imports=$(mktemp -d)
trap 'rm -rf "$imports"' EXIT
mkdir -p "$imports/qs"
ln -s /usr/share/omarchy/shell/Commons "$imports/qs/Commons"
ln -s /usr/share/omarchy/shell/Ui "$imports/qs/Ui"
# Qt 6.12 adds style advice about existing var declarations; keep it visible
# without turning that advice into a failed runtime-compatibility check.
style_flags=()
if [[ "$(/usr/lib/qt6/bin/qmllint --help)" == *--block-scope-var-declaration* ]]; then
  style_flags=(--block-scope-var-declaration info)
fi
# Quattro exposes dynamic QObject style tokens/bar members, which qmllint
# cannot resolve. Suppress only these documented host typing limitations.
/usr/lib/qt6/bin/qmllint -I "$imports" "${style_flags[@]}" --missing-property disable --unqualified disable --signal-handler-parameters disable --unused-imports disable \
  MarketService.qml BarWidget.qml Panel.qml providers/*.qml ui/*.qml test_runtime.qml
