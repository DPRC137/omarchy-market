import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import qs.Commons
import "../models/MarketModel.js" as MarketModel
import "../models/WatchlistView.js" as Projection

ColumnLayout {
  id: root
  property var service: null
  property int revision: 0
  property var assets: []
  property string category: "All"
  property string sortMode: "Watchlist"
  readonly property bool searchFocused: search.activeFocus
  readonly property var visibleAssets: {
    var update = revision;
    return Projection.project(assets, search.text, category, sortMode, MarketModel.getCatalogItem, function(asset) {
      return service ? service.getQuote(asset) : MarketModel.createEmptyQuote(asset);
    });
  }
  signal selected(string asset)
  signal manageRequested()
  function focusSearch() { search.forceActiveFocus(); search.selectAll(); }
  spacing: Style.space(10)
  MarketTokens { id: tokens }
  TextField {
    id: search
    objectName: "watchlist-search"
    Layout.fillWidth: true
    implicitHeight: Math.max(Style.space(38), contentHeight + Style.space(16))
    placeholderText: "Filter by symbol or name"
    Accessible.name: "Filter watchlist by symbol or name"
    font.family: Style.font.family; font.pixelSize: Style.font.bodySmall
    color: tokens.foreground; placeholderTextColor: tokens.muted
    selectionColor: tokens.accent; selectedTextColor: tokens.surface
    leftPadding: Style.space(10); rightPadding: Style.space(10)
    background: Rectangle {
      color: tokens.hover; radius: Style.cornerRadius
      border.width: search.activeFocus ? 2 : 1
      border.color: search.activeFocus ? tokens.accent : tokens.divider
    }
    Keys.onEscapePressed: event => { if (text.length) { clear(); event.accepted = true; } else event.accepted = false; }
  }
  Flow {
    Layout.fillWidth: true
    spacing: Style.space(2)
    Repeater {
      model: ["All", "Crypto", "Stocks & ETFs"]
      MarketAction {
        required property string modelData
        text: modelData; selected: root.category === modelData
        onClicked: root.category = modelData
      }
    }
  }
  GridLayout {
    columns: width < resultCount.implicitWidth + sortAction.implicitWidth + Style.space(12) ? 1 : 2
    Layout.fillWidth: true
    Text {
      id: resultCount
      text: root.visibleAssets.length + " / " + root.assets.length
      Layout.fillWidth: true; color: tokens.muted
      font.family: Style.font.family; font.pixelSize: Style.font.caption
      Accessible.name: root.visibleAssets.length + " of " + root.assets.length + " assets shown"
    }
    MarketAction {
      id: sortAction
      text: "Sort: " + root.sortMode
      Accessible.name: "Sort watchlist: " + root.sortMode + ". Activate to change sort order."
      onClicked: {
        var options = ["Watchlist", "Symbol", "Gainers", "Losers"];
        root.sortMode = options[(options.indexOf(root.sortMode) + 1) % options.length];
      }
    }
  }
  Column {
    Layout.fillWidth: true
      Repeater {
        model: root.visibleAssets
        WatchRow {
          required property string modelData
          width: parent.width
          asset: modelData
          quote: root.service && root.revision >= 0 ? root.service.getQuote(asset) : MarketModel.createEmptyQuote(asset)
          onClicked: root.selected(asset)

        }
      }
      Column {
        width: parent.width
        visible: root.visibleAssets.length === 0
        spacing: Style.space(12)
        topPadding: Style.space(18)
        Text {
          width: parent.width; wrapMode: Text.WordWrap
          text: root.assets.length === 0 ? "Your watchlist is empty" : "No matching assets"
          font.family: Style.font.family; font.pixelSize: Style.font.body; font.bold: true; color: tokens.foreground
        }
        Text {
          width: parent.width; wrapMode: Text.WordWrap
          text: root.assets.length === 0 ? "Add an asset to start following the market." : "Try another symbol, name or category."
          font.family: Style.font.family; font.pixelSize: Style.font.bodySmall; color: tokens.muted
        }
        MarketAction {
          text: root.assets.length === 0 ? "Add assets" : "Clear filters"
          variant: "primary"
          onClicked: {
            if (root.assets.length === 0) root.manageRequested();
            else { search.clear(); root.category = "All"; }
          }
        }
      }
  }
}
