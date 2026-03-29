const state = {
  configPath: "",
  config: null,
  selectedProjectEntry: null,
  selectedRef: "",
  projectData: null,
};

const el = {
  configMeta: document.getElementById("configMeta"),
  projectList: document.getElementById("projectList"),
  dashboard: document.getElementById("dashboard"),
  configEditor: document.getElementById("configEditor"),
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
    <details open class="config-block">
      <summary>Basiskonfiguration</summary>
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
    </details>
  `;

  bindConfigEditorEvents();
}

function renderProjectList() {
  const projects = flattenProjects();
  if (projects.length === 0) {
    el.projectList.innerHTML = `<p>Keine Projekte konfiguriert.</p>`;
    return;
  }

  const treeParts = [];
  for (const customer of state.config.customers) {
    treeParts.push(`<div class="tree-customer">${escapeHtml(customer.name)}</div>`);
    for (const manager of customer.projectManagers || []) {
      treeParts.push(`<div class="tree-manager">└ ${escapeHtml(manager.name)}</div>`);
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

function renderWidgetShell(title, body) {
  return `
    <article class="widget">
      <h3>${escapeHtml(title)}</h3>
      ${body}
    </article>
  `;
}

function renderDdevWidget() {
  const ddev = state.projectData?.ddevStatus;
  const out = ddev?.stdout || ddev?.stderr || "Keine Ausgabe.";
  const cls = statusClass(Boolean(ddev?.ok));
  return renderWidgetShell(
    "DDEV",
    `
      <p class="${cls}">${ddev?.ok ? "Status abrufbar" : "DDEV nicht verfuegbar oder Projekt nicht initialisiert"}</p>
      <div class="actions">
        <button data-ddev="status">Status</button>
        <button data-ddev="start">Start</button>
        <button data-ddev="stop">Stop</button>
        <button data-ddev="restart">Restart</button>
      </div>
      <pre>${escapeHtml(out)}</pre>
    `,
  );
}

function renderDiskWidget() {
  const disk = state.projectData?.diskUsage;
  return renderWidgetShell(
    "Disk Usage",
    `
      <p class="${statusClass(Boolean(disk?.ok))}">
        ${disk?.ok ? `Projektgroesse: ${escapeHtml(disk.size)}` : escapeHtml(disk?.message || "n/a")}
      </p>
    `,
  );
}

function renderGitWidget() {
  const git = state.projectData?.gitInfo;
  const cls = statusClass(Boolean(git?.ok));
  const summary = git?.ok
    ? `Branch: ${escapeHtml(git.branch)}`
    : escapeHtml(git?.message || "Kein Git-Repository.");
  const output = git?.status || "Keine Ausgabe.";
  return renderWidgetShell(
    "Git",
    `
      <p class="${cls}">${summary}</p>
      <div class="actions">
        <button data-git="status">Status</button>
        <button data-git="pull">Pull</button>
        <button data-git="push">Push</button>
      </div>
      <pre>${escapeHtml(output)}</pre>
    `,
  );
}

function renderLauncherWidget() {
  return renderWidgetShell(
    "Programmstarter",
    `
      <div class="actions">
        <button data-launcher="cursor">Cursor</button>
        <button data-launcher="vscode">VS Code</button>
        <button data-launcher="explorer">Explorer</button>
        <button data-launcher="terminal">Terminal</button>
      </div>
      <p class="meta">Startet Programme im Projektkontext.</p>
    `,
  );
}

function renderSshWidget() {
  const selectedProject = state.selectedProjectEntry.project;
  const sshConfigs = resolveWidgets(selectedProject).ssh;
  if (!Array.isArray(sshConfigs) || sshConfigs.length === 0) {
    return renderWidgetShell(
      "SSH",
      `<p class="status-warn">Keine SSH-Verbindungen in der Konfiguration hinterlegt.</p>`,
    );
  }

  const buttons = sshConfigs
    .map((item, idx) => {
      const label = item.label || `${item.username}@${item.host}`;
      return `<button data-ssh="${idx}">${escapeHtml(label)}</button>`;
    })
    .join("");

  return renderWidgetShell(
    "SSH",
    `
      <div class="actions">${buttons}</div>
      <p class="meta">Hinweis: Passwoerter werden nicht automatisiert uebergeben.</p>
    `,
  );
}

function renderBrowserWidget() {
  const urls = state.projectData?.urls || [];
  if (urls.length === 0) {
    return renderWidgetShell("Browser", `<p class="status-warn">Keine URLs gefunden.</p>`);
  }
  const buttons = urls
    .map((url, idx) => `<button data-url="${idx}">${escapeHtml(url)}</button>`)
    .join("");
  return renderWidgetShell(
    "Browser",
    `
      <div class="actions">${buttons}</div>
      <p class="meta">URLs aus .ddev/config.yaml und config/sites/**/*.yaml</p>
    `,
  );
}

function renderDashboard() {
  const selected = state.selectedProjectEntry;
  if (!selected) return;
  const project = selected.project;
  const widgets = resolveWidgets(project);
  const parts = [];
  parts.push(
    `
    <article class="widget">
      <h3>Projekt</h3>
      <p><strong>${escapeHtml(project.name)}</strong></p>
      <p>Kunde: ${escapeHtml(selected.customerName)}</p>
      <p>Projektmanager: ${escapeHtml(selected.managerName)}</p>
      <p>Pfad: ${escapeHtml(project.path)}</p>
      <div class="actions">
        <button id="refreshDashboard">Aktualisieren</button>
      </div>
    </article>
  `,
  );

  if (widgets.ddev) parts.push(renderDdevWidget());
  if (widgets.diskUsage) parts.push(renderDiskWidget());
  if (widgets.git) parts.push(renderGitWidget());
  if (widgets.launcher) parts.push(renderLauncherWidget());
  if (widgets.ssh) parts.push(renderSshWidget());
  if (widgets.browser) parts.push(renderBrowserWidget());

  setDashboard(parts.join(""));
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

  const refresh = document.getElementById("refreshDashboard");
  if (refresh) {
    refresh.addEventListener("click", () => refreshProject());
  }

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
  renderConfigEditor();
  renderProjectList();
}

init();
