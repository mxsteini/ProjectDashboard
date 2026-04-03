(function registerCommandWidgetConfiguration() {
  window.registerProjectDashboardWidgetConfigurationModule({
    render(ctx, widgetId, definition, fn) {
      if (!ctx.isCommandWidgetId(widgetId)) return null;
      const commandFn = ctx.normalizeCommandWidgetSettings(fn);
      const rows = commandFn.buttons
        .map((item, index) => `
          <div class="config-block">
            <label>Label</label>
            <input data-command-label="${index}" value="${ctx.escapeHtml(item.label)}" />
            <label>Befehl</label>
            <input data-command-command="${index}" value="${ctx.escapeHtml(item.command)}" />
            <label><input type="checkbox" data-command-terminal="${index}" ${item.runInTerminal ? "checked" : ""} /> Im Terminal ausfuehren</label>
            <button data-remove-command-btn="${index}" class="danger">Button entfernen</button>
          </div>
        `)
        .join("");
      return `
        <h3>${ctx.escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <label>Widget Titel</label>
        <input id="commandWidgetTitle" value="${ctx.escapeHtml(commandFn.title)}" placeholder="Command" />
        ${rows}
        <div class="config-block">
          <label>Neuer Button Label</label>
          <input id="newCommandLabel" placeholder="z. B. Build" />
          <label>Neuer Befehl</label>
          <input id="newCommandCommand" placeholder="npm run build" />
          <label><input type="checkbox" id="newCommandRunInTerminal" checked /> Im Terminal ausfuehren</label>
          <button id="addCommandButtonBtn">Button hinzufuegen</button>
        </div>
        <div class="actions"><button id="saveWidgetSettingsBtn" data-widget-id="${ctx.escapeHtml(widgetId)}">Einstellungen speichern</button></div>
      `;
    },
    apply(ctx, widgetId, fn, layout) {
      if (!ctx.isCommandWidgetId(widgetId)) return false;
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
      fn.buttons = ctx.normalizeCommandButtons(merged);
      layout.widgetFunctions[widgetId] = fn;
      return true;
    },
    bindExtraEvents(ctx) {
      const addCommandButtonBtn = document.getElementById("addCommandButtonBtn");
      if (addCommandButtonBtn) {
        addCommandButtonBtn.addEventListener("click", async () => {
          const layout = ctx.getProjectLayoutState();
          const widgetId = ctx.state.uiState.dashboardSettingsActiveWidget;
          if (!ctx.isCommandWidgetId(widgetId)) return;
          const fn = ctx.normalizeCommandWidgetSettings(layout.widgetFunctions[widgetId]);
          const label = String(document.getElementById("newCommandLabel")?.value || "").trim();
          const command = String(document.getElementById("newCommandCommand")?.value || "").trim();
          const runInTerminal = Boolean(document.getElementById("newCommandRunInTerminal")?.checked);
          if (!command) return;
          const current = ctx.normalizeCommandButtons(fn.buttons);
          current.push({ id: `command_custom_${Date.now()}`, label: label || command, command, runInTerminal });
          fn.buttons = ctx.normalizeCommandButtons(current);
          fn.title = String(document.getElementById("commandWidgetTitle")?.value || fn.title || "Command").trim() || "Command";
          layout.widgetFunctions[widgetId] = fn;
          await ctx.persistUiState();
          ctx.renderWidgetSettingsModal();
          ctx.renderDashboard();
        });
      }
      document.querySelectorAll("[data-remove-command-btn]").forEach((button) => {
        button.addEventListener("click", async () => {
          const index = Number(button.getAttribute("data-remove-command-btn"));
          if (!Number.isFinite(index)) return;
          const layout = ctx.getProjectLayoutState();
          const widgetId = ctx.state.uiState.dashboardSettingsActiveWidget;
          if (!ctx.isCommandWidgetId(widgetId)) return;
          const fn = ctx.normalizeCommandWidgetSettings(layout.widgetFunctions[widgetId]);
          fn.buttons = ctx.normalizeCommandButtons(fn.buttons).filter((_, idx) => idx !== index);
          fn.title = String(document.getElementById("commandWidgetTitle")?.value || fn.title || "Command").trim() || "Command";
          layout.widgetFunctions[widgetId] = fn;
          await ctx.persistUiState();
          ctx.renderWidgetSettingsModal();
          ctx.renderDashboard();
        });
      });
    },
  });
})();
