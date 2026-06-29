import { contextBridge, ipcRenderer } from "electron";
import { MENU_CHANNEL, type MenuAction, type RhinoApi } from "../shared/ipc";

const api: RhinoApi = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  onMenu(handler) {
    ipcRenderer.on(MENU_CHANNEL, (_event, action: MenuAction) => handler(action));
  },
};

contextBridge.exposeInMainWorld("rhino", api);
