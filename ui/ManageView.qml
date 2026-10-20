import QtQuick
import QtQuick.Controls
import qs.Commons
import qs.Ui

Column {
  id: root
  property var service: null
  property int revision: 0
  property var assets: []
  property string searchQuery: ""
  property var searchResults: []
  property string searchState: "idle"
  property int searchIndex: 0
  property string message: ""
  property string expandedAsset: ""
  readonly property bool searchFocused: search.activeFocus
  signal queryEdited(string query)
  signal indexSelected(int index)
  signal addRequested(int index)
  signal removeRequested(string asset)
  signal selected(string asset)
  signal messageChangedByUser(string value)
  MarketTokens { id: tokens }
  spacing: Style.space(10)

  function focusSearch() { search.forceActiveFocus() }
  function removeAsset(asset) {
    removeRequested(asset)
    expandedAsset = ""
    focusSearch()
  }
  function moveAsset(asset, offset) {
    var from = assets.indexOf(asset)
    var to = from + offset
    if (!service || from < 0 || to < 0 || to >= assets.length) return
    var result = service.reorderMarket(from, to)
    if (result && result.success) messageChangedByUser(asset + " moved to position " + (to + 1))
    Qt.callLater(function() {
      var next = rows.itemAt(root.assets.indexOf(asset))
      if (next) next.focusActions()
    })
  }

  Text {
    text: "Add a market"
    color: tokens.foreground
    font.family: Style.font.family; font.pixelSize: Style.font.bodySmall; font.bold: true
  }
  BorderSurface {
    width: parent.width; height: Math.max(Style.space(40), search.implicitHeight + Style.space(20))
    color: tokens.hover; radius: Style.cornerRadius
    borderSpec: Border.controlSpec(search.activeFocus ? "selected" : "normal", tokens.foreground, tokens.accent)
    TextInput {
      id: search
      objectName: "market-search"
      anchors.fill: parent; anchors.margins: Style.space(10)
      text: root.searchQuery
      onTextEdited: root.queryEdited(text)
      font.family: Style.font.family; font.pixelSize: Style.font.bodySmall; color: tokens.foreground
      selectionColor: tokens.accent; selectedTextColor: tokens.surface
      clip: true; activeFocusOnTab: true; selectByMouse: true
      Accessible.name: "Search markets by symbol or name"
      Text { visible: !search.text; text: "Symbol or name…"; color: tokens.muted; font: search.font }
      Keys.onDownPressed: root.indexSelected(Math.min(root.searchResults.length - 1, root.searchIndex + 1))
      Keys.onUpPressed: root.indexSelected(Math.max(0, root.searchIndex - 1))
      Keys.onReturnPressed: root.addRequested(root.searchIndex)
      Keys.onEnterPressed: root.addRequested(root.searchIndex)
    }
  }
  Text {
    width: parent.width; wrapMode: Text.Wrap; textFormat: Text.PlainText
    text: !root.searchQuery ? "Find crypto and stocks to follow." : root.searchState === "loading" ? "Searching stocks… Local matches are ready." : root.searchState === "error" ? "Stock search unavailable. Edit your search to retry; local matches still work." : root.searchResults.length === 0 ? "No matches. Try a symbol or company name." : "↑ / ↓ to choose · Enter to add"
    font.family: Style.font.family; font.pixelSize: Style.font.caption; color: tokens.muted
    Accessible.role: Accessible.StaticText
  }
  Repeater {
    model: root.searchQuery ? root.searchResults : []
    MarketAction {
      required property var modelData
      required property int index
      width: root.width
      objectName: "manage-result-" + modelData.asset
      readonly property bool alreadyAdded: root.assets.indexOf(modelData.asset) >= 0
      text: (alreadyAdded ? "Added · " : "+ ") + modelData.asset + " · " + modelData.name
      selected: root.searchIndex === index
      enabled: !alreadyAdded && root.assets.length < 20
      Accessible.name: modelData.asset + ", " + modelData.name + (alreadyAdded ? ", already in watchlist" : ", add to watchlist")
      onClicked: root.addRequested(index)
    }
  }
  Text {
    width: parent.width; wrapMode: Text.Wrap
    visible: root.assets.length >= 20
    text: "Watchlist full (20 markets). Remove a market to add another."
    font.family: Style.font.family; font.pixelSize: Style.font.caption; color: tokens.foreground
  }
  Rectangle { width: parent.width; height: 1; color: tokens.muted; opacity: 0.22 }
  Row {
    width: parent.width
    Text {
      width: parent.width * 0.7; text: "Your watchlist"; color: tokens.foreground
      font.family: Style.font.family; font.pixelSize: Style.font.bodySmall; font.bold: true
    }
    Text {
      width: parent.width * 0.3; text: root.assets.length + " / 20"; horizontalAlignment: Text.AlignRight
      color: tokens.muted; font.family: Style.font.family; font.pixelSize: Style.font.caption
    }
  }
  Text {
    width: parent.width; wrapMode: Text.Wrap; visible: root.assets.length === 0
    text: "Your watchlist is empty. Search above to add your first market."
    color: tokens.muted; font.family: Style.font.family; font.pixelSize: Style.font.bodySmall
  }
  Text {
    width: parent.width; wrapMode: Text.Wrap; visible: root.message !== ""; text: root.message
    textFormat: Text.PlainText; color: tokens.foreground
    font.family: Style.font.family; font.pixelSize: Style.font.caption
    Accessible.role: Accessible.StaticText
  }
  MarketAction {
    text: "Undo removal"
    visible: root.service && root.service.removedItem !== null
    enabled: root.assets.length < 20
    onClicked: {
      root.service.undoRemoval()
      root.messageChangedByUser(root.service.removedItem === null ? "Removal undone" : "Could not restore market")
      root.focusSearch()
    }
  }
  Column {
    width: parent.width
    Repeater {
      id: rows
      model: root.assets
      Column {
        id: marketRow
        required property string modelData
        required property int index
        width: root.width
        readonly property bool expanded: root.expandedAsset === modelData
        function focusActions() { more.forceActiveFocus() }
        Row {
          width: parent.width; spacing: Style.space(6)
          MarketAction {
            width: parent.width - more.width - parent.spacing
            text: marketRow.modelData + (root.service && root.service.pinnedAsset === marketRow.modelData ? " · Pinned" : "")
            Accessible.name: "View " + marketRow.modelData
            onClicked: root.selected(marketRow.modelData)
          }
          MarketAction {
            id: more
            objectName: "manage-edit-" + marketRow.modelData
            text: marketRow.expanded ? "Done" : "Edit"
            selected: marketRow.expanded
            Accessible.name: (marketRow.expanded ? "Close actions for " : "Edit ") + marketRow.modelData
            onClicked: root.expandedAsset = marketRow.expanded ? "" : marketRow.modelData
            Keys.onPressed: function(event) {
              if (event.modifiers & Qt.AltModifier && (event.key === Qt.Key_Up || event.key === Qt.Key_Down)) {
                event.accepted = true
                root.moveAsset(marketRow.modelData, event.key === Qt.Key_Up ? -1 : 1)
              } else if (event.key === Qt.Key_Escape) {
                root.expandedAsset = ""
                event.accepted = true
              }
            }
          }
        }
        Column {
          width: parent.width; visible: marketRow.expanded; spacing: Style.space(6)
          Text {
            width: parent.width; text: "Position " + (marketRow.index + 1) + " · Alt + ↑ / ↓ to reorder"
            wrapMode: Text.Wrap; color: tokens.muted; font.family: Style.font.family; font.pixelSize: Style.font.caption
          }
          Flow {
            width: parent.width; spacing: Style.space(6)
            MarketAction { text: "Move up"; enabled: marketRow.index > 0; onClicked: root.moveAsset(marketRow.modelData, -1) }
            MarketAction { text: "Move down"; enabled: marketRow.index < root.assets.length - 1; onClicked: root.moveAsset(marketRow.modelData, 1) }
            MarketAction {
              text: "Pin to bar"; enabled: root.service && root.service.pinnedAsset !== marketRow.modelData
              onClicked: { root.service.pinnedAsset = marketRow.modelData; root.messageChangedByUser(marketRow.modelData + " pinned to bar") }
            }
            MarketAction {
              objectName: "manage-remove-" + marketRow.modelData
              text: "Remove"; variant: "danger"; Accessible.name: "Remove " + marketRow.modelData + " from watchlist"
              onClicked: root.removeAsset(marketRow.modelData)
            }
          }
          Item { width: 1; height: Style.space(6) }
        }
        Rectangle { width: parent.width; height: 1; color: tokens.muted; opacity: 0.16 }
      }
    }
  }
  Item { width: 1; height: Style.space(4) }
  Text {
    text: "Bar display"; color: tokens.foreground
    font.family: Style.font.family; font.pixelSize: Style.font.bodySmall; font.bold: true
  }
  Dropdown {
    objectName: "bar-ticker"
    width: parent.width
    label: "Pinned market"
    options: root.assets
    value: root.service ? root.service.pinnedAsset : ""
    enabled: root.assets.length > 0
    onChanged: function(value) { if (root.service) root.service.pinnedAsset = value }
  }
  MarketAction {
    text: root.service && root.service.rotationEnabled ? "Rotation: on" : "Rotation: off"
    selected: root.service && root.service.rotationEnabled
    enabled: root.assets.length > 0
    onClicked: if (root.service) root.service.rotationEnabled = !root.service.rotationEnabled
  }
  Text {
    width: parent.width; wrapMode: Text.Wrap
    text: root.service && root.service.rotationEnabled ? "The bar cycles through your watchlist in order." : "The bar shows your pinned market. Enable rotation to cycle through your list."
    color: tokens.muted; font.family: Style.font.family; font.pixelSize: Style.font.caption
  }
}
