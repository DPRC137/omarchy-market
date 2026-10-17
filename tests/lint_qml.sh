#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
imports=$(mktemp -d)
trap 'rm -rf "$imports"' EXIT
mkdir -p "$imports/qs"
ln -s /usr/share/omarchy/shell/Commons "$imports/qs/Commons"
ln -s /usr/share/omarchy/shell/Ui "$imports/qs/Ui"
# Quattro exposes dynamic QObject style tokens/bar members, which qmllint
# cannot resolve. Suppress only these documented host typing limitations.
/usr/lib/qt6/bin/qmllint -I "$imports" --missing-property disable --unqualified disable --signal-handler-parameters disable --unused-imports disable \
  MarketService.qml BarWidget.qml Panel.qml providers/*.qml ui/*.qml test_runtime.qml
