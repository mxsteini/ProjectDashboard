const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dashboardApi", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (config) => ipcRenderer.invoke("config:save", config),
  getUiState: () => ipcRenderer.invoke("ui-state:get"),
  saveUiState: (uiState) => ipcRenderer.invoke("ui-state:save", uiState),
  pickDirectory: (payload) => ipcRenderer.invoke("directory:pick", payload),
  refreshProject: (project) => ipcRenderer.invoke("project:refresh", project),
  runDdev: (payload) => ipcRenderer.invoke("ddev:run", payload),
  runGit: (payload) => ipcRenderer.invoke("git:run", payload),
  openLauncher: (payload) => ipcRenderer.invoke("launcher:open", payload),
  openPath: (payload) => ipcRenderer.invoke("path:open", payload),
  openBrowserUrl: (payload) => ipcRenderer.invoke("browser:open", payload),
  openSsh: (payload) => ipcRenderer.invoke("ssh:open", payload),
});
