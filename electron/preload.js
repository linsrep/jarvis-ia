import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("jarvisDesktop", {
  platform: process.platform,
  hideWindow: () => ipcRenderer.invoke("jarvis:hide-window"),
});
