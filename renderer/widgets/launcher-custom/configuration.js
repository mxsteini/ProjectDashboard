(function registerLauncherCustomWidgetConfiguration() {
  window.registerProjectDashboardWidgetConfigurationModule({
    render(ctx, widgetId, definition, fn) {
      if (!ctx.isLauncherWidgetId(widgetId)) return null;
      const launcherFn = ctx.normalizeLauncherWidgetSettings(fn);
      const rows = launcherFn.buttons
        .map((item, index) => `
          <div class="config-block">
            <label>Label</label>
            <input data-launcher-cmd-label="${index}" value="${ctx.escapeHtml(item.label)}" />
            <label>Befehl</label>
            <input data-launcher-cmd-command="${index}" value="${ctx.escapeHtml(item.command)}" />
            <label><input type="checkbox" data-launcher-cmd-terminal="${index}" ${item.runInTerminal ? "checked" : ""} /> Im Terminal ausfuehren</label>
            <button data-remove-launcher-cmd="${index}" class="danger">Button entfernen</button>
          </div>
        `)
        .join("");
      return `
        <h3>${ctx.escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <label>Widget Titel</label>
        <input id="launcherWidgetTitle" value="${ctx.escapeHtml(launcherFn.title)}" placeholder="Launcher" />
        ${rows}
        <div class="config-block">
          <label>Neuer Button Label</label>
          <input id="newLauncherCmdLabel" placeholder="z. B. Build" />
          <label>Neuer Befehl</label>
          <input id="newLauncherCmdCommand" placeholder="npm run build" />
          <label><input type="checkbox" id="newLauncherCmdRunInTerminal" checked /> Im Terminal ausfuehren</label>
          <button id="addLauncherCmdButtonBtn">Button hinzufuegen</button>
        </div>
        <div class="actions"><button id="saveWidgetSettingsBtn" data-widget-id="${ctx.escapeHtml(widgetId)}">Einstellungen speichern</button></div>
      `;
    },
    apply(ctx, widgetId, fn, layout) {
      if (!ctx.isLauncherWidgetId(widgetId)) return false;
      const labels = Array.from(document.querySelectorAll("[data-launcher-cmd-label]"));
      const commands = Array.from(document.querySelectorAll("[data-launcher-cmd-command]"));
      const terminals = Array.from(document.querySelectorAll("[data-launcher-cmd-terminal]"));
      const merged = labels.map((labelNode, index) => ({
        id: `launcher_custom_${index}`,
        label: String(labelNode.value || "").trim() || `Launcher command ${index + 1}`,
        command: String(commands[index]?.value || "").trim(),
        runInTerminal: Boolean(terminals[index]?.checked),
      }));
      fn.title = String(document.getElementById("launcherWidgetTitle")?.value || "").trim() || "Launcher";
      fn.buttons = ctx.normalizeCommandButtons(merged);
      layout.widgetFunctions[widgetId] = fn;
      return true;
    },
    bindExtraEvents(ctx) {
      const addLauncherCmdButtonBtn = document.getElementById("addLauncherCmdButtonBtn");
      if (addLauncherCmdButtonBtn) {
        addLauncherCmdButtonBtn.addEventListener("click", async () => {
          const layout = ctx.getProjectLayoutState();
          const widgetId = ctx.state.uiState.dashboardSettingsActiveWidget;
          if (!ctx.isLauncherWidgetId(widgetId)) return;
          const fn = ctx.normalizeLauncherWidgetSettings(layout.widgetFunctions[widgetId]);
          const label = String(document.getElementById("newLauncherCmdLabel")?.value || "").trim();
          const command = String(document.getElementById("newLauncherCmdCommand")?.value || "").trim();
          const runInTerminal = Boolean(document.getElementById("newLauncherCmdRunInTerminal")?.checked);
          if (!command) return;
          const current = ctx.normalizeCommandButtons(fn.buttons);
          current.push({ id: `launcher_custom_${Date.now()}`, label: label || command, command, runInTerminal });
          fn.buttons = ctx.normalizeCommandButtons(current);
          fn.title = String(document.getElementById("launcherWidgetTitle")?.value || fn.title || "Launcher").trim() || "Launcher";
          layout.widgetFunctions[widgetId] = fn;
          await ctx.persistUiState();
          ctx.renderWidgetSettingsModal();
          ctx.renderDashboard();
        });
      }
      document.querySelectorAll("[data-remove-launcher-cmd]").forEach((button) => {
        button.addEventListener("click", async () => {
          const index = Number(button.getAttribute("data-remove-launcher-cmd"));
          if (!Number.isFinite(index)) return;
          const layout = ctx.getProjectLayoutState();
          const widgetId = ctx.state.uiState.dashboardSettingsActiveWidget;
          if (!ctx.isLauncherWidgetId(widgetId)) return;
          const fn = ctx.normalizeLauncherWidgetSettings(layout.widgetFunctions[widgetId]);
          fn.buttons = ctx.normalizeCommandButtons(fn.buttons).filter((_, idx) => idx !== index);
          fn.title = String(document.getElementById("launcherWidgetTitle")?.value || fn.title || "Launcher").trim() || "Launcher";
          layout.widgetFunctions[widgetId] = fn;
          await ctx.persistUiState();
          ctx.renderWidgetSettingsModal();
          ctx.renderDashboard();
        });
      });
    },
  });
})();
