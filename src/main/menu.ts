import {
  app,
  Menu,
  shell,
  type BrowserWindow,
  type MenuItemConstructorOptions,
} from "electron";
import { MENU_CHANNEL, type MenuAction } from "../shared/ipc";
import { SERVICE_CATEGORIES } from "../shared/services";

const REPO_URL = "https://github.com/anomalyco/opencode";
const isMac = process.platform === "darwin";

export function buildAppMenu(getWindow: () => BrowserWindow | undefined): void {
  const send = (action: MenuAction): void => {
    getWindow()?.webContents.send(MENU_CHANNEL, action);
  };

  // Use one index across categories so shortcuts match the displayed hints.
  const serviceItems: MenuItemConstructorOptions[] = [];
  let globalIndex = 0;
  SERVICE_CATEGORIES.forEach((category, categoryIndex) => {
    if (categoryIndex > 0) serviceItems.push({ type: "separator" });
    serviceItems.push({ label: category.name, enabled: false });
    for (const service of category.services) {
      const index = globalIndex++;
      serviceItems.push({
        label: service.name,
        accelerator: index < 9 ? `CmdOrCtrl+${index + 1}` : undefined,
        click: () => send({ type: "select-service", id: service.id }),
      });
    }
  });

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ] as MenuItemConstructorOptions[])
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Tab",
          accelerator: "CmdOrCtrl+T",
          click: () => send({ type: "new-tab" }),
        },
        {
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          click: () => send({ type: "close-tab" }),
        },
        { type: "separator" },
        isMac
          ? { label: "Close Window", accelerator: "CmdOrCtrl+Shift+W", role: "close" }
          : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Services",
      submenu: [
        ...serviceItems,
        { type: "separator" },
        {
          label: "Back",
          accelerator: "CmdOrCtrl+[",
          click: () => send({ type: "navigate", direction: "back" }),
        },
        {
          label: "Forward",
          accelerator: "CmdOrCtrl+]",
          click: () => send({ type: "navigate", direction: "forward" }),
        },
        {
          label: "Reload Service",
          accelerator: "CmdOrCtrl+R",
          click: () => send({ type: "reload" }),
        },
        {
          label: "Open in Browser",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => send({ type: "open-external" }),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+B",
          click: () => send({ type: "toggle-sidebar" }),
        },
        { type: "separator" },
        {
          label: "Next Tab",
          accelerator: "Ctrl+Tab",
          click: () => send({ type: "cycle-tab", direction: "next" }),
        },
        {
          label: "Previous Tab",
          accelerator: "Ctrl+Shift+Tab",
          click: () => send({ type: "cycle-tab", direction: "prev" }),
        },
        { type: "separator" },
        {
          label: "Zoom In",
          accelerator: "CmdOrCtrl+Plus",
          click: () => send({ type: "zoom", direction: "in" }),
        },
        {
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          click: () => send({ type: "zoom", direction: "out" }),
        },
        {
          label: "Actual Size",
          accelerator: "CmdOrCtrl+0",
          click: () => send({ type: "zoom", direction: "reset" }),
        },
        { type: "separator" },
        { role: "togglefullscreen" },
        { role: "toggleDevTools" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        ...(isMac
          ? ([
              { role: "zoom" },
              { type: "separator" },
              { role: "front" },
            ] as MenuItemConstructorOptions[])
          : ([{ role: "close" }] as MenuItemConstructorOptions[])),
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Learn More",
          click: () => void shell.openExternal(REPO_URL),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
