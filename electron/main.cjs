const { app, BrowserWindow, Menu, MenuItem } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "NativeDeck",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  // Electron enables Chromium's spellchecker by default but doesn't wire up
  // a right-click menu for it — build one with suggestions + basic edit
  // actions, since there's no app menu for these commands otherwise.
  win.webContents.on("context-menu", (_event, params) => {
    const menu = new Menu();

    for (const suggestion of params.dictionarySuggestions) {
      menu.append(
        new MenuItem({
          label: suggestion,
          click: () => win.webContents.replaceMisspelling(suggestion),
        })
      );
    }

    if (params.misspelledWord) {
      if (params.dictionarySuggestions.length > 0) {
        menu.append(new MenuItem({ type: "separator" }));
      }
      menu.append(
        new MenuItem({
          label: "Add to dictionary",
          click: () =>
            win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
        })
      );
    }

    if (params.isEditable) {
      if (params.misspelledWord || params.dictionarySuggestions.length > 0) {
        menu.append(new MenuItem({ type: "separator" }));
      }
      menu.append(new MenuItem({ label: "Cut", role: "cut", enabled: params.editFlags.canCut }));
      menu.append(new MenuItem({ label: "Copy", role: "copy", enabled: params.editFlags.canCopy }));
      menu.append(new MenuItem({ label: "Paste", role: "paste", enabled: params.editFlags.canPaste }));
    } else if (params.selectionText) {
      menu.append(new MenuItem({ label: "Copy", role: "copy" }));
    }

    if (menu.items.length > 0) menu.popup();
  });

  win.loadFile(path.join(__dirname, "../dist/index.html"));
}

app.whenReady().then(() => {
  createWindow();

  // Update checks only make sense for an installed (NSIS) build — running
  // via `electron .` in dev has no installer to compare against.
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
