(function registerDdevWidgetConfiguration() {
  window.registerProjectDashboardWidgetConfigurationModule({
    render(ctx, widgetId, definition, fn) {
      if (widgetId !== "ddev") return null;
      const buttons = ctx.normalizeDdevButtons(fn.buttons || fn);
      const rows = buttons
        .map((item, index) => `
          <div class="config-block">
            <label>Label</label>
            <input data-ddev-label="${index}" value="${ctx.escapeHtml(item.label)}" />
            <label>Befehl</label>
            <input data-ddev-command="${index}" value="${ctx.escapeHtml(item.command)}" />
            <label><input type="checkbox" data-ddev-terminal="${index}" ${item.runInTerminal ? "checked" : ""} /> Im Terminal ausfuehren</label>
            <button data-remove-ddev-btn="${index}" class="danger">Button entfernen</button>
          </div>
        `)
        .join("");
      return `
        <h3>${ctx.escapeHtml(definition?.title || widgetId)} Funktionen</h3>
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
    },

    apply(ctx, widgetId, fn, layout) {
      if (widgetId !== "ddev") return false;
      const labels = Array.from(document.querySelectorAll("[data-ddev-label]"));
      const commands = Array.from(document.querySelectorAll("[data-ddev-command]"));
      const terminals = Array.from(document.querySelectorAll("[data-ddev-terminal]"));
      const merged = labels.map((labelNode, index) => ({
        id: `ddev_custom_${index}`,
        label: String(labelNode.value || "").trim() || `ddev command ${index + 1}`,
        command: String(commands[index]?.value || "").trim(),
        runInTerminal: Boolean(terminals[index]?.checked),
      }));
      fn.buttons = ctx.normalizeDdevButtons(merged);
      layout.widgetFunctions[widgetId] = fn;
      return true;
    },

    bindExtraEvents(ctx) {
      const addDdevButtonBtn = document.getElementById("addDdevButtonBtn");
      if (addDdevButtonBtn) {
        addDdevButtonBtn.addEventListener("click", async () => {
          const layout = ctx.getProjectLayoutState();
          const fn = layout.widgetFunctions.ddev || { buttons: ctx.defaultDdevButtons() };
          const label = String(document.getElementById("newDdevLabel")?.value || "").trim();
          const command = String(document.getElementById("newDdevCommand")?.value || "").trim();
          const runInTerminal = Boolean(document.getElementById("newDdevRunInTerminal")?.checked);
          if (!command) return;
          const current = ctx.normalizeDdevButtons(fn.buttons || fn);
          current.push({ id: `ddev_custom_${Date.now()}`, label: label || command, command, runInTerminal });
          fn.buttons = ctx.normalizeDdevButtons(current);
          layout.widgetFunctions.ddev = fn;
          await ctx.persistUiState();
          ctx.renderWidgetSettingsModal();
          ctx.renderDashboard();
        });
      }

      document.querySelectorAll("[data-remove-ddev-btn]").forEach((button) => {
        button.addEventListener("click", async () => {
          const index = Number(button.getAttribute("data-remove-ddev-btn"));
          if (!Number.isFinite(index)) return;
          const layout = ctx.getProjectLayoutState();
          const fn = layout.widgetFunctions.ddev || { buttons: ctx.defaultDdevButtons() };
          fn.buttons = ctx.normalizeDdevButtons(fn.buttons || fn).filter((_, idx) => idx !== index);
          layout.widgetFunctions.ddev = fn;
          await ctx.persistUiState();
          ctx.renderWidgetSettingsModal();
          ctx.renderDashboard();
        });
      });
    },
  });
})();
