const state = {
  configPath: "",
  config: null,
  selectedProjectEntry: null,
  selectedRef: "",
  projectData: null,
  uiState: {
    configEditorOpen: false,
    lastSelectedProjectRef: "",
    collapsedCustomers: [],
    collapsedManagers: [],
    dashboardSettingsOpen: false,
    dashboardSettingsActiveWidget: "project",
    dashboardSettingsActiveSubtab: "gridsetup",
    dashboardLayouts: {},
  },
  collapsedCustomers: new Set(),
  collapsedManagers: new Set(),
  draggingWidgetId: "",
  configEditorTab: "structure",
};

const el = {
  configMeta: document.getElementById("configMeta"),
  projectList: document.getElementById("projectList"),
  dashboard: document.getElementById("dashboard"),
  configEditor: document.getElementById("configEditor"),
  configModal: document.getElementById("configModal"),
  openConfigModalBtn: document.getElementById("openConfigModalBtn"),
  closeConfigModalBtn: document.getElementById("closeConfigModalBtn"),
  widgetSettingsModal: document.getElementById("widgetSettingsModal"),
  closeWidgetSettingsModalBtn: document.getElementById("closeWidgetSettingsModalBtn"),
  widgetSettingsTitle: document.getElementById("widgetSettingsTitle"),
  widgetSettingsTabBar: document.getElementById("widgetSettingsTabBar"),
  widgetSettingsContent: document.getElementById("widgetSettingsContent"),
  openAddWidgetModalBtn: document.getElementById("openAddWidgetModalBtn"),
  addWidgetModal: document.getElementById("addWidgetModal"),
  closeAddWidgetModalBtn: document.getElementById("closeAddWidgetModalBtn"),
  addWidgetList: document.getElementById("addWidgetList"),
};

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function defaultWidgets() {
  return {
    ddev: true,
    diskUsage: true,
    git: true,
    npm: true,
    filebrowser: true,
    ssh: [],
    launcher: {
      cursor: true,
      vscode: true,
      explorer: true,
      terminal: true,
    },
    browser: true,
  };
}

function defaultAppDefaults() {
  return {
    terminalCommand: "",
    fileExplorerCommand: "",
    browserCommand: "",
  };
}

function ensureAppDefaultsInState() {
  if (!state.config) return;
  state.config.appDefaults = {
    ...defaultAppDefaults(),
    ...(state.config.appDefaults || {}),
  };
}

function defaultNpmButtons() {
  return [
    {
      id: "npm_install",
      label: "npm install",
      command: "npm install",
      runInTerminal: true,
    },
    {
      id: "npm_start",
      label: "npm start",
      command: "npm start",
      runInTerminal: true,
    },
  ];
}

const COMMAND_WIDGET_PREFIX = "command::";

function isCommandWidgetId(widgetId) {
  return typeof widgetId === "string" && widgetId.startsWith(COMMAND_WIDGET_PREFIX);
}

function createCommandWidgetId() {
  return `${COMMAND_WIDGET_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultCommandWidgetSettings() {
  return {
    title: "Command",
    buttons: [],
  };
}

function defaultDdevButtons() {
  return [
    { id: "ddev_status", label: "ddev status", command: "ddev status", runInTerminal: true },
    { id: "ddev_start", label: "ddev start", command: "ddev start", runInTerminal: true },
    { id: "ddev_stop", label: "ddev stop", command: "ddev stop", runInTerminal: true },
    { id: "ddev_restart", label: "ddev restart", command: "ddev restart", runInTerminal: true },
  ];
}

function resolveWidgets(project) {
  const defaults = defaultWidgets();
  const configured = project?.widgets || {};
  const launcher = {
    ...defaults.launcher,
    ...(configured.launcher || {}),
  };
  return {
    ...defaults,
    ...configured,
    launcher,
    ssh: Array.isArray(configured.ssh) ? configured.ssh : [],
  };
}

function setDashboard(content) {
  el.dashboard.innerHTML = content;
}

function statusClass(ok) {
  if (ok === true) return "status-ok";
  if (ok === false) return "status-err";
  return "status-warn";
}

function flattenProjects() {
  const rows = [];
  for (const customer of state.config.customers) {
    for (const manager of customer.projectManagers || []) {
      for (const project of manager.projects || []) {
        rows.push({
          ref: `${customer.name}::${manager.name}::${project.name}::${project.path}`,
          customerName: customer.name,
          managerName: manager.name,
          project,
        });
      }
    }
  }
  return rows;
}

function managerOptions(customerName, currentValue = "") {
  const customer = state.config.customers.find((item) => item.name === customerName);
  const managers = customer?.projectManagers || [];
  if (managers.length === 0) {
    return `<option value="">(keine Projektmanager)</option>`;
  }
  return managers
    .map((manager) => {
      const selected = manager.name === currentValue ? "selected" : "";
      return `<option value="${escapeHtml(manager.name)}" ${selected}>${escapeHtml(manager.name)}</option>`;
    })
    .join("");
}

function customerOptions(currentValue = "") {
  if (!state.config.customers.length) {
    return `<option value="">(keine Kunden)</option>`;
  }
  return state.config.customers
    .map((customer) => {
      const selected = customer.name === currentValue ? "selected" : "";
      return `<option value="${escapeHtml(customer.name)}" ${selected}>${escapeHtml(customer.name)}</option>`;
    })
    .join("");
}

function projectOptions(customerName, managerName, currentRef = "") {
  const customer = state.config.customers.find((item) => item.name === customerName);
  const manager = customer?.projectManagers?.find((item) => item.name === managerName);
  const projects = manager?.projects || [];
  if (projects.length === 0) {
    return `<option value="">(keine Projekte)</option>`;
  }
  return projects
    .map((project) => {
      const ref = project.path;
      const selected = ref === currentRef ? "selected" : "";
      const name = project.name || project.path.split("/").filter(Boolean).pop() || "Projekt";
      return `<option value="${escapeHtml(ref)}" ${selected}>${escapeHtml(name)}</option>`;
    })
    .join("");
}

function renderConfigEditor() {
  const firstCustomer = state.config.customers[0]?.name || "";
  const firstManager = state.config.customers[0]?.projectManagers?.[0]?.name || "";
  const defaults = state.config.appDefaults || defaultAppDefaults();
  const activeStructure = state.configEditorTab === "structure";
  const activeDefaults = state.configEditorTab === "defaults";

  el.configEditor.innerHTML = `
    <div class="config-block">
      <div class="widget-settings-tabbar">
        <button class="widget-settings-tab ${activeStructure ? "active" : ""}" data-config-tab="structure">Struktur</button>
        <button class="widget-settings-tab ${activeDefaults ? "active" : ""}" data-config-tab="defaults">Defaults</button>
      </div>
      <div class="config-form">
        ${
          activeStructure
            ? `
        <label>Kontext (Kunde und Projektmanager)</label>
        <select id="customerSelect">${customerOptions(firstCustomer)}</select>
        <select id="managerSelect">${managerOptions(firstCustomer, firstManager)}</select>

        <label>Kunde</label>
        <input id="newCustomerName" type="text" placeholder="Kundenname" />
        <button id="addCustomerBtn">Kunde hinzufuegen</button>
        <button id="deleteCustomerBtn" class="danger">Kunde loeschen</button>

        <label>Projektmanager</label>
        <input id="newManagerName" type="text" placeholder="Name Projektmanager" />
        <button id="addManagerBtn">Projektmanager hinzufuegen</button>
        <button id="deleteManagerBtn" class="danger">Projektmanager loeschen</button>

        <label>Projekt / Verzeichnis</label>
        <input id="newProjectPath" type="text" placeholder="/pfad/zum/verzeichnis" />
        <button id="browseProjectPathBtn">Verzeichnis waehlen...</button>
        <button id="addProjectBtn">Verzeichnis hinzufuegen</button>
        <select id="projectDeleteSelect">${projectOptions(firstCustomer, firstManager)}</select>
        <button id="deleteProjectBtn" class="danger">Projekt loeschen</button>

        <p id="configMessage" class="meta">Struktur: Kunde -> Projektmanager -> Projekt</p>
        `
            : `
        <label>Default Terminal Kommando</label>
        <input id="defaultTerminalCommandInput" placeholder='z. B. gnome-terminal -- bash -lc "cd {path}; {command}; exec bash"' value="${escapeHtml(defaults.terminalCommand)}" />

        <label>Default Fileexplorer Kommando</label>
        <input id="defaultExplorerCommandInput" placeholder='z. B. nautilus {path}' value="${escapeHtml(defaults.fileExplorerCommand)}" />

        <label>Default Browser Kommando</label>
        <input id="defaultBrowserCommandInput" placeholder='z. B. firefox {url}' value="${escapeHtml(defaults.browserCommand)}" />

        <button id="saveAppDefaultsBtn">Defaults speichern</button>
        <p id="configMessage" class="meta">Platzhalter: {path}, {command}, {url}</p>
        `
        }
      </div>
    </div>
  `;

  bindConfigEditorEvents();
}

async function openConfigModal() {
  el.configModal.classList.remove("hidden");
  state.uiState.configEditorOpen = true;
  await persistUiState();
}

async function closeConfigModal() {
  el.configModal.classList.add("hidden");
  state.uiState.configEditorOpen = false;
  await persistUiState();
}

function bindModalEvents() {
  el.openConfigModalBtn.addEventListener("click", () => openConfigModal());
  el.closeConfigModalBtn.addEventListener("click", () => closeConfigModal());
  el.configModal.addEventListener("click", (event) => {
    if (event.target === el.configModal) {
      closeConfigModal();
    }
  });

  el.closeWidgetSettingsModalBtn.addEventListener("click", () => closeWidgetSettingsModal());
  el.widgetSettingsModal.addEventListener("click", (event) => {
    if (event.target === el.widgetSettingsModal) {
      closeWidgetSettingsModal();
    }
  });

  el.openAddWidgetModalBtn.addEventListener("click", () => openAddWidgetModal());
  el.closeAddWidgetModalBtn.addEventListener("click", () => closeAddWidgetModal());
  el.addWidgetModal.addEventListener("click", (event) => {
    if (event.target === el.addWidgetModal) {
      closeAddWidgetModal();
    }
  });
}

function getHiddenWidgets() {
  const selected = state.selectedProjectEntry;
  if (!selected) return [];
  const layout = getProjectLayoutState();
  const defs = getWidgetDefinitions();
  const byId = Object.fromEntries(defs.map((item) => [item.id, item]));
  const availableIds = defs.filter((item) => item.available).map((item) => item.id);
  const orderedIds = layout.order.filter((id) => availableIds.includes(id));
  return orderedIds
    .filter((id) => layout.widgets[id]?.visible === false)
    .map((id) => ({ id, title: byId[id]?.title || id }));
}

function updateAddWidgetButtonState() {
  const hasProject = Boolean(state.selectedProjectEntry);
  el.openAddWidgetModalBtn.disabled = !hasProject;
  el.openAddWidgetModalBtn.style.display = hasProject ? "inline-flex" : "none";
  el.openAddWidgetModalBtn.title = "Widget hinzufuegen";
}

function renderAddWidgetModal() {
  const hidden = getHiddenWidgets();
  const hiddenButtons = hidden
    .map((widget) => `<button data-add-widget="${escapeHtml(widget.id)}">${escapeHtml(widget.title)}</button>`)
    .join("");
  el.addWidgetList.innerHTML = `
    <button data-add-command-widget="true">Command Widget hinzufuegen</button>
    ${hiddenButtons || `<p class="status-warn">Keine weiteren ausgeblendeten Widgets verfuegbar.</p>`}
  `;
  const addCommandWidgetButton = el.addWidgetList.querySelector("[data-add-command-widget]");
  if (addCommandWidgetButton) {
    addCommandWidgetButton.addEventListener("click", async () => {
      const layout = getProjectLayoutState();
      const widgetId = createCommandWidgetId();
      layout.order.push(widgetId);
      layout.widgets[widgetId] = {
        ...baseWidgetState(),
        visible: true,
      };
      layout.widgetFunctions[widgetId] = defaultCommandWidgetSettings();
      await persistUiState();
      closeAddWidgetModal();
      renderDashboard();
      openWidgetSettingsModal(widgetId, "widget");
    });
  }
  el.addWidgetList.querySelectorAll("[data-add-widget]").forEach((button) => {
    button.addEventListener("click", async () => {
      const widgetId = button.getAttribute("data-add-widget");
      if (!widgetId) return;
      const layout = getProjectLayoutState();
      layout.widgets[widgetId] = {
        ...(layout.widgets[widgetId] || baseWidgetState()),
        visible: true,
      };
      await persistUiState();
      closeAddWidgetModal();
      renderDashboard();
    });
  });
}

function openAddWidgetModal() {
  if (!state.selectedProjectEntry) return;
  renderAddWidgetModal();
  el.addWidgetModal.classList.remove("hidden");
}

function closeAddWidgetModal() {
  el.addWidgetModal.classList.add("hidden");
}

async function openWidgetSettingsModal(widgetId = "project", subtab = "gridsetup") {
  if (!state.selectedProjectEntry) return;
  state.uiState.dashboardSettingsOpen = true;
  state.uiState.dashboardSettingsActiveWidget = widgetId;
  state.uiState.dashboardSettingsActiveSubtab = subtab;
  renderWidgetSettingsModal();
  el.widgetSettingsModal.classList.remove("hidden");
  await persistUiState();
}

async function closeWidgetSettingsModal() {
  state.uiState.dashboardSettingsOpen = false;
  el.widgetSettingsModal.classList.add("hidden");
  await persistUiState();
}

function widgetSettingTabs() {
  return [
    { id: "gridsetup", label: "Gridsetup" },
    { id: "widget", label: "Widgeteinstellungen" },
  ];
}

function renderWidgetSettingsModal() {
  const layout = getProjectLayoutState();
  if (!layout) {
    el.widgetSettingsTitle.textContent = "";
    el.widgetSettingsTabBar.innerHTML = "";
    el.widgetSettingsContent.innerHTML = `<p>Bitte zuerst ein Projekt waehlen.</p>`;
    return;
  }

  const defs = getWidgetDefinitions().filter((item) => item.available);
  const byId = Object.fromEntries(defs.map((item) => [item.id, item]));
  let activeWidgetId = state.uiState.dashboardSettingsActiveWidget || "project";
  if (!byId[activeWidgetId]) {
    activeWidgetId = defs[0]?.id || "project";
  }
  state.uiState.dashboardSettingsActiveWidget = activeWidgetId;

  const tabs = widgetSettingTabs();
  if (!tabs.some((item) => item.id === state.uiState.dashboardSettingsActiveSubtab)) {
    state.uiState.dashboardSettingsActiveSubtab = "gridsetup";
  }

  el.widgetSettingsTitle.textContent = `${byId[activeWidgetId]?.title || activeWidgetId}`;
  el.widgetSettingsTabBar.innerHTML = tabs
    .map((tab) => {
      const active = tab.id === state.uiState.dashboardSettingsActiveSubtab ? "active" : "";
      return `<button class="widget-settings-tab ${active}" data-widget-subtab="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}</button>`;
    })
    .join("");

  const activeSubtab = state.uiState.dashboardSettingsActiveSubtab;
  if (activeSubtab === "gridsetup") {
    const currentWidth = layout.widgets[activeWidgetId]?.colSpan || 2;
    const currentHeight = layout.widgets[activeWidgetId]?.rowSpan || 1;

    el.widgetSettingsContent.innerHTML = `
      <h3>Grid Einstellungen</h3>
      <p>Raster: <strong>6 Spalten</strong> (fix)</p>
      <label>Breite des Widgets (Spalten)</label>
      <input type="number" min="1" max="6" id="gridWidthInput" value="${currentWidth}" />
      <label>Hoehe des Widgets (Zeilen)</label>
      <input type="number" min="1" max="12" id="gridHeightInput" value="${currentHeight}" />
      <div class="actions">
        <button id="saveGridSettingsBtn" data-widget-id="${escapeHtml(activeWidgetId)}">Gridsetup speichern</button>
      </div>
    `;
  } else {
    const widgetId = activeWidgetId;
    const definition = byId[widgetId];
    const fn = layout.widgetFunctions[widgetId] || {};
    if (widgetId === "ddev") {
      const buttons = normalizeDdevButtons(fn.buttons || fn);
      const rows = buttons
        .map((item, index) => `
          <div class="config-block">
            <label>Label</label>
            <input data-ddev-label="${index}" value="${escapeHtml(item.label)}" />
            <label>Befehl</label>
            <input data-ddev-command="${index}" value="${escapeHtml(item.command)}" />
            <label><input type="checkbox" data-ddev-terminal="${index}" ${item.runInTerminal ? "checked" : ""} /> Im Terminal ausfuehren</label>
            <button data-remove-ddev-btn="${index}" class="danger">Button entfernen</button>
          </div>
        `)
        .join("");
      el.widgetSettingsContent.innerHTML = `
        <h3>${escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <p>Default: ddev status, ddev start, ddev stop, ddev restart (bearbeitbar)</p>
        ${rows}
        <div class="config-block">
          <label>Neuer Button Label</label>
          <input id="newDdevLabel" placeholder="z. B. ddev describe" />
          <label>Neuer Befehl</label>
          <input id="newDdevCommand" placeholder="ddev describe" />
          <label><input type="checkbox" id="newDdevRunInTerminal" checked /> Im Terminal ausfuehren</label>
          <button id="addDdevButtonBtn">Button hinzufuegen</button>
        </div>
        <div class="actions"><button id="saveWidgetSettingsBtn" data-widget-id="ddev">Einstellungen speichern</button></div>
      `;
    } else if (widgetId === "git") {
      el.widgetSettingsContent.innerHTML = `
        <h3>${escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <label><input id="gitAllowCheckout" type="checkbox" ${fn.allowCheckout ? "checked" : ""} /> Checkout Button anzeigen</label>
        <label><input id="gitShowCurrentBranch" type="checkbox" ${fn.showCurrentBranch ? "checked" : ""} /> Aktiven Branch markieren</label>
        <div class="actions"><button id="saveWidgetSettingsBtn" data-widget-id="git">Einstellungen speichern</button></div>
      `;
    } else if (widgetId === "npm") {
      const buttons = normalizeNpmButtons(fn.buttons);
      const rows = buttons
        .map((item, index) => {
          return `
            <div class="config-block">
              <label>Label</label>
              <input data-npm-label="${index}" value="${escapeHtml(item.label)}" />
              <label>Befehl</label>
              <input data-npm-command="${index}" value="${escapeHtml(item.command)}" />
              <label><input type="checkbox" data-npm-terminal="${index}" ${item.runInTerminal ? "checked" : ""} /> Im Terminal ausfuehren</label>
              <button data-remove-npm-btn="${index}" class="danger">Button entfernen</button>
            </div>
          `;
        })
        .join("");
      el.widgetSettingsContent.innerHTML = `
        <h3>${escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <p>Default: npm install, npm start (konfigurierbar)</p>
        ${rows}
        <div class="config-block">
          <label>Neuer Button Label</label>
          <input id="newNpmLabel" placeholder="z. B. npm test" />
          <label>Neuer Befehl</label>
          <input id="newNpmCommand" placeholder="npm test" />
          <label><input type="checkbox" id="newNpmRunInTerminal" checked /> Im Terminal ausfuehren</label>
          <button id="addNpmButtonBtn">Button hinzufuegen</button>
        </div>
        <div class="actions"><button id="saveWidgetSettingsBtn" data-widget-id="npm">Einstellungen speichern</button></div>
      `;
    } else if (isCommandWidgetId(widgetId)) {
      const commandFn = normalizeCommandWidgetSettings(fn);
      const rows = commandFn.buttons
        .map((item, index) => {
          return `
            <div class="config-block">
              <label>Label</label>
              <input data-command-label="${index}" value="${escapeHtml(item.label)}" />
              <label>Befehl</label>
              <input data-command-command="${index}" value="${escapeHtml(item.command)}" />
              <label><input type="checkbox" data-command-terminal="${index}" ${item.runInTerminal ? "checked" : ""} /> Im Terminal ausfuehren</label>
              <button data-remove-command-btn="${index}" class="danger">Button entfernen</button>
            </div>
          `;
        })
        .join("");
      el.widgetSettingsContent.innerHTML = `
        <h3>${escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <label>Widget Titel</label>
        <input id="commandWidgetTitle" value="${escapeHtml(commandFn.title)}" placeholder="Command" />
        ${rows}
        <div class="config-block">
          <label>Neuer Button Label</label>
          <input id="newCommandLabel" placeholder="z. B. Build" />
          <label>Neuer Befehl</label>
          <input id="newCommandCommand" placeholder="npm run build" />
          <label><input type="checkbox" id="newCommandRunInTerminal" checked /> Im Terminal ausfuehren</label>
          <button id="addCommandButtonBtn">Button hinzufuegen</button>
        </div>
        <div class="actions"><button id="saveWidgetSettingsBtn" data-widget-id="${escapeHtml(widgetId)}">Einstellungen speichern</button></div>
      `;
    } else if (widgetId === "filebrowser") {
      const selectedProject = state.selectedProjectEntry.project;
      const directories = getFilebrowserDirectories(fn, selectedProject.path);
      const rows = directories
        .map((dir, index) => {
          const isProjectDir = index === 0;
          const label = toProjectRelativeDisplayPath(dir, selectedProject.path);
          const removeButton = isProjectDir
            ? ""
            : `<button data-remove-filebrowser-dir="${escapeHtml(dir)}">Entfernen</button>`;
          return `
            <div class="actions filebrowser-row">
              <span>${escapeHtml(label)}</span>
              ${removeButton}
            </div>
          `;
        })
        .join("");
      el.widgetSettingsContent.innerHTML = `
        <h3>${escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <p>Der Projektpfad steht immer als erstes in der Liste.</p>
        <div class="actions">
          <button id="addFilebrowserDirectoryBtn">Verzeichnis hinzufuegen</button>
        </div>
        <div class="filebrowser-list">${rows}</div>
      `;
    } else if (widgetId === "launcher") {
      el.widgetSettingsContent.innerHTML = `
        <h3>${escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <label><input id="launcherAllowCursor" type="checkbox" ${fn.allowCursor ? "checked" : ""} /> Cursor Button</label>
        <label><input id="launcherAllowVscode" type="checkbox" ${fn.allowVscode ? "checked" : ""} /> VS Code Button</label>
        <label><input id="launcherAllowExplorer" type="checkbox" ${fn.allowExplorer ? "checked" : ""} /> Explorer Button</label>
        <label><input id="launcherAllowTerminal" type="checkbox" ${fn.allowTerminal ? "checked" : ""} /> Terminal Button</label>
        <div class="actions"><button id="saveWidgetSettingsBtn" data-widget-id="launcher">Einstellungen speichern</button></div>
      `;
    } else if (widgetId === "ssh") {
      el.widgetSettingsContent.innerHTML = `
        <h3>${escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <label><input id="sshShowHint" type="checkbox" ${fn.showHint ? "checked" : ""} /> Hinweistext anzeigen</label>
        <div class="actions"><button id="saveWidgetSettingsBtn" data-widget-id="ssh">Einstellungen speichern</button></div>
      `;
    } else if (widgetId === "browser") {
      el.widgetSettingsContent.innerHTML = `
        <h3>${escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <label><input id="browserShowSourceHint" type="checkbox" ${fn.showSourceHint ? "checked" : ""} /> Quellenhinweis anzeigen</label>
        <div class="actions"><button id="saveWidgetSettingsBtn" data-widget-id="browser">Einstellungen speichern</button></div>
      `;
    } else {
      el.widgetSettingsContent.innerHTML = `
        <h3>${escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <p>Keine zusaetzlichen Funktionsoptionen vorhanden.</p>
      `;
    }
  }

  bindWidgetSettingsEvents();
}

function bindWidgetSettingsEvents() {
  el.widgetSettingsTabBar.querySelectorAll("[data-widget-subtab]").forEach((node) => {
    node.addEventListener("click", () => {
      state.uiState.dashboardSettingsActiveSubtab = node.getAttribute("data-widget-subtab") || "gridsetup";
      renderWidgetSettingsModal();
      persistUiState();
    });
  });

  const saveGridButton = document.getElementById("saveGridSettingsBtn");
  if (saveGridButton) {
    saveGridButton.addEventListener("click", async () => {
      const layout = getProjectLayoutState();
      const widgetId = saveGridButton.getAttribute("data-widget-id");
      if (!widgetId) return;
      const width = Number(document.getElementById("gridWidthInput")?.value);
      const height = Number(document.getElementById("gridHeightInput")?.value);
      layout.widgets[widgetId] = {
        ...(layout.widgets[widgetId] || baseWidgetState()),
        colSpan: Number.isFinite(width) ? Math.max(1, Math.min(6, width)) : 2,
        rowSpan: Number.isFinite(height) ? Math.max(1, Math.min(12, height)) : 1,
      };
      await persistUiState();
      renderWidgetSettingsModal();
      renderDashboard();
    });
  }

  const saveWidgetButton = document.getElementById("saveWidgetSettingsBtn");
  if (saveWidgetButton) {
    saveWidgetButton.addEventListener("click", async () => {
      const widgetId = saveWidgetButton.getAttribute("data-widget-id");
      if (!widgetId) return;
      const layout = getProjectLayoutState();
      const fn = layout.widgetFunctions[widgetId] || {};
      if (widgetId === "ddev") {
        const labels = Array.from(document.querySelectorAll("[data-ddev-label]"));
        const commands = Array.from(document.querySelectorAll("[data-ddev-command]"));
        const terminals = Array.from(document.querySelectorAll("[data-ddev-terminal]"));
        const merged = labels.map((labelNode, index) => ({
          id: `ddev_custom_${index}`,
          label: String(labelNode.value || "").trim() || `ddev command ${index + 1}`,
          command: String(commands[index]?.value || "").trim(),
          runInTerminal: Boolean(terminals[index]?.checked),
        }));
        fn.buttons = normalizeDdevButtons(merged);
      } else if (widgetId === "git") {
        fn.allowCheckout = Boolean(document.getElementById("gitAllowCheckout")?.checked);
        fn.showCurrentBranch = Boolean(document.getElementById("gitShowCurrentBranch")?.checked);
      } else if (widgetId === "npm") {
        const labels = Array.from(document.querySelectorAll("[data-npm-label]"));
        const commands = Array.from(document.querySelectorAll("[data-npm-command]"));
        const terminals = Array.from(document.querySelectorAll("[data-npm-terminal]"));
        const merged = labels.map((labelNode, index) => ({
          id: `npm_custom_${index}`,
          label: String(labelNode.value || "").trim() || `npm command ${index + 1}`,
          command: String(commands[index]?.value || "").trim(),
          runInTerminal: Boolean(terminals[index]?.checked),
        }));
        fn.buttons = normalizeNpmButtons(merged);
      } else if (isCommandWidgetId(widgetId)) {
        const labels = Array.from(document.querySelectorAll("[data-command-label]"));
        const commands = Array.from(document.querySelectorAll("[data-command-command]"));
        const terminals = Array.from(document.querySelectorAll("[data-command-terminal]"));
        const merged = labels.map((labelNode, index) => ({
          id: `command_custom_${index}`,
          label: String(labelNode.value || "").trim() || `Command ${index + 1}`,
          command: String(commands[index]?.value || "").trim(),
          runInTerminal: Boolean(terminals[index]?.checked),
        }));
        fn.title = String(document.getElementById("commandWidgetTitle")?.value || "").trim() || "Command";
        fn.buttons = normalizeCommandButtons(merged);
      } else if (widgetId === "launcher") {
        fn.allowCursor = Boolean(document.getElementById("launcherAllowCursor")?.checked);
        fn.allowVscode = Boolean(document.getElementById("launcherAllowVscode")?.checked);
        fn.allowExplorer = Boolean(document.getElementById("launcherAllowExplorer")?.checked);
        fn.allowTerminal = Boolean(document.getElementById("launcherAllowTerminal")?.checked);
      } else if (widgetId === "ssh") {
        fn.showHint = Boolean(document.getElementById("sshShowHint")?.checked);
      } else if (widgetId === "browser") {
        fn.showSourceHint = Boolean(document.getElementById("browserShowSourceHint")?.checked);
      }
      layout.widgetFunctions[widgetId] = fn;
      await persistUiState();
      renderWidgetSettingsModal();
      renderDashboard();
    });
  }

  const addFilebrowserDirectoryBtn = document.getElementById("addFilebrowserDirectoryBtn");
  if (addFilebrowserDirectoryBtn) {
    addFilebrowserDirectoryBtn.addEventListener("click", async () => {
      const selectedProject = state.selectedProjectEntry.project;
      const layout = getProjectLayoutState();
      const fn = layout.widgetFunctions.filebrowser || { directories: [] };
      const startPath = selectedProject.path;
      const result = await window.dashboardApi.pickDirectory({ startPath });
      if (!result?.ok || !result.path) {
        return;
      }
      const picked = String(result.path).trim();
      if (!picked || picked === selectedProject.path) {
        return;
      }
      const merged = getFilebrowserDirectories({ directories: fn.directories || [] }, selectedProject.path);
      if (merged.includes(picked)) {
        return;
      }
      fn.directories = [...(Array.isArray(fn.directories) ? fn.directories : []), picked];
      layout.widgetFunctions.filebrowser = fn;
      await persistUiState();
      renderWidgetSettingsModal();
      renderDashboard();
    });
  }

  document.querySelectorAll("[data-remove-filebrowser-dir]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = button.getAttribute("data-remove-filebrowser-dir");
      if (!target) return;
      const layout = getProjectLayoutState();
      const fn = layout.widgetFunctions.filebrowser || { directories: [] };
      fn.directories = (Array.isArray(fn.directories) ? fn.directories : []).filter((dir) => dir !== target);
      layout.widgetFunctions.filebrowser = fn;
      await persistUiState();
      renderWidgetSettingsModal();
      renderDashboard();
    });
  });

  const addCommandButtonBtn = document.getElementById("addCommandButtonBtn");
  if (addCommandButtonBtn) {
    addCommandButtonBtn.addEventListener("click", async () => {
      const layout = getProjectLayoutState();
      const widgetId = state.uiState.dashboardSettingsActiveWidget;
      if (!isCommandWidgetId(widgetId)) return;
      const fn = normalizeCommandWidgetSettings(layout.widgetFunctions[widgetId]);
      const label = String(document.getElementById("newCommandLabel")?.value || "").trim();
      const command = String(document.getElementById("newCommandCommand")?.value || "").trim();
      const runInTerminal = Boolean(document.getElementById("newCommandRunInTerminal")?.checked);
      if (!command) return;
      const current = normalizeCommandButtons(fn.buttons);
      current.push({
        id: `command_custom_${Date.now()}`,
        label: label || command,
        command,
        runInTerminal,
      });
      fn.buttons = normalizeCommandButtons(current);
      fn.title = String(document.getElementById("commandWidgetTitle")?.value || fn.title || "Command").trim() || "Command";
      layout.widgetFunctions[widgetId] = fn;
      await persistUiState();
      renderWidgetSettingsModal();
      renderDashboard();
    });
  }

  document.querySelectorAll("[data-remove-command-btn]").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.getAttribute("data-remove-command-btn"));
      if (!Number.isFinite(index)) return;
      const layout = getProjectLayoutState();
      const widgetId = state.uiState.dashboardSettingsActiveWidget;
      if (!isCommandWidgetId(widgetId)) return;
      const fn = normalizeCommandWidgetSettings(layout.widgetFunctions[widgetId]);
      const current = normalizeCommandButtons(fn.buttons).filter((_, idx) => idx !== index);
      fn.buttons = normalizeCommandButtons(current);
      fn.title = String(document.getElementById("commandWidgetTitle")?.value || fn.title || "Command").trim() || "Command";
      layout.widgetFunctions[widgetId] = fn;
      await persistUiState();
      renderWidgetSettingsModal();
      renderDashboard();
    });
  });

  const addNpmButtonBtn = document.getElementById("addNpmButtonBtn");
  if (addNpmButtonBtn) {
    addNpmButtonBtn.addEventListener("click", async () => {
      const layout = getProjectLayoutState();
      const fn = layout.widgetFunctions.npm || { buttons: defaultNpmButtons() };
      const label = String(document.getElementById("newNpmLabel")?.value || "").trim();
      const command = String(document.getElementById("newNpmCommand")?.value || "").trim();
      const runInTerminal = Boolean(document.getElementById("newNpmRunInTerminal")?.checked);
      if (!command) return;
      const current = normalizeNpmButtons(fn.buttons);
      current.push({
        id: `npm_custom_${Date.now()}`,
        label: label || command,
        command,
        runInTerminal,
      });
      fn.buttons = normalizeNpmButtons(current);
      layout.widgetFunctions.npm = fn;
      await persistUiState();
      renderWidgetSettingsModal();
      renderDashboard();
    });
  }

  document.querySelectorAll("[data-remove-npm-btn]").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.getAttribute("data-remove-npm-btn"));
      if (!Number.isFinite(index)) return;
      const layout = getProjectLayoutState();
      const fn = layout.widgetFunctions.npm || { buttons: defaultNpmButtons() };
      const current = normalizeNpmButtons(fn.buttons).filter((_, idx) => idx !== index);
      fn.buttons = normalizeNpmButtons(current);
      layout.widgetFunctions.npm = fn;
      await persistUiState();
      renderWidgetSettingsModal();
      renderDashboard();
    });
  });

  const addDdevButtonBtn = document.getElementById("addDdevButtonBtn");
  if (addDdevButtonBtn) {
    addDdevButtonBtn.addEventListener("click", async () => {
      const layout = getProjectLayoutState();
      const fn = layout.widgetFunctions.ddev || { buttons: defaultDdevButtons() };
      const label = String(document.getElementById("newDdevLabel")?.value || "").trim();
      const command = String(document.getElementById("newDdevCommand")?.value || "").trim();
      const runInTerminal = Boolean(document.getElementById("newDdevRunInTerminal")?.checked);
      if (!command) return;
      const current = normalizeDdevButtons(fn.buttons || fn);
      current.push({
        id: `ddev_custom_${Date.now()}`,
        label: label || command,
        command,
        runInTerminal,
      });
      fn.buttons = normalizeDdevButtons(current);
      layout.widgetFunctions.ddev = fn;
      await persistUiState();
      renderWidgetSettingsModal();
      renderDashboard();
    });
  }

  document.querySelectorAll("[data-remove-ddev-btn]").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.getAttribute("data-remove-ddev-btn"));
      if (!Number.isFinite(index)) return;
      const layout = getProjectLayoutState();
      const fn = layout.widgetFunctions.ddev || { buttons: defaultDdevButtons() };
      const current = normalizeDdevButtons(fn.buttons || fn).filter((_, idx) => idx !== index);
      fn.buttons = normalizeDdevButtons(current);
      layout.widgetFunctions.ddev = fn;
      await persistUiState();
      renderWidgetSettingsModal();
      renderDashboard();
    });
  });
}

function renderProjectList() {
  const projects = flattenProjects();
  if (projects.length === 0) {
    el.projectList.innerHTML = `<p>Keine Projekte konfiguriert.</p>`;
    return;
  }

  const treeParts = [];
  for (const customer of state.config.customers) {
    const customerKey = customer.name;
    const customerCollapsed = state.collapsedCustomers.has(customerKey);
    treeParts.push(`
      <button class="tree-toggle tree-customer" data-tree-toggle="customer" data-key="${escapeHtml(customerKey)}">
        ${customerCollapsed ? "▸" : "▾"} ${escapeHtml(customer.name)}
      </button>
    `);
    if (customerCollapsed) {
      continue;
    }

    for (const manager of customer.projectManagers || []) {
      const managerKey = `${customer.name}::${manager.name}`;
      const managerCollapsed = state.collapsedManagers.has(managerKey);
      treeParts.push(`
        <button class="tree-toggle tree-manager" data-tree-toggle="manager" data-key="${escapeHtml(managerKey)}">
          ${managerCollapsed ? "▸" : "▾"} ${escapeHtml(manager.name)}
        </button>
      `);
      if (managerCollapsed) {
        continue;
      }

      for (const project of manager.projects || []) {
        const ref = `${customer.name}::${manager.name}::${project.name}::${project.path}`;
        const active = state.selectedRef === ref ? "active" : "";
        treeParts.push(`
          <div class="project-card tree-project ${active}" data-ref="${escapeHtml(ref)}">
            <strong>${escapeHtml(project.name)}</strong>
          </div>
        `);
      }
    }
  }

  el.projectList.innerHTML = treeParts.join("");

  el.projectList.querySelectorAll("[data-tree-toggle]").forEach((node) => {
    node.addEventListener("click", () => {
      const type = node.getAttribute("data-tree-toggle");
      const key = node.getAttribute("data-key");
      if (!key) return;

      if (type === "customer") {
        if (state.collapsedCustomers.has(key)) {
          state.collapsedCustomers.delete(key);
        } else {
          state.collapsedCustomers.add(key);
        }
      } else if (type === "manager") {
        if (state.collapsedManagers.has(key)) {
          state.collapsedManagers.delete(key);
        } else {
          state.collapsedManagers.add(key);
        }
      }
      persistUiState();
      renderProjectList();
    });
  });

  el.projectList.querySelectorAll(".project-card").forEach((node) => {
    node.addEventListener("click", async () => {
      const ref = node.getAttribute("data-ref");
      const row = projects.find((p) => p.ref === ref);
      if (!row) return;
      state.selectedRef = ref;
      state.selectedProjectEntry = row;
      state.uiState.lastSelectedProjectRef = ref;
      await persistUiState();
      renderProjectList();
      await refreshProject();
    });
  });
}

async function refreshProject() {
  if (!state.selectedProjectEntry) return;
  const selectedProject = state.selectedProjectEntry.project;
  setDashboard(`
    <div class="empty-state">
      <h2>Lade Dashboard...</h2>
      <p>${escapeHtml(selectedProject.name)}</p>
    </div>
  `);

  const result = await window.dashboardApi.refreshProject(selectedProject);
  if (!result.ok) {
    setDashboard(`
      <div class="empty-state">
        <h2>Fehler beim Laden</h2>
        <p>${escapeHtml(result.error)}</p>
      </div>
    `);
    return;
  }

  state.projectData = result.data;
  renderDashboard();
}

function resetDashboardState() {
  state.selectedProjectEntry = null;
  state.selectedRef = "";
  state.uiState.lastSelectedProjectRef = "";
  state.projectData = null;
  closeAddWidgetModal();
  updateAddWidgetButtonState();
  setDashboard(`
    <div class="empty-state">
      <h2>Kein Projekt ausgewaehlt</h2>
      <p>Waehle links ein Projekt aus.</p>
    </div>
  `);
}

function ensureSelectedProjectStillExists() {
  if (!state.selectedRef) return;
  const match = flattenProjects().find((item) => item.ref === state.selectedRef);
  if (!match) {
    resetDashboardState();
    persistUiState();
  } else {
    state.selectedProjectEntry = match;
  }
}

function currentProjectKey() {
  if (!state.selectedProjectEntry) return "";
  return `${state.selectedProjectEntry.customerName}::${state.selectedProjectEntry.managerName}::${state.selectedProjectEntry.project.path}`;
}

function baseWidgetState() {
  return {
    visible: true,
    colSpan: 2,
    rowSpan: 1,
  };
}

function baseWidgetFunctionSettings() {
  return {
    project: {
      showPath: true,
    },
    ddev: {
      buttons: defaultDdevButtons(),
    },
    disk: {},
    git: {
      allowCheckout: true,
      showCurrentBranch: true,
    },
    npm: {
      buttons: defaultNpmButtons(),
    },
    filebrowser: {
      directories: [],
    },
    launcher: {
      allowCursor: true,
      allowVscode: true,
      allowExplorer: true,
      allowTerminal: true,
    },
    ssh: {
      showHint: true,
    },
    browser: {
      showSourceHint: true,
    },
  };
}

function normalizeNpmButtons(buttons) {
  const source = Array.isArray(buttons) ? buttons : defaultNpmButtons();
  const normalized = source
    .map((item, index) => ({
      id: String(item?.id || `npm_cmd_${index}`),
      label: String(item?.label || item?.command || `npm command ${index + 1}`),
      command: String(item?.command || "").trim(),
      runInTerminal: item?.runInTerminal !== false,
    }))
    .filter((item) => item.command.length > 0);
  return normalized.length ? normalized : defaultNpmButtons();
}

function normalizeCommandButtons(buttons) {
  const source = Array.isArray(buttons) ? buttons : [];
  return source
    .map((item, index) => ({
      id: String(item?.id || `cmd_${index}`),
      label: String(item?.label || item?.command || `Command ${index + 1}`),
      command: String(item?.command || "").trim(),
      runInTerminal: item?.runInTerminal !== false,
    }))
    .filter((item) => item.command.length > 0);
}

function normalizeCommandWidgetSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    title: String(source.title || "Command").trim() || "Command",
    buttons: normalizeCommandButtons(source.buttons),
  };
}

function normalizeDdevButtons(config) {
  if (Array.isArray(config)) {
    const normalized = config
      .map((item, index) => ({
        id: String(item?.id || `ddev_cmd_${index}`),
        label: String(item?.label || item?.command || `ddev command ${index + 1}`),
        command: String(item?.command || "").trim(),
        runInTerminal: item?.runInTerminal !== false,
      }))
      .filter((item) => item.command.length > 0);
    return normalized.length ? normalized : defaultDdevButtons();
  }

  // Backward compatibility for old allow flags.
  if (config && typeof config === "object") {
    const rows = [];
    if (config.allowStatus !== false) rows.push({ id: "ddev_status", label: "ddev status", command: "ddev status", runInTerminal: true });
    if (config.allowStart !== false) rows.push({ id: "ddev_start", label: "ddev start", command: "ddev start", runInTerminal: true });
    if (config.allowStop !== false) rows.push({ id: "ddev_stop", label: "ddev stop", command: "ddev stop", runInTerminal: true });
    if (config.allowRestart !== false) rows.push({ id: "ddev_restart", label: "ddev restart", command: "ddev restart", runInTerminal: true });
    return rows.length ? rows : defaultDdevButtons();
  }

  return defaultDdevButtons();
}

function getFilebrowserDirectories(fn, projectPath) {
  const normalized = [];
  const seen = new Set();
  const addUnique = (dir) => {
    const value = String(dir || "").trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    normalized.push(value);
  };
  addUnique(projectPath);
  if (Array.isArray(fn?.directories)) {
    fn.directories.forEach((dir) => addUnique(dir));
  }
  return normalized;
}

function toProjectRelativeDisplayPath(directoryPath, projectPath) {
  const dir = String(directoryPath || "").trim();
  const project = String(projectPath || "").trim();
  if (!dir || !project) return dir;

  const normalize = (value) => value.replaceAll("\\", "/").replace(/\/+$/, "");
  const dirNorm = normalize(dir);
  const projectNorm = normalize(project);
  const projectBase = projectNorm.split("/").filter(Boolean).pop() || projectNorm;

  if (dirNorm === projectNorm) {
    return projectBase;
  }
  if (dirNorm.startsWith(`${projectNorm}/`)) {
    const suffix = dirNorm.slice(projectNorm.length + 1);
    return `${projectBase}/${suffix}`;
  }
  return dir;
}

function getProjectLayoutState() {
  const key = currentProjectKey();
  if (!key) return null;
  const staticWidgetIds = ["project", "ddev", "disk", "git", "npm", "filebrowser", "launcher", "ssh", "browser"];

  if (!state.uiState.dashboardLayouts) {
    state.uiState.dashboardLayouts = {};
  }

  if (!state.uiState.dashboardLayouts[key]) {
    state.uiState.dashboardLayouts[key] = {
      order: [...staticWidgetIds],
      grid: {
        columns: 6,
        gap: 12,
      },
      widgets: {
        project: { visible: true, colSpan: 3, rowSpan: 1 },
        ddev: baseWidgetState(),
        disk: baseWidgetState(),
        git: baseWidgetState(),
        npm: baseWidgetState(),
        filebrowser: baseWidgetState(),
        launcher: baseWidgetState(),
        ssh: baseWidgetState(),
        browser: baseWidgetState(),
      },
      widgetFunctions: baseWidgetFunctionSettings(),
    };
  }

  const layout = state.uiState.dashboardLayouts[key];
  layout.grid = {
    columns: 6,
    gap: Number.isFinite(Number(layout?.grid?.gap)) ? Math.max(4, Math.min(32, Number(layout.grid.gap))) : 12,
  };

  layout.widgets = layout.widgets || {};
  const dynamicWidgetIds = Array.from(
    new Set([
      ...Object.keys(layout.widgets || {}).filter((id) => isCommandWidgetId(id)),
      ...Object.keys(layout.widgetFunctions || {}).filter((id) => isCommandWidgetId(id)),
      ...(Array.isArray(layout.order) ? layout.order.filter((id) => isCommandWidgetId(id)) : []),
    ]),
  );
  for (const id of [...staticWidgetIds, ...dynamicWidgetIds]) {
    const existing = layout.widgets[id] || {};
    layout.widgets[id] = {
      visible: typeof existing.visible === "boolean" ? existing.visible : true,
      colSpan: Number.isFinite(Number(existing.colSpan))
        ? Math.max(1, Math.min(6, Number(existing.colSpan)))
        : (id === "project" ? 3 : 2),
      rowSpan: Number.isFinite(Number(existing.rowSpan))
        ? Math.max(1, Math.min(12, Number(existing.rowSpan)))
        : 1,
    };
  }

  if (!Array.isArray(layout.order)) {
    layout.order = [...staticWidgetIds];
  }
  layout.order = layout.order.filter((id) => staticWidgetIds.includes(id) || isCommandWidgetId(id));
  for (const id of staticWidgetIds) {
    if (!layout.order.includes(id)) {
      layout.order.push(id);
    }
  }
  for (const id of dynamicWidgetIds) {
    if (!layout.order.includes(id)) {
      layout.order.push(id);
    }
  }

  const functionDefaults = baseWidgetFunctionSettings();
  layout.widgetFunctions = layout.widgetFunctions || {};
  for (const widgetId of Object.keys(functionDefaults)) {
    layout.widgetFunctions[widgetId] = {
      ...functionDefaults[widgetId],
      ...(layout.widgetFunctions[widgetId] || {}),
    };
  }
  for (const widgetId of dynamicWidgetIds) {
    layout.widgetFunctions[widgetId] = normalizeCommandWidgetSettings(layout.widgetFunctions[widgetId]);
  }
  layout.widgetFunctions.ddev.buttons = normalizeDdevButtons(
    layout.widgetFunctions.ddev.buttons || layout.widgetFunctions.ddev,
  );
  layout.widgetFunctions.npm.buttons = normalizeNpmButtons(layout.widgetFunctions.npm.buttons);

  return layout;
}

function renderWidgetShell(widgetId, title, body, colSpan, rowSpan) {
  const closeButton = widgetId === "project"
    ? ""
    : `<button class="widget-close-btn" data-close-widget="${escapeHtml(widgetId)}" aria-label="Widget schliessen" title="Widget schliessen">✕</button>`;
  return `
    <article class="widget dashboard-item" draggable="true" data-widget-id="${escapeHtml(widgetId)}" style="grid-column: span ${colSpan}; grid-row: span ${rowSpan};">
      <div class="widget-header">
        <h3>${escapeHtml(title)}</h3>
        <div class="widget-header-actions">
          <button class="widget-settings-icon-btn" data-open-widget-tab="${escapeHtml(widgetId)}" aria-label="Widget Einstellungen oeffnen" title="Widget Einstellungen">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M19.14 12.94a7.99 7.99 0 0 0 .06-.94 7.99 7.99 0 0 0-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.76 7.76 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54a7.76 7.76 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.99 7.99 0 0 0-.06.94c0 .32.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.23 1.13-.55 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"/>
            </svg>
          </button>
          ${closeButton}
        </div>
      </div>
      ${body}
    </article>
  `;
}

function renderDdevBody(fn) {
  const ddev = state.projectData?.ddevStatus;
  const out = ddev?.stdout || ddev?.stderr || "Keine Ausgabe.";
  const cls = statusClass(Boolean(ddev?.ok));
  const buttons = normalizeDdevButtons(fn?.buttons || fn)
    .map((item) => `<button data-ddev-run="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`)
    .join("");
  return `
    <p class="${cls}">${ddev?.ok ? "Status abrufbar" : "DDEV nicht verfuegbar oder Projekt nicht initialisiert"}</p>
    <div class="actions">${buttons || `<span class="status-warn">Keine DDEV Aktionen aktiv.</span>`}</div>
    <pre>${escapeHtml(out)}</pre>
  `;
}

function renderDiskBody() {
  const disk = state.projectData?.diskUsage;
  return `
    <p class="${statusClass(Boolean(disk?.ok))}">
      ${disk?.ok ? `Projektgroesse: ${escapeHtml(disk.size)}` : escapeHtml(disk?.message || "n/a")}
    </p>
  `;
}

function renderGitBody(fn) {
  const git = state.projectData?.gitInfo;
  const cls = statusClass(Boolean(git?.ok));
  if (!git?.ok) {
    return `<p class="${cls}">${escapeHtml(git?.message || "Kein Git-Repository.")}</p>`;
  }

  const branches = Array.isArray(git.branches) ? git.branches : [];
  if (!branches.length) {
    return `<p class="status-warn">Keine lokalen Branches gefunden.</p>`;
  }

  const rows = branches
    .map((branch) => {
      const isCurrent = branch === git.currentBranch;
      const label = fn.showCurrentBranch && isCurrent ? `${branch} (aktiv)` : branch;
      const checkout = fn.allowCheckout
        ? `<button data-git-checkout="${escapeHtml(branch)}" ${isCurrent ? "disabled" : ""}>Checkout</button>`
        : "";
      return `
        <div class="actions git-branch-row">
          ${checkout}
          <span class="${isCurrent ? "status-ok" : ""}">${escapeHtml(label)}</span>
        </div>
      `;
    })
    .join("");

  return `
    <p class="${cls}">Lokale Branches</p>
    <div class="git-branch-list">${rows}</div>
  `;
}

function renderNpmBody(fn) {
  const buttons = normalizeNpmButtons(fn?.buttons);
  const rows = buttons
    .map((item) => {
      const mode = item.runInTerminal ? "Terminal" : "Inline";
      return `
        <div class="actions npm-row">
          <button data-npm-run="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>
          <span class="meta">${escapeHtml(mode)} · ${escapeHtml(item.command)}</span>
        </div>
      `;
    })
    .join("");
  return `<div class="git-branch-list">${rows}</div>`;
}

function renderCommandBody(widgetId, fn) {
  const buttons = normalizeCommandButtons(fn?.buttons);
  if (!buttons.length) {
    return `<p class="status-warn">Keine Befehle konfiguriert.</p>`;
  }
  const rows = buttons
    .map((item) => {
      const mode = item.runInTerminal ? "Terminal" : "Inline";
      return `
        <div class="actions npm-row">
          <button data-command-widget="${escapeHtml(widgetId)}" data-command-btn="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>
          <span class="meta">${escapeHtml(mode)} · ${escapeHtml(item.command)}</span>
        </div>
      `;
    })
    .join("");
  return `<div class="git-branch-list">${rows}</div>`;
}

function renderFilebrowserBody(fn) {
  const selectedProject = state.selectedProjectEntry.project;
  const directories = getFilebrowserDirectories(fn, selectedProject.path);
  if (!directories.length) {
    return `<p class="status-warn">Keine Verzeichnisse konfiguriert.</p>`;
  }

  const rows = directories
    .map((dir, index) => {
      const label = toProjectRelativeDisplayPath(dir, selectedProject.path);
      return `
        <div class="filebrowser-row">
          <button class="filebrowser-open-icon-btn" data-open-path="${escapeHtml(dir)}" aria-label="Verzeichnis oeffnen" title="Verzeichnis oeffnen">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M10 4a2 2 0 0 1 1.4.6l1.2 1.2c.2.2.5.2.7.2H18a2 2 0 0 1 2 2v1h-2V8h-4.7a3 3 0 0 1-2.1-.9L10 5.9V6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h5v2H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4h4Zm8.7 8.3a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-2.6 2.6a1 1 0 1 1-1.4-1.4l.9-.9H14a1 1 0 1 1 0-2h5.6l-.9-.9a1 1 0 0 1 0-1.4Z"/>
            </svg>
          </button>
          <span class="filebrowser-path" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
        </div>
      `;
    })
    .join("");

  return `<div class="filebrowser-list">${rows}</div>`;
}

function renderLauncherBody(fn) {
  const buttons = [];
  if (fn.allowCursor) buttons.push(`<button data-launcher="cursor">Cursor</button>`);
  if (fn.allowVscode) buttons.push(`<button data-launcher="vscode">VS Code</button>`);
  if (fn.allowExplorer) buttons.push(`<button data-launcher="explorer">Explorer</button>`);
  if (fn.allowTerminal) buttons.push(`<button data-launcher="terminal">Terminal</button>`);
  return `
    <div class="actions">${buttons.join("") || `<span class="status-warn">Keine Launcher Aktionen aktiv.</span>`}</div>
    <p class="meta">Startet Programme im Projektkontext.</p>
  `;
}

function renderSshBody(fn) {
  const selectedProject = state.selectedProjectEntry.project;
  const sshConfigs = resolveWidgets(selectedProject).ssh;
  if (!Array.isArray(sshConfigs) || sshConfigs.length === 0) {
    return `<p class="status-warn">Keine SSH-Verbindungen in der Konfiguration hinterlegt.</p>`;
  }

  const buttons = sshConfigs
    .map((item, idx) => {
      const label = item.label || `${item.username}@${item.host}`;
      return `<button data-ssh="${idx}">${escapeHtml(label)}</button>`;
    })
    .join("");

  return `
    <div class="actions">${buttons}</div>
    ${fn.showHint ? `<p class="meta">Hinweis: Passwoerter werden nicht automatisiert uebergeben.</p>` : ""}
  `;
}

function renderBrowserBody(fn) {
  const urls = state.projectData?.urls || [];
  if (urls.length === 0) {
    return `<p class="status-warn">Keine URLs gefunden.</p>`;
  }
  const buttons = urls
    .map((url, idx) => `<button data-url="${idx}">${escapeHtml(url)}</button>`)
    .join("");
  return `
    <div class="actions">${buttons}</div>
    ${fn.showSourceHint ? `<p class="meta">URLs aus .ddev/config.yaml und config/sites/**/*.yaml</p>` : ""}
  `;
}

function getWidgetDefinitions() {
  const selected = state.selectedProjectEntry;
  if (!selected) return [];
  const project = selected.project;
  const widgets = resolveWidgets(project);
  const layout = getProjectLayoutState();
  const fn = layout?.widgetFunctions || baseWidgetFunctionSettings();
  const staticDefs = [
    {
      id: "project",
      title: "Projekt",
      available: true,
      body: `
        <p><strong>${escapeHtml(project.name)}</strong></p>
        <p>Kunde: ${escapeHtml(selected.customerName)}</p>
        <p>Projektmanager: ${escapeHtml(selected.managerName)}</p>
        ${fn.project?.showPath ? `<p>Pfad: ${escapeHtml(project.path)}</p>` : ""}
        <div class="actions">
          <button id="refreshDashboard">Aktualisieren</button>
          <button id="openWidgetSettingsBtn">Dashboard Settings</button>
        </div>
      `,
    },
    { id: "ddev", title: "DDEV", available: Boolean(widgets.ddev), body: renderDdevBody(fn.ddev || {}) },
    { id: "disk", title: "Disk Usage", available: Boolean(widgets.diskUsage), body: renderDiskBody() },
    { id: "git", title: "Git", available: Boolean(widgets.git), body: renderGitBody(fn.git || {}) },
    { id: "npm", title: "npm", available: Boolean(widgets.npm), body: renderNpmBody(fn.npm || {}) },
    {
      id: "filebrowser",
      title: "Filebrowser",
      available: Boolean(widgets.filebrowser),
      body: renderFilebrowserBody(fn.filebrowser || {}),
    },
    {
      id: "launcher",
      title: "Programmstarter",
      available: Boolean(widgets.launcher),
      body: renderLauncherBody(fn.launcher || {}),
    },
    { id: "ssh", title: "SSH", available: Boolean(widgets.ssh), body: renderSshBody(fn.ssh || {}) },
    { id: "browser", title: "Browser", available: Boolean(widgets.browser), body: renderBrowserBody(fn.browser || {}) },
  ];
  const commandIds = (layout?.order || []).filter((id) => isCommandWidgetId(id));
  const commandDefs = commandIds.map((id) => {
    const commandFn = normalizeCommandWidgetSettings(layout?.widgetFunctions?.[id]);
    return {
      id,
      title: commandFn.title || "Command",
      available: true,
      body: renderCommandBody(id, commandFn),
    };
  });
  return [...staticDefs, ...commandDefs];
}

function renderDashboard() {
  const selected = state.selectedProjectEntry;
  if (!selected) return;
  const layout = getProjectLayoutState();
  const byId = Object.fromEntries(getWidgetDefinitions().map((item) => [item.id, item]));
  const availableIds = Object.values(byId)
    .filter((item) => item.available)
    .map((item) => item.id);

  const missingInOrder = availableIds.filter((id) => !layout.order.includes(id));
  if (missingInOrder.length > 0) {
    layout.order.push(...missingInOrder);
  }

  el.dashboard.style.gridTemplateColumns = "repeat(6, minmax(0, 1fr))";
  el.dashboard.style.gap = `${layout.grid.gap}px`;

  const orderedIds = layout.order.filter((id) => availableIds.includes(id));
  const parts = orderedIds
    .filter((id) => layout.widgets[id]?.visible !== false)
    .map((id) => {
      const widget = byId[id];
      const colSpan = layout.widgets[id]?.colSpan || 2;
      const rowSpan = layout.widgets[id]?.rowSpan || 1;
      return renderWidgetShell(id, widget.title, widget.body, colSpan, rowSpan);
    });

  setDashboard(parts.length ? parts.join("") : `<div class="empty-state"><h2>Keine Widgets sichtbar</h2></div>`);
  updateAddWidgetButtonState();
  if (state.uiState.dashboardSettingsOpen) {
    renderWidgetSettingsModal();
  }
  bindDashboardEvents();
}

function setConfigMessage(text, isError = false) {
  const msg = document.getElementById("configMessage");
  if (!msg) return;
  msg.textContent = text;
  msg.className = isError ? "status-err" : "status-ok";
}

async function persistConfig() {
  const save = await window.dashboardApi.saveConfig(state.config);
  if (!save.ok) {
    setConfigMessage(`Speichern fehlgeschlagen: ${save.error}`, true);
    return false;
  }
  state.config = save.config;
  state.configPath = save.configPath;
  el.configMeta.textContent = `Konfiguration: ${state.configPath}`;
  return true;
}

async function persistUiState() {
  const payload = {
    ...state.uiState,
    collapsedCustomers: Array.from(state.collapsedCustomers),
    collapsedManagers: Array.from(state.collapsedManagers),
  };
  const save = await window.dashboardApi.saveUiState(payload);
  if (!save.ok) {
    return false;
  }
  state.uiState = {
    ...state.uiState,
    ...save.uiState,
  };
  state.collapsedCustomers = new Set(state.uiState.collapsedCustomers || []);
  state.collapsedManagers = new Set(state.uiState.collapsedManagers || []);
  return true;
}

function bindConfigEditorEvents() {
  const customerSelect = document.getElementById("customerSelect");
  const managerSelect = document.getElementById("managerSelect");
  const projectDeleteSelect = document.getElementById("projectDeleteSelect");
  const configTabButtons = document.querySelectorAll("[data-config-tab]");

  configTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.getAttribute("data-config-tab");
      if (!tab) return;
      state.configEditorTab = tab;
      renderConfigEditor();
    });
  });

  if (state.configEditorTab === "defaults") {
    const saveAppDefaultsBtn = document.getElementById("saveAppDefaultsBtn");
    if (saveAppDefaultsBtn) {
      saveAppDefaultsBtn.addEventListener("click", async () => {
        ensureAppDefaultsInState();
        state.config.appDefaults = {
          terminalCommand: String(document.getElementById("defaultTerminalCommandInput")?.value || "").trim(),
          fileExplorerCommand: String(document.getElementById("defaultExplorerCommandInput")?.value || "").trim(),
          browserCommand: String(document.getElementById("defaultBrowserCommandInput")?.value || "").trim(),
        };
        if (await persistConfig()) {
          setConfigMessage("Defaults gespeichert.");
          renderConfigEditor();
        }
      });
    }
    return;
  }

  function refreshContextDependentSelects() {
    const customerName = customerSelect.value;
    const currentManager = managerSelect.value;
    managerSelect.innerHTML = managerOptions(customerName, currentManager);
    const selectedManager = managerSelect.value;
    projectDeleteSelect.innerHTML = projectOptions(customerName, selectedManager, projectDeleteSelect.value);
  }

  customerSelect.addEventListener("change", refreshContextDependentSelects);
  managerSelect.addEventListener("change", refreshContextDependentSelects);

  document.getElementById("addCustomerBtn").addEventListener("click", async () => {
    const input = document.getElementById("newCustomerName");
    const name = input.value.trim();
    if (!name) {
      setConfigMessage("Bitte einen Kundennamen eingeben.", true);
      return;
    }
    if (state.config.customers.some((customer) => customer.name === name)) {
      setConfigMessage("Kunde existiert bereits.", true);
      return;
    }
    state.config.customers.push({ name, projectManagers: [] });
    if (await persistConfig()) {
      input.value = "";
      setConfigMessage("Kunde gespeichert.");
      renderConfigEditor();
      renderProjectList();
    }
  });

  document.getElementById("deleteCustomerBtn").addEventListener("click", async () => {
    const customerName = customerSelect.value;
    if (!customerName) {
      setConfigMessage("Bitte Kunden zum Loeschen auswaehlen.", true);
      return;
    }
    if (!confirm(`Kunde '${customerName}' inklusive Projektmanager und Projekte loeschen?`)) {
      return;
    }
    state.config.customers = state.config.customers.filter((item) => item.name !== customerName);
    if (await persistConfig()) {
      ensureSelectedProjectStillExists();
      setConfigMessage("Kunde geloescht.");
      renderConfigEditor();
      renderProjectList();
    }
  });

  document.getElementById("addManagerBtn").addEventListener("click", async () => {
    const customerName = customerSelect.value;
    const managerInput = document.getElementById("newManagerName");
    const managerName = managerInput.value.trim();
    if (!customerName || !managerName) {
      setConfigMessage("Bitte Kunde und Projektmanager angeben.", true);
      return;
    }
    const customer = state.config.customers.find((item) => item.name === customerName);
    if (!customer) {
      setConfigMessage("Kunde nicht gefunden.", true);
      return;
    }
    if (customer.projectManagers.some((manager) => manager.name === managerName)) {
      setConfigMessage("Projektmanager existiert bereits.", true);
      return;
    }
    customer.projectManagers.push({ name: managerName, projects: [] });
    if (await persistConfig()) {
      managerInput.value = "";
      setConfigMessage("Projektmanager gespeichert.");
      renderConfigEditor();
      renderProjectList();
    }
  });

  document.getElementById("deleteManagerBtn").addEventListener("click", async () => {
    const customerName = customerSelect.value;
    const managerName = managerSelect.value;
    if (!customerName || !managerName) {
      setConfigMessage("Bitte Kunde und Projektmanager zum Loeschen waehlen.", true);
      return;
    }
    if (!confirm(`Projektmanager '${managerName}' inkl. Projekte loeschen?`)) {
      return;
    }
    const customer = state.config.customers.find((item) => item.name === customerName);
    if (!customer) {
      setConfigMessage("Kunde nicht gefunden.", true);
      return;
    }
    customer.projectManagers = customer.projectManagers.filter((item) => item.name !== managerName);
    if (await persistConfig()) {
      ensureSelectedProjectStillExists();
      setConfigMessage("Projektmanager geloescht.");
      renderConfigEditor();
      renderProjectList();
    }
  });

  document.getElementById("addProjectBtn").addEventListener("click", async () => {
    const customerName = customerSelect.value;
    const managerName = managerSelect.value;
    const projectPath = document.getElementById("newProjectPath").value.trim();

    if (!customerName || !managerName || !projectPath) {
      setConfigMessage("Bitte Kunde, Projektmanager und Verzeichnis angeben.", true);
      return;
    }

    const customer = state.config.customers.find((item) => item.name === customerName);
    const manager = customer?.projectManagers?.find((item) => item.name === managerName);
    if (!manager) {
      setConfigMessage("Projektmanager nicht gefunden.", true);
      return;
    }

    if (manager.projects.some((project) => project.path === projectPath)) {
      setConfigMessage("Das Verzeichnis ist bereits vorhanden.", true);
      return;
    }

    manager.projects.push({
      path: projectPath,
    });

    if (await persistConfig()) {
      document.getElementById("newProjectPath").value = "";
      setConfigMessage("Projektverzeichnis gespeichert.");
      renderConfigEditor();
      renderProjectList();
    }
  });

  document.getElementById("browseProjectPathBtn").addEventListener("click", async () => {
    const input = document.getElementById("newProjectPath");
    const startPath = input.value.trim();
    const result = await window.dashboardApi.pickDirectory({ startPath });
    if (result?.ok && result.path) {
      input.value = result.path;
      setConfigMessage("Verzeichnis ausgewaehlt.");
      return;
    }
    if (result?.canceled) {
      setConfigMessage("Auswahl abgebrochen.");
      return;
    }
    setConfigMessage(`Verzeichniswahl fehlgeschlagen: ${result?.error || "Unbekannter Fehler"}`, true);
  });

  document.getElementById("deleteProjectBtn").addEventListener("click", async () => {
    const customerName = customerSelect.value;
    const managerName = managerSelect.value;
    const projectPath = projectDeleteSelect.value;
    if (!customerName || !managerName || !projectPath) {
      setConfigMessage("Bitte Kunde, Projektmanager und Projekt zum Loeschen waehlen.", true);
      return;
    }
    const selectedProject = state.config.customers
      .find((item) => item.name === customerName)
      ?.projectManagers?.find((item) => item.name === managerName)
      ?.projects?.find((project) => project.path === projectPath);
    const projectName =
      selectedProject?.name || projectPath.split("/").filter(Boolean).pop() || "Projekt";
    if (!confirm(`Projekt '${projectName}' loeschen?`)) {
      return;
    }
    const customer = state.config.customers.find((item) => item.name === customerName);
    const manager = customer?.projectManagers?.find((item) => item.name === managerName);
    if (!manager) {
      setConfigMessage("Projektmanager nicht gefunden.", true);
      return;
    }
    manager.projects = manager.projects.filter(
      (project) => project.path !== projectPath,
    );
    if (await persistConfig()) {
      ensureSelectedProjectStillExists();
      setConfigMessage("Projekt geloescht.");
      renderConfigEditor();
      renderProjectList();
    }
  });
}

function bindDashboardEvents() {
  const selectedProject = state.selectedProjectEntry.project;
  const selectedWidgets = resolveWidgets(selectedProject);
  const projectPath = selectedProject.path;
  const layout = getProjectLayoutState();
  const appDefaults = state.config?.appDefaults || defaultAppDefaults();

  const refresh = document.getElementById("refreshDashboard");
  if (refresh) {
    refresh.addEventListener("click", () => refreshProject());
  }

  const openSettings = document.getElementById("openWidgetSettingsBtn");
  if (openSettings) {
    openSettings.addEventListener("click", () => openWidgetSettingsModal("project", "gridsetup"));
  }

  document.querySelectorAll("[data-open-widget-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const widgetId = button.getAttribute("data-open-widget-tab");
      if (!widgetId) return;
      openWidgetSettingsModal(widgetId, "gridsetup");
    });
  });

  document.querySelectorAll("[data-close-widget]").forEach((button) => {
    button.addEventListener("click", async () => {
      const widgetId = button.getAttribute("data-close-widget");
      if (!widgetId) return;
      layout.widgets[widgetId] = {
        ...(layout.widgets[widgetId] || baseWidgetState()),
        visible: false,
      };
      await persistUiState();
      closeAddWidgetModal();
      renderDashboard();
    });
  });

  document.querySelectorAll(".dashboard-item").forEach((node) => {
    node.addEventListener("dragstart", (event) => {
      const widgetId = node.getAttribute("data-widget-id");
      if (!widgetId) return;
      state.draggingWidgetId = widgetId;
      node.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", widgetId);
    });
    node.addEventListener("dragend", () => {
      node.classList.remove("dragging");
      state.draggingWidgetId = "";
      document.querySelectorAll(".dashboard-item").forEach((item) => item.classList.remove("drop-target"));
    });
    node.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (!state.draggingWidgetId) return;
      node.classList.add("drop-target");
      event.dataTransfer.dropEffect = "move";
    });
    node.addEventListener("dragleave", () => {
      node.classList.remove("drop-target");
    });
    node.addEventListener("drop", async (event) => {
      event.preventDefault();
      node.classList.remove("drop-target");
      const targetId = node.getAttribute("data-widget-id");
      const sourceId = state.draggingWidgetId || event.dataTransfer.getData("text/plain");
      if (!sourceId || !targetId || sourceId === targetId) return;
      const sourceIndex = layout.order.indexOf(sourceId);
      const targetIndex = layout.order.indexOf(targetId);
      if (sourceIndex < 0 || targetIndex < 0) return;
      layout.order.splice(sourceIndex, 1);
      layout.order.splice(targetIndex, 0, sourceId);
      await persistUiState();
      renderDashboard();
    });
  });

  document.querySelectorAll("[data-ddev-run]").forEach((button) => {
    button.addEventListener("click", async () => {
      const buttonId = button.getAttribute("data-ddev-run");
      if (!buttonId) return;
      const fn = getProjectLayoutState()?.widgetFunctions?.ddev || {};
      const commandButton = normalizeDdevButtons(fn.buttons || fn).find((item) => item.id === buttonId);
      if (!commandButton) return;
      const result = await window.dashboardApi.runProjectCommand({
        projectPath,
        command: commandButton.command,
        runInTerminal: commandButton.runInTerminal !== false,
        appDefaults,
      });
      if (!result.ok) {
        alert(result.error || "DDEV Kommando konnte nicht gestartet werden.");
      }
      await refreshProject();
    });
  });

  document.querySelectorAll("[data-git-checkout]").forEach((button) => {
    button.addEventListener("click", async () => {
      const branch = button.getAttribute("data-git-checkout");
      const result = await window.dashboardApi.runGit({ projectPath, action: "checkout", branch });
      alert(result.ok ? result.stdout || "OK" : result.stderr || "Fehler");
      await refreshProject();
    });
  });

  document.querySelectorAll("[data-npm-run]").forEach((button) => {
    button.addEventListener("click", async () => {
      const buttonId = button.getAttribute("data-npm-run");
      if (!buttonId) return;
      const fn = getProjectLayoutState()?.widgetFunctions?.npm || {};
      const commandButton = normalizeNpmButtons(fn.buttons).find((item) => item.id === buttonId);
      if (!commandButton) return;
      const result = await window.dashboardApi.runProjectCommand({
        projectPath,
        command: commandButton.command,
        runInTerminal: commandButton.runInTerminal !== false,
        appDefaults,
      });
      if (!result.ok) {
        alert(result.error || "Kommando konnte nicht gestartet werden.");
      }
    });
  });

  document.querySelectorAll("[data-command-widget][data-command-btn]").forEach((button) => {
    button.addEventListener("click", async () => {
      const widgetId = button.getAttribute("data-command-widget");
      const buttonId = button.getAttribute("data-command-btn");
      if (!widgetId || !buttonId || !isCommandWidgetId(widgetId)) return;
      const fn = normalizeCommandWidgetSettings(getProjectLayoutState()?.widgetFunctions?.[widgetId]);
      const commandButton = fn.buttons.find((item) => item.id === buttonId);
      if (!commandButton) return;
      const result = await window.dashboardApi.runProjectCommand({
        projectPath,
        command: commandButton.command,
        runInTerminal: commandButton.runInTerminal !== false,
        appDefaults,
      });
      if (!result.ok) {
        alert(result.error || "Kommando konnte nicht gestartet werden.");
      }
    });
  });

  document.querySelectorAll("[data-launcher]").forEach((button) => {
    button.addEventListener("click", async () => {
      const program = button.getAttribute("data-launcher");
      const result = await window.dashboardApi.openLauncher({ projectPath, program, appDefaults });
      if (!result.ok) alert(result.error || "Programm konnte nicht geoeffnet werden.");
    });
  });

  document.querySelectorAll("[data-open-path]").forEach((button) => {
    button.addEventListener("click", async () => {
      const targetPath = button.getAttribute("data-open-path");
      if (!targetPath) return;
      const result = await window.dashboardApi.openPath({ targetPath, appDefaults });
      if (!result.ok) alert(result.error || "Verzeichnis konnte nicht geoeffnet werden.");
    });
  });

  document.querySelectorAll("[data-url]").forEach((button) => {
    button.addEventListener("click", async () => {
      const idx = Number(button.getAttribute("data-url"));
      const url = state.projectData.urls[idx];
      const result = await window.dashboardApi.openBrowserUrl({ url, appDefaults });
      if (!result.ok) alert(result.error || "URL konnte nicht geoeffnet werden.");
    });
  });

  document.querySelectorAll("[data-ssh]").forEach((button) => {
    button.addEventListener("click", async () => {
      const idx = Number(button.getAttribute("data-ssh"));
      const entry = selectedWidgets.ssh[idx];
      const result = await window.dashboardApi.openSsh({
        projectPath,
        host: entry.host,
        username: entry.username,
        appDefaults,
      });
      if (!result.ok) alert(result.error || "SSH konnte nicht gestartet werden.");
    });
  });
}

async function init() {
  const result = await window.dashboardApi.getConfig();
  if (!result.ok) {
    el.configMeta.textContent = "Konfiguration konnte nicht geladen werden.";
    setDashboard(`
      <div class="empty-state">
        <h2>Fehler</h2>
        <p>${escapeHtml(result.error)}</p>
      </div>
    `);
    return;
  }

  state.configPath = result.configPath;
  state.config = result.config;
  ensureAppDefaultsInState();
  el.configMeta.textContent = `Konfiguration: ${state.configPath}`;

  const uiStateResult = await window.dashboardApi.getUiState();
  if (uiStateResult?.ok && uiStateResult.uiState) {
    state.uiState = {
      ...state.uiState,
      ...uiStateResult.uiState,
    };
    state.collapsedCustomers = new Set(state.uiState.collapsedCustomers || []);
    state.collapsedManagers = new Set(state.uiState.collapsedManagers || []);
  }

  bindModalEvents();
  updateAddWidgetButtonState();
  if (state.uiState.configEditorOpen) {
    el.configModal.classList.remove("hidden");
  } else {
    el.configModal.classList.add("hidden");
  }
  if (state.uiState.dashboardSettingsOpen) {
    el.widgetSettingsModal.classList.remove("hidden");
  } else {
    el.widgetSettingsModal.classList.add("hidden");
  }

  renderConfigEditor();
  renderProjectList();

  if (state.uiState.lastSelectedProjectRef) {
    const projects = flattenProjects();
    const match = projects.find((item) => item.ref === state.uiState.lastSelectedProjectRef);
    if (match) {
      state.selectedRef = match.ref;
      state.selectedProjectEntry = match;
      state.collapsedCustomers.delete(match.customerName);
      state.collapsedManagers.delete(`${match.customerName}::${match.managerName}`);
      renderProjectList();
      await refreshProject();
    } else {
      state.uiState.lastSelectedProjectRef = "";
      await persistUiState();
    }
  }
}

init();
