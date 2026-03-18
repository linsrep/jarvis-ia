import { app, BrowserWindow, Menu, Tray, nativeImage, screen, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WINDOW_WIDTH = 400;
const WINDOW_HEIGHT = 680;

let tray = null;
let trayWindow = null;

function getAssetPath(...segments) {
  return path.join(__dirname, "..", ...segments);
}

function getTrayIcon() {
  const iconPath = getAssetPath("public", "favicon.ico");
  const icon = nativeImage.createFromPath(iconPath);

  if (process.platform === "win32") {
    return icon.resize({ width: 16, height: 16 });
  }

  return icon;
}

function createTrayWindow() {
  trayWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_WIDTH,
    minHeight: WINDOW_HEIGHT,
    maxWidth: WINDOW_WIDTH,
    maxHeight: WINDOW_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    transparent: true,
    backgroundColor: "#00000000",
    autoHideMenuBar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: getAssetPath("electron", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl = process.env.ELECTRON_START_URL;

  if (startUrl) {
    trayWindow.loadURL(startUrl);
  } else {
    trayWindow.loadFile(getAssetPath("dist", "index.html"));
  }

  trayWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      trayWindow.hide();
    }
  });
}

function getWindowPosition() {
  if (!tray || !trayWindow) {
    return { x: 0, y: 0 };
  }

  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  });
  const { bounds, workArea } = display;
  const margin = 12;
  const windowBounds = trayWindow.getBounds();
  const windowWidth = windowBounds.width || WINDOW_WIDTH;
  const windowHeight = windowBounds.height || WINDOW_HEIGHT;

  const isTaskbarTop = workArea.y > bounds.y;
  const isTaskbarLeft = workArea.x > bounds.x;
  const isTaskbarRight = workArea.x + workArea.width < bounds.x + bounds.width;

  let x = trayBounds.x + Math.round(trayBounds.width / 2) - Math.round(windowWidth / 2);
  let y = trayBounds.y + trayBounds.height + 8;

  if (isTaskbarTop) {
    y = workArea.y + margin;
  } else if (isTaskbarLeft) {
    x = workArea.x + margin;
    y = trayBounds.y + Math.round(trayBounds.height / 2) - Math.round(windowHeight / 2);
  } else if (isTaskbarRight) {
    x = workArea.x + workArea.width - windowWidth - margin;
    y = trayBounds.y + Math.round(trayBounds.height / 2) - Math.round(windowHeight / 2);
  } else {
    y = workArea.y + workArea.height - windowHeight - margin;
  }

  x = Math.round(
    Math.min(
      Math.max(workArea.x + margin, x),
      workArea.x + workArea.width - windowWidth - margin,
    ),
  );

  y = Math.round(
    Math.min(
      Math.max(workArea.y + margin, y),
      workArea.y + workArea.height - windowHeight - margin,
    ),
  );

  return { x, y };
}

function toggleTrayWindow() {
  if (!trayWindow) {
    return;
  }

  if (trayWindow.isVisible()) {
    trayWindow.hide();
    return;
  }

  const { x, y } = getWindowPosition();
  trayWindow.setPosition(x, y, false);
  trayWindow.show();
  trayWindow.focus();
}

function createTray() {
  tray = new Tray(getTrayIcon());
  tray.setToolTip("Jarvis");
  tray.on("click", toggleTrayWindow);
  tray.on("right-click", () => {
    tray.popUpContextMenu(
      Menu.buildFromTemplate([
        { label: "Abrir Jarvis", click: toggleTrayWindow },
        {
          label: "Sair",
          click: () => {
            app.isQuitting = true;
            app.quit();
          },
        },
      ]),
    );
  });
}

ipcMain.handle("jarvis:hide-window", () => {
  trayWindow?.hide();
  return true;
});

app.whenReady().then(() => {
  createTrayWindow();
  createTray();

  app.on("activate", () => {
    if (!trayWindow) {
      createTrayWindow();
    } else {
      toggleTrayWindow();
    }
  });
});

app.on("before-quit", () => {
  app.isQuitting = true;
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});
