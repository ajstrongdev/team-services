export type MenuAction =
  | { type: "select-service"; id: string }
  | { type: "new-tab"; id?: string; url?: string }
  | { type: "close-tab" }
  | { type: "cycle-tab"; direction: "next" | "prev" }
  | { type: "navigate"; direction: "back" | "forward" }
  | { type: "reload" }
  | { type: "open-external" }
  | { type: "zoom"; direction: "in" | "out" | "reset" }
  | { type: "toggle-sidebar" };

export const MENU_CHANNEL = "rhino:menu";

export interface RhinoApi {
  platform: NodeJS.Platform;
  versions: { electron: string; chrome: string; node: string };
  onMenu(handler: (action: MenuAction) => void): void;
}
