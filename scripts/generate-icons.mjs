import { app, BrowserWindow } from "electron";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = join(root, "assets", "logo.svg");

const buildDir = join(root, "build");
const rendererAssets = join(root, "src", "renderer", "assets");
mkdirSync(buildDir, { recursive: true });
mkdirSync(rendererAssets, { recursive: true });

const MASTER = 1024;

const DOCK_CONTENT_SCALE = 0.8;

async function renderMasters(contentScales) {
  const win = new BrowserWindow({
    width: 64,
    height: 64,
    show: false,
    webPreferences: { backgroundThrottling: false, offscreen: true },
  });

  const svgUrl = pathToFileURL(svgPath).href;
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>`;
  const tmpHtml = join(buildDir, ".render.html");
  writeFileSync(tmpHtml, html);
  await win.loadFile(tmpHtml);

  const dataUrls = await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const render = (contentScale) => {
          const canvas = document.createElement("canvas");
          canvas.width = ${MASTER};
          canvas.height = ${MASTER};
          const ctx = canvas.getContext("2d");
          const draw = Math.round(${MASTER} * contentScale);
          const offset = Math.round((${MASTER} - draw) / 2);
          ctx.drawImage(img, offset, offset, draw, draw);
          return canvas.toDataURL("image/png");
        };
        resolve(${JSON.stringify(contentScales)}.map(render));
      };
      img.onerror = () => reject(new Error("Failed to load logo.svg into <img>"));
      img.src = ${JSON.stringify(svgUrl)};
    });
  `);

  win.destroy();
  rmSync(tmpHtml, { force: true });
  return dataUrls.map((url) =>
    Buffer.from(url.replace(/^data:image\/png;base64,/, ""), "base64"),
  );
}

function resize(src, size, dest) {
  copyFileSync(src, dest);
  execFileSync("sips", ["-z", String(size), String(size), dest], { stdio: "ignore" });
}

app.whenReady().then(async () => {
  const [fullBleed, dock] = await renderMasters([1, DOCK_CONTENT_SCALE]);

  const master = join(buildDir, "icon-full.png");
  writeFileSync(master, fullBleed);
  resize(master, 512, join(rendererAssets, "logo.png"));
  rmSync(master, { force: true });

  const dockMaster = join(buildDir, "icon.png");
  writeFileSync(dockMaster, dock);

  if (process.platform === "darwin") {
    const iconset = join(buildDir, "icon.iconset");
    rmSync(iconset, { recursive: true, force: true });
    mkdirSync(iconset, { recursive: true });
    const map = [
      [16, "icon_16x16.png"],
      [32, "icon_16x16@2x.png"],
      [32, "icon_32x32.png"],
      [64, "icon_32x32@2x.png"],
      [128, "icon_128x128.png"],
      [256, "icon_128x128@2x.png"],
      [256, "icon_256x256.png"],
      [512, "icon_256x256@2x.png"],
      [512, "icon_512x512.png"],
      [1024, "icon_512x512@2x.png"],
    ];
    for (const [size, name] of map) {
      resize(dockMaster, size, join(iconset, name));
    }
    execFileSync("iconutil", ["-c", "icns", iconset, "-o", join(buildDir, "icon.icns")]);
    rmSync(iconset, { recursive: true, force: true });
    console.log("Wrote build/icon.icns");
  }

  console.log("Wrote build/icon.png and src/renderer/assets/logo.png");
  app.quit();
});
