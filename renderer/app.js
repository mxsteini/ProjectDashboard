const state = {
  configPath: "",
  config: null,
  selectedProjectEntry: null,
  selectedRef: "",
  projectData: null,
  uiState: {
    configEditorOpen: false,
    collapsedCustomers: [],
    collapsedManagers: [],
    dashboardSettingsOpen: false,
    dashboardSettingsActiveTab: "grid",
    dashboardLayouts: {},
  },
  collapsedCustomers: new Set(),
  collapsedManagers: new Set(),
  draggingWidgetId: "",
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
  widgetSettingsTabs: document.getElementById("widgetSettingsTabs"),
  widgetSettingsContent: document.getElementById("widgetSettingsContent"),
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

  el.configEditor.innerHTML = `
    <div class="config-block">
      <div class="config-form">
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
}

async function openWidgetSettingsModal(tabId = "grid") {
  if (!state.selectedProjectEntry) return;
  state.uiState.dashboardSettingsOpen = true;
  state.uiState.dashboardSettingsActiveTab = tabId;
  renderWidgetSettingsModal();
  el.widgetSettingsModal.classList.remove("hidden");
  await persistUiState();
}

async function closeWidgetSettingsModal() {
  state.uiState.dashboardSettingsOpen = false;
  el.widgetSettingsModal.classList.add("hidden");
  await persistUiState();
}

function settingsTabsData() {
  const defs = getWidgetDefinitions();
  return [
    { id: "grid", label: "Grid" },
    ...defs
      .filter((item) => item.id !== "project" && item.available)
      .map((item) => ({ id: `widget:${item.id}`, label: item.title })),
  ];
}

function renderWidgetSettingsModal() {
  const layout = getProjectLayoutState();
  if (!layout) {
    el.widgetSettingsTabs.innerHTML = "";
    el.widgetSettingsContent.innerHTML = `<p>Bitte zuerst ein Projekt waehlen.</p>`;
    return;
  }
  const tabs = settingsTabsData();
  if (!tabs.some((item) => item.id === state.uiState.dashboardSettingsActiveTab)) {
    state.uiState.dashboardSettingsActiveTab = "grid";
  }

  el.widgetSettingsTabs.innerHTML = tabs
    .map((tab) => {
      const active = tab.id === state.uiState.dashboardSettingsActiveTab ? "active" : "";
      return `<button class="settings-tab ${active}" data-settings-tab="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}</button>`;
    })
    .join("");

  const active = state.uiState.dashboardSettingsActiveTab;
  if (active === "grid") {
    const defs = getWidgetDefinitions();
    const rows = defs
      .filter((item) => item.available)
      .map((item) => {
        const current = layout.widgets[item.id]?.colSpan || 2;
        return `
          <label>${escapeHtml(item.title)} Breite (Spalten)</label>
          <input type="number" min="1" max="6" id="gridWidth_${escapeHtml(item.id)}" value="${current}" />
        `;
      })
      .join("");

    el.widgetSettingsContent.innerHTML = `
      <h3>Grid Einstellungen</h3>
      <p>Raster: <strong>6 Spalten</strong> (fix)</p>
      <label>Abstand (px)</label>
      <input id="gridGapInput" type="number" min="4" max="32" value="${layout.grid.gap}" />
      <hr />
      ${rows}
      <div class="actions">
        <button id="saveGridSettingsBtn">Grid speichern</button>
      </div>
    `;
  } else if (active.startsWith("widget:")) {
    const widgetId = active.replace("widget:", "");
    const definition = getWidgetDefinitions().find((item) => item.id === widgetId);
    const fn = layout.widgetFunctions[widgetId] || {};
    if (widgetId === "ddev") {
      el.widgetSettingsContent.innerHTML = `
        <h3>${escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <label><input id="ddevAllowStatus" type="checkbox" ${fn.allowStatus ? "checked" : ""} /> Status Aktion</label>
        <label><input id="ddevAllowStart" type="checkbox" ${fn.allowStart ? "checked" : ""} /> Start Aktion</label>
        <label><input id="ddevAllowStop" type="checkbox" ${fn.allowStop ? "checked" : ""} /> Stop Aktion</label>
        <label><input id="ddevAllowRestart" type="checkbox" ${fn.allowRestart ? "checked" : ""} /> Restart Aktion</label>
        <div class="actions"><button id="saveWidgetSettingsBtn" data-widget-id="ddev">Einstellungen speichern</button></div>
      `;
    } else if (widgetId === "git") {
      el.widgetSettingsContent.innerHTML = `
        <h3>${escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <label><input id="gitAllowStatus" type="checkbox" ${fn.allowStatus ? "checked" : ""} /> Status Aktion</label>
        <label><input id="gitAllowPull" type="checkbox" ${fn.allowPull ? "checked" : ""} /> Pull Aktion</label>
        <label><input id="gitAllowPush" type="checkbox" ${fn.allowPush ? "checked" : ""} /> Push Aktion</label>
        <div class="actions"><button id="saveWidgetSettingsBtn" data-widget-id="git">Einstellungen speichern</button></div>
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
  el.widgetSettingsTabs.querySelectorAll("[data-settings-tab]").forEach((node) => {
    node.addEventListener("click", () => {
      state.uiState.dashboardSettingsActiveTab = node.getAttribute("data-settings-tab") || "grid";
      renderWidgetSettingsModal();
      persistUiState();
    });
  });

  const saveGridButton = document.getElementById("saveGridSettingsBtn");
  if (saveGridButton) {
    saveGridButton.addEventListener("click", async () => {
      const layout = getProjectLayoutState();
      const gap = Number(document.getElementById("gridGapInput").value);
      layout.grid.gap = Number.isFinite(gap) ? Math.max(4, Math.min(32, gap)) : 12;
      for (const item of getWidgetDefinitions()) {
        const widthInput = document.getElementById(`gridWidth_${item.id}`);
        if (!widthInput) continue;
        const width = Number(widthInput.value);
        layout.widgets[item.id] = {
          ...(layout.widgets[item.id] || baseWidgetState()),
          colSpan: Number.isFinite(width) ? Math.max(1, Math.min(6, width)) : 2,
        };
      }
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
        fn.allowStatus = Boolean(document.getElementById("ddevAllowStatus")?.checked);
        fn.allowStart = Boolean(document.getElementById("ddevAllowStart")?.checked);
        fn.allowStop = Boolean(document.getElementById("ddevAllowStop")?.checked);
        fn.allowRestart = Boolean(document.getElementById("ddevAllowRestart")?.checked);
      } else if (widgetId === "git") {
        fn.allowStatus = Boolean(document.getElementById("gitAllowStatus")?.checked);
        fn.allowPull = Boolean(document.getElementById("gitAllowPull")?.checked);
        fn.allowPush = Boolean(document.getElementById("gitAllowPush")?.checked);
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
  state.projectData = null;
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
  };
}

function baseWidgetFunctionSettings() {
  return {
    project: {
      showPath: true,
    },
    ddev: {
      allowStatus: true,
      allowStart: true,
      allowStop: true,
      allowRestart: true,
    },
    disk: {},
    git: {
      allowStatus: true,
      allowPull: true,
      allowPush: true,
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

function getProjectLayoutState() {
  const key = currentProjectKey();
  if (!key) return null;

  if (!state.uiState.dashboardLayouts) {
    state.uiState.dashboardLayouts = {};
  }

  if (!state.uiState.dashboardLayouts[key]) {
    state.uiState.dashboardLayouts[key] = {
      order: ["project", "ddev", "disk", "git", "launcher", "ssh", "browser"],
      grid: {
        columns: 6,
        gap: 12,
      },
      widgets: {
        project: { visible: true, colSpan: 3 },
        ddev: baseWidgetState(),
        disk: baseWidgetState(),
        git: baseWidgetState(),
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
  for (const id of ["project", "ddev", "disk", "git", "launcher", "ssh", "browser"]) {
    const existing = layout.widgets[id] || {};
    layout.widgets[id] = {
      visible: typeof existing.visible === "boolean" ? existing.visible : true,
      colSpan: Number.isFinite(Number(existing.colSpan))
        ? Math.max(1, Math.min(6, Number(existing.colSpan)))
        : (id === "project" ? 3 : 2),
    };
  }

  if (!Array.isArray(layout.order)) {
    layout.order = ["project", "ddev", "disk", "git", "launcher", "ssh", "browser"];
  }

  const functionDefaults = baseWidgetFunctionSettings();
  layout.widgetFunctions = layout.widgetFunctions || {};
  for (const widgetId of Object.keys(functionDefaults)) {
    layout.widgetFunctions[widgetId] = {
      ...functionDefaults[widgetId],
      ...(layout.widgetFunctions[widgetId] || {}),
    };
  }

  return layout;
}

function renderWidgetShell(widgetId, title, body, colSpan) {
  return `
    <article class="widget dashboard-item" draggable="true" data-widget-id="${escapeHtml(widgetId)}" style="grid-column: span ${colSpan};">
      <div class="widget-header">
        <h3>${escapeHtml(title)}</h3>
        <button data-open-widget-tab="${escapeHtml(widgetId)}">Settings</button>
      </div>
      ${body}
    </article>
  `;
}

function renderDdevBody(fn) {
  const ddev = state.projectData?.ddevStatus;
  const out = ddev?.stdout || ddev?.stderr || "Keine Ausgabe.";
  const cls = statusClass(Boolean(ddev?.ok));
  const buttons = [];
  if (fn.allowStatus) buttons.push(`<button data-ddev="status">Status</button>`);
  if (fn.allowStart) buttons.push(`<button data-ddev="start">Start</button>`);
  if (fn.allowStop) buttons.push(`<button data-ddev="stop">Stop</button>`);
  if (fn.allowRestart) buttons.push(`<button data-ddev="restart">Restart</button>`);
  return `
    <p class="${cls}">${ddev?.ok ? "Status abrufbar" : "DDEV nicht verfuegbar oder Projekt nicht initialisiert"}</p>
    <div class="actions">${buttons.join("") || `<span class="status-warn">Keine DDEV Aktionen aktiv.</span>`}</div>
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
  const summary = git?.ok
    ? `Branch: ${escapeHtml(git.branch)}`
    : escapeHtml(git?.message || "Kein Git-Repository.");
  const output = git?.status || "Keine Ausgabe.";
  const buttons = [];
  if (fn.allowStatus) buttons.push(`<button data-git="status">Status</button>`);
  if (fn.allowPull) buttons.push(`<button data-git="pull">Pull</button>`);
  if (fn.allowPush) buttons.push(`<button data-git="push">Push</button>`);
  return `
    <p class="${cls}">${summary}</p>
    <div class="actions">${buttons.join("") || `<span class="status-warn">Keine Git Aktionen aktiv.</span>`}</div>
    <pre>${escapeHtml(output)}</pre>
  `;
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
  return [
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
    {
      id: "launcher",
      title: "Programmstarter",
      available: Boolean(widgets.launcher),
      body: renderLauncherBody(fn.launcher || {}),
    },
    { id: "ssh", title: "SSH", available: Boolean(widgets.ssh), body: renderSshBody(fn.ssh || {}) },
    { id: "browser", title: "Browser", available: Boolean(widgets.browser), body: renderBrowserBody(fn.browser || {}) },
  ];
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
      return renderWidgetShell(id, widget.title, widget.body, colSpan);
    });

  setDashboard(parts.length ? parts.join("") : `<div class="empty-state"><h2>Keine Widgets sichtbar</h2></div>`);
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

  const refresh = document.getElementById("refreshDashboard");
  if (refresh) {
    refresh.addEventListener("click", () => refreshProject());
  }

  const openSettings = document.getElementById("openWidgetSettingsBtn");
  if (openSettings) {
    openSettings.addEventListener("click", () => openWidgetSettingsModal("grid"));
  }

  document.querySelectorAll("[data-open-widget-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const widgetId = button.getAttribute("data-open-widget-tab");
      if (!widgetId) return;
      openWidgetSettingsModal(`widget:${widgetId}`);
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

  document.querySelectorAll("[data-ddev]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.getAttribute("data-ddev");
      const result = await window.dashboardApi.runDdev({ projectPath, action });
      alert(result.ok ? result.stdout || "OK" : result.stderr || "Fehler");
      await refreshProject();
    });
  });

  document.querySelectorAll("[data-git]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.getAttribute("data-git");
      const result = await window.dashboardApi.runGit({ projectPath, action });
      alert(result.ok ? result.stdout || "OK" : result.stderr || "Fehler");
      await refreshProject();
    });
  });

  document.querySelectorAll("[data-launcher]").forEach((button) => {
    button.addEventListener("click", async () => {
      const program = button.getAttribute("data-launcher");
      const result = await window.dashboardApi.openLauncher({ projectPath, program });
      if (!result.ok) alert(result.error || "Programm konnte nicht geoeffnet werden.");
    });
  });

  document.querySelectorAll("[data-url]").forEach((button) => {
    button.addEventListener("click", async () => {
      const idx = Number(button.getAttribute("data-url"));
      const url = state.projectData.urls[idx];
      const result = await window.dashboardApi.openBrowserUrl({ url });
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
}

init();
