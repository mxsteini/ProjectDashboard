const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs/promises");
const { existsSync } = require("fs");
const { execFile, spawn } = require("child_process");
const yaml = require("js-yaml");
const fg = require("fast-glob");

function getConfigPath() {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "dashboard", "config.json");
  }
  return path.join(os.homedir(), ".config", "dashboard", "config.json");
}

function getUiStatePath() {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "dashboard", "ui-state.json");
  }
  return path.join(os.homedir(), ".config", "dashboard", "ui-state.json");
}

function defaultUiState() {
  return {
    configEditorOpen: false,
    dashboardSettingsOpen: false,
    dashboardSettingsActiveWidget: "project",
    dashboardSettingsActiveSubtab: "gridsetup",
    lastSelectedProjectRef: "",
    dashboardLayouts: {},
    collapsedCustomers: [],
    collapsedManagers: [],
    windowBounds: {
      width: 1400,
      height: 900,
    },
  };
}

async function ensureConfig(configPath) {
  const dir = path.dirname(configPath);
  await fs.mkdir(dir, { recursive: true });
  if (!existsSync(configPath)) {
    const starterConfig = {
      customers: [
        {
          name: "Beispiel Kunde",
          projectManagers: [
            {
              name: "Max Mustermann",
              projects: [
                {
                  path: path.join(os.homedir(), "Projekte", "beispiel-projekt"),
                },
              ],
            },
          ],
        },
      ],
    };
    await fs.writeFile(configPath, JSON.stringify(starterConfig, null, 2), "utf8");
  }
}

async function ensureUiState(uiStatePath) {
  const dir = path.dirname(uiStatePath);
  await fs.mkdir(dir, { recursive: true });
  if (!existsSync(uiStatePath)) {
    await fs.writeFile(uiStatePath, JSON.stringify(defaultUiState(), null, 2), "utf8");
  }
}

async function loadConfig() {
  const configPath = getConfigPath();
  await ensureConfig(configPath);
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = normalizeConfig(JSON.parse(raw));
  if (!parsed || !Array.isArray(parsed.customers)) {
    throw new Error("Konfiguration ungueltig: 'customers' fehlt oder ist kein Array.");
  }
  return { configPath, config: parsed };
}

function normalizeUiState(input) {
  const defaults = defaultUiState();
  const source = input && typeof input === "object" ? input : {};
  const width = Number(source?.windowBounds?.width);
  const height = Number(source?.windowBounds?.height);

  return {
    configEditorOpen:
      typeof source.configEditorOpen === "boolean" ? source.configEditorOpen : defaults.configEditorOpen,
    dashboardSettingsOpen:
      typeof source.dashboardSettingsOpen === "boolean"
        ? source.dashboardSettingsOpen
        : defaults.dashboardSettingsOpen,
    dashboardSettingsActiveWidget:
      typeof source.dashboardSettingsActiveWidget === "string" && source.dashboardSettingsActiveWidget
        ? source.dashboardSettingsActiveWidget
        : defaults.dashboardSettingsActiveWidget,
    dashboardSettingsActiveSubtab:
      typeof source.dashboardSettingsActiveSubtab === "string" && source.dashboardSettingsActiveSubtab
        ? source.dashboardSettingsActiveSubtab
        : defaults.dashboardSettingsActiveSubtab,
    lastSelectedProjectRef:
      typeof source.lastSelectedProjectRef === "string" ? source.lastSelectedProjectRef : defaults.lastSelectedProjectRef,
    dashboardLayouts:
      source.dashboardLayouts && typeof source.dashboardLayouts === "object" && !Array.isArray(source.dashboardLayouts)
        ? source.dashboardLayouts
        : defaults.dashboardLayouts,
    collapsedCustomers: Array.isArray(source.collapsedCustomers)
      ? source.collapsedCustomers.map(String)
      : defaults.collapsedCustomers,
    collapsedManagers: Array.isArray(source.collapsedManagers)
      ? source.collapsedManagers.map(String)
      : defaults.collapsedManagers,
    windowBounds: {
      width: Number.isFinite(width) && width >= 900 ? width : defaults.windowBounds.width,
      height: Number.isFinite(height) && height >= 600 ? height : defaults.windowBounds.height,
    },
  };
}

async function loadUiState() {
  const uiStatePath = getUiStatePath();
  await ensureUiState(uiStatePath);
  const raw = await fs.readFile(uiStatePath, "utf8");
  return { uiStatePath, uiState: normalizeUiState(JSON.parse(raw)) };
}

async function saveUiState(uiState) {
  const { uiStatePath } = await loadUiState();
  const normalized = normalizeUiState(uiState);
  await fs.writeFile(uiStatePath, JSON.stringify(normalized, null, 2), "utf8");
  return { ok: true, uiStatePath, uiState: normalized };
}

function normalizeConfig(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.customers)) {
    throw new Error("Konfiguration ungueltig: 'customers' fehlt oder ist kein Array.");
  }

  const customers = input.customers.map((customer) => {
    if (!customer || typeof customer !== "object" || !customer.name) {
      throw new Error("Konfiguration ungueltig: Kunde ohne Namen gefunden.");
    }

    if (Array.isArray(customer.projectManagers)) {
      return {
        name: String(customer.name),
        projectManagers: customer.projectManagers.map((manager) => ({
          name: String(manager?.name || "Unbenannter Projektmanager"),
          projects: Array.isArray(manager?.projects)
            ? manager.projects.map((project) => ({
                name: String(project?.name || path.basename(project?.path || "Projekt")),
                path: String(project?.path || ""),
                ...(project?.widgets ? { widgets: project.widgets } : {}),
              }))
            : [],
        })),
      };
    }

    // Backward compatibility: old format with customer.projects + projectManager field.
    const projectMap = new Map();
    for (const project of customer.projects || []) {
      const managerName = String(project?.projectManager || "Ohne Projektmanager");
      if (!projectMap.has(managerName)) {
        projectMap.set(managerName, []);
      }
      projectMap.get(managerName).push({
        name: String(project?.name || path.basename(project?.path || "Projekt")),
        path: String(project?.path || ""),
        ...(project?.widgets ? { widgets: project.widgets } : {}),
      });
    }

    return {
      name: String(customer.name),
      projectManagers: Array.from(projectMap.entries()).map(([name, projects]) => ({ name, projects })),
    };
  });

  return { customers };
}

async function saveConfig(config) {
  const { configPath } = await loadConfig();
  const normalized = normalizeConfig(config);
  await fs.writeFile(configPath, JSON.stringify(normalized, null, 2), "utf8");
  return { ok: true, configPath, config: normalized };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    execFile(command, args, { ...options, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error ? error.code : 0,
        stdout: String(stdout || "").trim(),
        stderr: String(stderr || "").trim(),
      });
    });
  });
}

function bashQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function isSafeSshToken(value) {
  return typeof value === "string" && /^[a-zA-Z0-9._-]+$/.test(value);
}

async function getDiskUsage(projectPath) {
  if (process.platform === "win32") {
    return { ok: false, message: "Disk Usage via 'du' ist auf Windows nicht verfuegbar." };
  }
  const result = await runCommand("du", ["-sh", projectPath]);
  if (!result.ok) {
    return { ok: false, message: result.stderr || "Disk Usage konnte nicht ermittelt werden." };
  }
  const size = result.stdout.split(/\s+/)[0] || "n/a";
  return { ok: true, size };
}

async function getGitInfo(projectPath) {
  const inRepo = await runCommand("git", ["-C", projectPath, "rev-parse", "--is-inside-work-tree"]);
  if (!inRepo.ok) {
    return { ok: false, inRepo: false, message: "Kein Git-Repository." };
  }

  const branch = await runCommand("git", ["-C", projectPath, "branch", "--show-current"]);
  const branchesResult = await runCommand("git", [
    "-C",
    projectPath,
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads",
  ]);

  const branches = branchesResult.ok
    ? branchesResult.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [];

  return {
    ok: true,
    inRepo: true,
    branch: branch.stdout || "n/a",
    currentBranch: branch.stdout || "",
    branches,
  };
}

function isSafeBranchName(value) {
  return typeof value === "string" && /^[a-zA-Z0-9._/-]+$/.test(value);
}

async function runGitAction(projectPath, action, branch) {
  if (action === "checkout") {
    if (!isSafeBranchName(branch)) {
      return { ok: false, code: 1, stdout: "", stderr: "Ungueltiger Branchname." };
    }
    return runCommand("git", ["-C", projectPath, "checkout", branch]);
  }
  return { ok: false, code: 1, stdout: "", stderr: `Unbekannte Git-Aktion: ${action}` };
}

async function getDdevStatus(projectPath) {
  return runCommand("ddev", ["status"], { cwd: projectPath });
}

async function runDdevAction(projectPath, action) {
  if (!["start", "stop", "restart", "status"].includes(action)) {
    return { ok: false, code: 1, stdout: "", stderr: `Unbekannte DDEV-Aktion: ${action}` };
  }
  if (action === "status") {
    return getDdevStatus(projectPath);
  }
  return runCommand("ddev", [action], { cwd: projectPath });
}

async function collectProjectUrls(projectPath) {
  const urls = new Set();
  const ddevConfig = path.join(projectPath, ".ddev", "config.yaml");
  const siteFiles = await fg(["config/sites/**/*.yaml", "config/sites/**/*.yml"], {
    cwd: projectPath,
    onlyFiles: true,
    absolute: true,
    suppressErrors: true,
  });

  if (existsSync(ddevConfig)) {
    try {
      const ddevRaw = await fs.readFile(ddevConfig, "utf8");
      const parsed = yaml.load(ddevRaw);
      const additional = parsed?.additional_hostnames || [];
      const primary = parsed?.name ? `https://${parsed.name}.ddev.site` : null;
      if (primary) {
        urls.add(primary);
      }
      if (Array.isArray(additional)) {
        additional
          .filter(Boolean)
          .forEach((name) => {
            urls.add(`https://${name}.ddev.site`);
          });
      }
    } catch (_error) {
      // Ignore parse errors and continue with site config scan.
    }
  }

  for (const file of siteFiles) {
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = yaml.load(raw);
      const maybeBase = parsed?.base;
      if (typeof maybeBase === "string" && /^https?:\/\//.test(maybeBase)) {
        urls.add(maybeBase.replace(/\/+$/, ""));
      }
    } catch (_error) {
      // Continue scanning other files.
    }
  }

  return Array.from(urls);
}

function openTerminalAt(projectPath, commandText) {
  if (process.platform === "linux") {
    const terminal = "x-terminal-emulator";
    const quotedPath = bashQuote(projectPath);
    const args = commandText
      ? ["-e", `bash -lc "cd ${quotedPath} && ${commandText}; exec bash"`]
      : ["-e", `bash -lc "cd ${quotedPath}; exec bash"`];
    return spawn(terminal, args, { detached: true, stdio: "ignore" }).unref();
  }

  if (process.platform === "darwin") {
    const quotedPath = bashQuote(projectPath);
    const script = commandText
      ? `tell app "Terminal" to do script "cd ${quotedPath} && ${commandText}"`
      : `tell app "Terminal" to do script "cd ${quotedPath}"`;
    return execFile("osascript", ["-e", script], () => {});
  }

  if (process.platform === "win32") {
    const cmd = commandText ? `cd /d "${projectPath}" && ${commandText}` : `cd /d "${projectPath}"`;
    return spawn("cmd.exe", ["/c", "start", "cmd.exe", "/k", cmd], {
      detached: true,
      stdio: "ignore",
    }).unref();
  }

  return null;
}

function openProgram(projectPath, program) {
  if (program === "cursor") {
    return runCommand("cursor", [projectPath]);
  }
  if (program === "vscode") {
    return runCommand("code", [projectPath]);
  }
  if (program === "explorer") {
    return shell.openPath(projectPath);
  }
  if (program === "terminal") {
    openTerminalAt(projectPath, "");
    return Promise.resolve();
  }
  return Promise.reject(new Error(`Unbekanntes Programm: ${program}`));
}

let windowStateSaveTimer = null;

function scheduleWindowStateSave(win) {
  if (windowStateSaveTimer) {
    clearTimeout(windowStateSaveTimer);
  }
  windowStateSaveTimer = setTimeout(async () => {
    try {
      const bounds = win.getBounds();
      const currentUiState = (await loadUiState()).uiState;
      await saveUiState({
        ...currentUiState,
        windowBounds: {
          width: bounds.width,
          height: bounds.height,
        },
      });
    } catch (_error) {
      // Ignore state write failures to avoid blocking app usage.
    }
  }, 250);
}

async function createWindow() {
  const { uiState } = await loadUiState();
  const win = new BrowserWindow({
    width: uiState.windowBounds.width,
    height: uiState.windowBounds.height,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.on("resize", () => scheduleWindowStateSave(win));
  win.on("close", () => scheduleWindowStateSave(win));
}

ipcMain.handle("config:get", async () => {
  try {
    return { ok: true, ...(await loadConfig()) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("config:save", async (_event, config) => {
  try {
    return await saveConfig(config);
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("ui-state:get", async () => {
  try {
    return { ok: true, ...(await loadUiState()) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("ui-state:save", async (_event, uiState) => {
  try {
    return await saveUiState(uiState);
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("directory:pick", async (event, payload) => {
  try {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    const startPath = payload?.startPath && String(payload.startPath).trim()
      ? String(payload.startPath).trim()
      : os.homedir();
    const result = await dialog.showOpenDialog(browserWindow, {
      title: "Projektverzeichnis waehlen",
      defaultPath: startPath,
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths?.length) {
      return { ok: false, canceled: true };
    }
    return { ok: true, path: result.filePaths[0] };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("project:refresh", async (_event, project) => {
  try {
    const projectPath = project.path;
    const [diskUsage, gitInfo, ddevStatus, urls] = await Promise.all([
      getDiskUsage(projectPath),
      getGitInfo(projectPath),
      getDdevStatus(projectPath),
      collectProjectUrls(projectPath),
    ]);

    return {
      ok: true,
      data: {
        diskUsage,
        gitInfo,
        ddevStatus,
        urls,
      },
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("ddev:run", async (_event, { projectPath, action }) => {
  return runDdevAction(projectPath, action);
});

ipcMain.handle("git:run", async (_event, { projectPath, action, branch }) => {
  return runGitAction(projectPath, action, branch);
});

ipcMain.handle("launcher:open", async (_event, { projectPath, program }) => {
  try {
    await openProgram(projectPath, program);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("browser:open", async (_event, { url }) => {
  try {
    await shell.openExternal(url);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("ssh:open", async (_event, { projectPath, host, username }) => {
  try {
    if (!host || !username) {
      return { ok: false, error: "Host und Username sind erforderlich." };
    }
    if (!isSafeSshToken(host) || !isSafeSshToken(username)) {
      return { ok: false, error: "Host oder Username enthalten ungueltige Zeichen." };
    }
    openTerminalAt(projectPath, `ssh ${username}@${host}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

app.whenReady().then(async () => {
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
