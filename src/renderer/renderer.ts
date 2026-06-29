import {
  createElement,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileLock2,
  PanelLeft,
  Plus,
  RotateCw,
  X,
  type IconNode,
} from "lucide";
import * as lucideIcons from "lucide";
import { hexToRgba } from "../shared/colors";
import type { MenuAction, RhinoApi } from "../shared/ipc";
import {
  findService,
  SERVICES,
  SERVICE_CATEGORIES,
  type Service,
} from "../shared/services";

declare global {
  interface Window {
    rhino: RhinoApi;
  }
}

const WEBVIEW_PARTITION = "persist:rhino-services";

const ICON_LIBRARY = lucideIcons as unknown as Record<string, IconNode | undefined>;

function lucideIcon(name: string, className: string): SVGElement {
  const node = ICON_LIBRARY[name] ?? FileLock2;
  const el = createElement(node);
  el.setAttribute("class", className);
  return el;
}

function setButtonIcon(id: string, node: IconNode): void {
  const button = document.getElementById(id);
  if (!button) return;
  const svg = createElement(node);
  svg.setAttribute("class", "size-4");
  button.replaceChildren(svg);
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

interface Tab {
  id: string;
  service: Service | null;
  title: string;
  wrapper: HTMLDivElement | null;
  webview: Electron.WebviewTag | null;
  tabEl: HTMLDivElement;
  labelEl: HTMLSpanElement;
}

const DEFAULT_ACCENT = "#9235ff";

const dom = {
  shell: el<HTMLDivElement>("app-shell"),
  nav: el<HTMLElement>("service-nav"),
  container: el<HTMLDivElement>("view-container"),
  welcome: el<HTMLDivElement>("welcome"),
  tabStrip: el<HTMLDivElement>("tab-strip"),
  loadingBar: el<HTMLDivElement>("loading-bar"),
  activeIcon: el<HTMLSpanElement>("active-icon"),
  activeTitle: el<HTMLParagraphElement>("active-title"),
  activeUrl: el<HTMLParagraphElement>("active-url"),
  toggleSidebar: el<HTMLButtonElement>("toggle-sidebar"),
  back: el<HTMLButtonElement>("nav-back"),
  forward: el<HTMLButtonElement>("nav-forward"),
  reload: el<HTMLButtonElement>("nav-reload"),
  external: el<HTMLButtonElement>("nav-external"),
};

const tabs: Tab[] = [];
const serviceButtons = new Map<string, HTMLButtonElement>();
let activeTabId: string | null = null;
let tabSeq = 0;

const SIDEBAR_KEY = "rhino:sidebar-collapsed";

function setSidebarCollapsed(collapsed: boolean): void {
  dom.shell.classList.toggle("sidebar-collapsed", collapsed);
  dom.toggleSidebar.setAttribute("aria-pressed", collapsed ? "true" : "false");
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  } catch {
    return;
  }
}

function toggleSidebar(): void {
  setSidebarCollapsed(!dom.shell.classList.contains("sidebar-collapsed"));
}

function activeTab(): Tab | null {
  return activeTabId ? (tabs.find((t) => t.id === activeTabId) ?? null) : null;
}

function activeWebview(): Electron.WebviewTag | null {
  return activeTab()?.webview ?? null;
}

function isPrimaryModifier(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return window.rhino.platform === "darwin" ? event.metaKey : event.ctrlKey;
}

function updateNavButtons(): void {
  const wv = activeWebview();
  dom.back.toggleAttribute("disabled", !wv || !wv.canGoBack());
  dom.forward.toggleAttribute("disabled", !wv || !wv.canGoForward());
  dom.reload.toggleAttribute("disabled", !wv);
  dom.external.toggleAttribute("disabled", !wv);
}

function setLoading(isLoading: boolean): void {
  dom.loadingBar.classList.toggle("is-loading", isLoading);
}

function createTab(service: Service | null): Tab {
  const id = `tab-${++tabSeq}`;
  const accent = service?.accent ?? DEFAULT_ACCENT;
  const name = service?.name ?? "New Tab";

  const tabEl = document.createElement("div");
  tabEl.className = "tab";
  tabEl.setAttribute("role", "tab");
  tabEl.style.setProperty("--accent", accent);

  const chip = document.createElement("span");
  chip.className = "tab-chip";
  chip.style.color = accent;
  if (service) {
    chip.appendChild(lucideIcon(service.icon, "size-3.5"));
  } else {
    const plus = createElement(Plus);
    plus.setAttribute("class", "size-3.5");
    chip.appendChild(plus);
  }

  const labelEl = document.createElement("span");
  labelEl.className = "tab-label";
  labelEl.textContent = name;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "tab-close";
  close.title = "Close tab (⌘/Ctrl W)";
  close.setAttribute("aria-label", `Close ${name} tab`);
  const x = createElement(X);
  x.setAttribute("class", "size-3");
  close.appendChild(x);

  tabEl.append(chip, labelEl, close);
  dom.tabStrip.appendChild(tabEl);

  const tab: Tab = {
    id,
    service,
    title: name,
    wrapper: null,
    webview: null,
    tabEl,
    labelEl,
  };

  if (service) {
    const wrapper = document.createElement("div");
    wrapper.className = "pane";

    const webview = document.createElement("webview") as Electron.WebviewTag;
    webview.setAttribute("partition", WEBVIEW_PARTITION);
    webview.setAttribute("allowpopups", "");
    webview.setAttribute("src", service.url);
    webview.className = "h-full w-full is-loading-bg";
    wrapper.appendChild(webview);
    dom.container.appendChild(wrapper);

    tab.wrapper = wrapper;
    tab.webview = webview;

    webview.addEventListener("did-start-loading", () => {
      webview.classList.add("is-loading-bg");
      if (activeTabId === id) setLoading(true);
    });
    webview.addEventListener("did-stop-loading", () => {
      webview.classList.remove("is-loading-bg");
      if (activeTabId === id) {
        setLoading(false);
        updateNavButtons();
      }
    });
    webview.addEventListener("page-title-updated", (event) => {
      const e = event as Electron.PageTitleUpdatedEvent;
      tab.title = e.title || name;
      labelEl.textContent = tab.title;
      tabEl.title = tab.title;
      if (activeTabId === id) dom.activeUrl.textContent = tab.title;
    });
  }

  tabEl.addEventListener("click", () => selectTab(id));
  tabEl.addEventListener("auxclick", (event) => {
    if (event.button === 1) {
      event.preventDefault();
      closeTab(id);
    }
  });
  close.addEventListener("click", (event) => {
    event.stopPropagation();
    closeTab(id);
  });

  tabs.push(tab);
  dom.tabStrip.classList.remove("is-empty");
  return tab;
}

function syntheticService(url: string): Service {
  let name: string;
  try {
    name = new URL(url).hostname || url;
  } catch {
    name = url;
  }
  return {
    id: `external:${url}`,
    name,
    tag: "Link",
    description: "",
    url,
    accent: DEFAULT_ACCENT,
    icon: "Globe",
    category: "External",
  };
}

function openEmptyTab(): void {
  const tab = createTab(null);
  selectTab(tab.id);
}

function openUrl(url: string): void {
  const tab = createTab(syntheticService(url));
  selectTab(tab.id);
}

function renderActiveChrome(): void {
  const tab = activeTab();

  for (const t of tabs) {
    const isActive = t.id === activeTabId;
    t.wrapper?.classList.toggle("is-active", isActive);
    t.tabEl.classList.toggle("is-active", isActive);
    t.tabEl.setAttribute("aria-selected", isActive ? "true" : "false");
  }

  for (const [serviceId, button] of serviceButtons) {
    const isActive = !!tab?.service && tab.service.id === serviceId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "true" : "false");
  }

  if (!tab || !tab.service) {
    dom.welcome.classList.remove("is-hidden");
    dom.activeTitle.textContent = "Rhino Team Services";
    dom.activeUrl.textContent = "Select a service from the sidebar";
    dom.activeIcon.className =
      "hidden size-7 shrink-0 items-center justify-center rounded-md ring-1";
    dom.activeIcon.replaceChildren();
    setLoading(false);
    updateNavButtons();
    return;
  }

  const { service } = tab;
  dom.welcome.classList.add("is-hidden");
  dom.activeTitle.textContent = service.name;
  dom.activeUrl.textContent = tab.title !== service.name ? tab.title : service.url;
  dom.activeIcon.className =
    "flex size-7 shrink-0 items-center justify-center rounded-md ring-1 transition";
  dom.activeIcon.style.backgroundColor = hexToRgba(service.accent, 0.15);
  dom.activeIcon.style.color = service.accent;
  dom.activeIcon.style.setProperty("--tw-ring-color", hexToRgba(service.accent, 0.3));
  dom.activeIcon.replaceChildren(lucideIcon(service.icon, "size-4"));

  setLoading(tab.webview?.isLoading?.() ?? false);
  updateNavButtons();
}

function selectTab(id: string): void {
  if (activeTabId === id) return;
  activeTabId = id;
  renderActiveChrome();
  activeTab()?.webview?.focus();
}

function openService(serviceId: string, options: { newTab?: boolean } = {}): void {
  const service = findService(serviceId);
  if (!service) return;

  const current = activeTab();
  const emptyTab = current && !current.service ? current : null;

  if (!options.newTab) {
    const existing = tabs.find((t) => t.service?.id === serviceId);
    if (existing) {
      selectTab(existing.id);
      if (emptyTab && emptyTab.id !== existing.id) closeTab(emptyTab.id);
      return;
    }
  }

  const tab = createTab(service);
  selectTab(tab.id);
  if (emptyTab) closeTab(emptyTab.id);
}

function closeTab(id: string): void {
  const index = tabs.findIndex((t) => t.id === id);
  if (index === -1) return;

  const [tab] = tabs.splice(index, 1);
  tab.tabEl.remove();
  tab.wrapper?.remove();
  tab.webview?.remove();

  if (tabs.length === 0) {
    dom.tabStrip.classList.add("is-empty");
  }

  if (activeTabId === id) {
    const next = tabs[index] ?? tabs[index - 1] ?? null;
    activeTabId = next?.id ?? null;
    renderActiveChrome();
    next?.webview?.focus();
  } else {
    renderActiveChrome();
  }
}

function cycleTab(direction: "next" | "prev"): void {
  if (tabs.length < 2) return;
  const current = tabs.findIndex((t) => t.id === activeTabId);
  const base = current === -1 ? 0 : current;
  const offset = direction === "next" ? 1 : -1;
  const next = tabs[(base + offset + tabs.length) % tabs.length];
  selectTab(next.id);
}

function buildSidebar(): void {
  let globalIndex = 0;

  for (const category of SERVICE_CATEGORIES) {
    const heading = document.createElement("p");
    heading.className = "service-category";
    heading.textContent = category.name;
    dom.nav.appendChild(heading);

    for (const service of category.services) {
      const index = globalIndex++;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "service-item";
      button.style.setProperty("--accent", service.accent);
      button.style.animationDelay = `${index * 45}ms`;

      const chip = document.createElement("span");
      chip.className = "service-chip";
      chip.style.backgroundColor = hexToRgba(service.accent, 0.15);
      chip.style.color = service.accent;
      chip.style.setProperty("--tw-ring-color", hexToRgba(service.accent, 0.3));
      chip.appendChild(lucideIcon(service.icon, "size-4"));

      const text = document.createElement("span");
      text.className = "min-w-0 flex-1";
      text.innerHTML = `<span class="block truncate font-medium text-white">${service.name}</span><span class="block truncate text-xs text-slate-400">${service.tag}</span>`;

      const kbd = document.createElement("kbd");
      kbd.className = "service-kbd";
      kbd.textContent = String(index + 1);

      button.append(chip, text);
      if (index < 9) button.append(kbd);
      button.title = `${service.name} — click to open, ⌘/Ctrl-click for a new tab`;
      button.addEventListener("click", (event) => {
        openService(service.id, { newTab: isPrimaryModifier(event) });
      });
      button.addEventListener("auxclick", (event) => {
        if (event.button === 1) {
          event.preventDefault();
          openService(service.id, { newTab: true });
        }
      });

      dom.nav.appendChild(button);
      serviceButtons.set(service.id, button);
    }
  }
}

function handleMenu(action: MenuAction): void {
  const wv = activeWebview();
  switch (action.type) {
    case "select-service":
      openService(action.id);
      break;
    case "new-tab": {
      if (action.url) openUrl(action.url);
      else if (action.id) openService(action.id, { newTab: true });
      else openEmptyTab();
      break;
    }
    case "close-tab":
      if (activeTabId) closeTab(activeTabId);
      else window.close();
      break;
    case "cycle-tab":
      cycleTab(action.direction);
      break;
    case "navigate":
      if (!wv) return;
      if (action.direction === "back" && wv.canGoBack()) wv.goBack();
      if (action.direction === "forward" && wv.canGoForward()) wv.goForward();
      break;
    case "reload":
      wv?.reload();
      break;
    case "open-external": {
      const service = activeTab()?.service;
      if (service) window.open(service.url, "_blank");
      break;
    }
    case "zoom":
      if (!wv) return;
      if (action.direction === "reset") wv.setZoomLevel(0);
      else wv.setZoomLevel(wv.getZoomLevel() + (action.direction === "in" ? 0.5 : -0.5));
      break;
    case "toggle-sidebar":
      toggleSidebar();
      break;
  }
}

setButtonIcon("toggle-sidebar", PanelLeft);
setButtonIcon("nav-back", ChevronLeft);
setButtonIcon("nav-forward", ChevronRight);
setButtonIcon("nav-reload", RotateCw);
setButtonIcon("nav-external", ExternalLink);

dom.toggleSidebar.addEventListener("click", toggleSidebar);
dom.back.addEventListener("click", () =>
  handleMenu({ type: "navigate", direction: "back" }),
);
dom.forward.addEventListener("click", () =>
  handleMenu({ type: "navigate", direction: "forward" }),
);
dom.reload.addEventListener("click", () => handleMenu({ type: "reload" }));
dom.external.addEventListener("click", () => handleMenu({ type: "open-external" }));

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && !event.metaKey && !event.altKey && event.key === "Tab") {
    event.preventDefault();
    cycleTab(event.shiftKey ? "prev" : "next");
    return;
  }

  const modifier = isPrimaryModifier(event);
  if (!modifier || event.altKey) return;

  if (!event.shiftKey && event.key.toLowerCase() === "w") {
    event.preventDefault();
    if (activeTabId) closeTab(activeTabId);
    return;
  }

  if (event.shiftKey) return;

  if (event.key.toLowerCase() === "b") {
    event.preventDefault();
    toggleSidebar();
    return;
  }

  if (event.key.toLowerCase() === "t") {
    event.preventDefault();
    handleMenu({ type: "new-tab" });
    return;
  }

  if (/^[1-9]$/.test(event.key)) {
    const service = SERVICES[Number(event.key) - 1];
    if (service) {
      event.preventDefault();
      openService(service.id);
    }
  }
});

window.rhino.onMenu(handleMenu);
document.documentElement.classList.add(`platform-${window.rhino.platform}`);

let storedCollapsed: boolean;
try {
  storedCollapsed = localStorage.getItem(SIDEBAR_KEY) === "1";
} catch {
  storedCollapsed = false;
}
setSidebarCollapsed(storedCollapsed);

buildSidebar();
renderActiveChrome();
