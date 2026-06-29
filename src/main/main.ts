import { app, BrowserWindow, session, shell } from "electron";
import path from "node:path";
import { buildAppMenu } from "./menu";
import { MENU_CHANNEL, type MenuAction } from "../shared/ipc";
import { SERVICES } from "../shared/services";

const isMac = process.platform === "darwin";

function forwardGuestShortcuts(
  host: Electron.WebContents,
  guest: Electron.WebContents,
): void {
  guest.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;

    if (input.control && !input.meta && !input.alt && input.key === "Tab") {
      host.send(MENU_CHANNEL, {
        type: "cycle-tab",
        direction: input.shift ? "prev" : "next",
      } satisfies MenuAction);
      event.preventDefault();
      return;
    }

    const modifier = isMac ? input.meta : input.control;
    if (!modifier || input.alt) return;

    if (!input.shift && input.key.toLowerCase() === "w") {
      host.send(MENU_CHANNEL, { type: "close-tab" } satisfies MenuAction);
      event.preventDefault();
      return;
    }

    if (input.shift) return;

    const index = Number(input.key) - 1;
    const service = Number.isInteger(index) ? SERVICES[index] : undefined;
    if (!service) return;

    host.send(MENU_CHANNEL, {
      type: "select-service",
      id: service.id,
    } satisfies MenuAction);
    event.preventDefault();
  });
}

const WEBVIEW_PARTITION = "persist:rhino-services";

function stripFrameBlockingHeaders(targetSession: Electron.Session): void {
  targetSession.webRequest.onHeadersReceived((details, callback) => {
    // Stripping these headers on every asset request makes embedded sites slow.
    if (details.resourceType !== "mainFrame" && details.resourceType !== "subFrame") {
      callback({});
      return;
    }

    const responseHeaders = details.responseHeaders ?? {};
    for (const header of Object.keys(responseHeaders)) {
      const name = header.toLowerCase();
      if (
        name === "x-frame-options" ||
        name === "content-security-policy" ||
        name === "content-security-policy-report-only"
      ) {
        delete responseHeaders[header];
      }
    }

    callback({ cancel: false, responseHeaders });
  });
}

function openInBrowser(url: string): { action: "deny" } {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    void shell.openExternal(url);
  }
  return { action: "deny" };
}

function handleGuestPopup(
  host: Electron.WebContents,
  url: string,
  disposition: string,
): { action: "deny" } {
  const isWeb = url.startsWith("http://") || url.startsWith("https://");
  const opensTab =
    disposition === "foreground-tab" ||
    disposition === "background-tab" ||
    disposition === "new-window";

  if (isWeb && opensTab) {
    host.send(MENU_CHANNEL, { type: "new-tab", url } satisfies MenuAction);
    return { action: "deny" };
  }

  return openInBrowser(url);
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#19142d",
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 18, y: 18 },
    icon:
      process.platform === "linux"
        ? path.join(__dirname, "..", "renderer", "assets", "logo.png")
        : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  window.once("ready-to-show", () => window.show());
  void window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  window.webContents.setWindowOpenHandler(({ url }) => openInBrowser(url));
  window.webContents.on("did-attach-webview", (_event, webContents) => {
    webContents.setWindowOpenHandler(({ url, disposition }) =>
      handleGuestPopup(window.webContents, url, disposition),
    );
    forwardGuestShortcuts(window.webContents, webContents);
  });

  return window;
}

app.whenReady().then(() => {
  if (process.platform === "darwin" && app.dock && !app.isPackaged) {
    app.dock.setIcon(path.join(app.getAppPath(), "build", "icon.png"));
  }

  stripFrameBlockingHeaders(session.fromPartition(WEBVIEW_PARTITION));

  const window = createWindow();
  buildAppMenu(() => BrowserWindow.getFocusedWindow() ?? window);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const fresh = createWindow();
      buildAppMenu(() => BrowserWindow.getFocusedWindow() ?? fresh);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
