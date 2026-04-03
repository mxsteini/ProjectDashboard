(function registerNpmWidgetConfiguration() {
  window.registerProjectDashboardWidgetConfigurationModule({
    render(ctx, widgetId, definition, fn) {
      if (widgetId !== "npm") return null;
      const buttons = ctx.normalizeNpmButtons(fn.buttons);
      const rows = buttons
        .map((item, index) => `
          <div class="config-block">
            <label>Label</label>
            <input data-npm-label="${index}" value="${ctx.escapeHtml(item.label)}" />
            <label>Befehl</label>
            <input data-npm-command="${index}" value="${ctx.escapeHtml(item.command)}" />
            <label><input type="checkbox" data-npm-terminal="${index}" ${item.runInTerminal ? "checked" : ""} /> Im Terminal ausfuehren</label>
            <button data-remove-npm-btn="${index}" class="danger">Button entfernen</button>
          </div>
        `)
        .join("");
      return `
        <h3>${ctx.escapeHtml(definition?.title || widgetId)} Funktionen</h3>
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
    },
    apply(ctx, widgetId, fn, layout) {
      if (widgetId !== "npm") return false;
      const labels = Array.from(document.querySelectorAll("[data-npm-label]"));
      const commands = Array.from(document.querySelectorAll("[data-npm-command]"));
      const terminals = Array.from(document.querySelectorAll("[data-npm-terminal]"));
      const merged = labels.map((labelNode, index) => ({
        id: `npm_custom_${index}`,
        label: String(labelNode.value || "").trim() || `npm command ${index + 1}`,
        command: String(commands[index]?.value || "").trim(),
        runInTerminal: Boolean(terminals[index]?.checked),
      }));
      fn.buttons = ctx.normalizeNpmButtons(merged);
      layout.widgetFunctions[widgetId] = fn;
      return true;
    },
    bindExtraEvents(ctx) {
      const addNpmButtonBtn = document.getElementById("addNpmButtonBtn");
      if (addNpmButtonBtn) {
        addNpmButtonBtn.addEventListener("click", async () => {
          const layout = ctx.getProjectLayoutState();
          const fn = layout.widgetFunctions.npm || { buttons: ctx.defaultNpmButtons() };
          const label = String(document.getElementById("newNpmLabel")?.value || "").trim();
          const command = String(document.getElementById("newNpmCommand")?.value || "").trim();
          const runInTerminal = Boolean(document.getElementById("newNpmRunInTerminal")?.checked);
          if (!command) return;
          const current = ctx.normalizeNpmButtons(fn.buttons);
          current.push({ id: `npm_custom_${Date.now()}`, label: label || command, command, runInTerminal });
          fn.buttons = ctx.normalizeNpmButtons(current);
          layout.widgetFunctions.npm = fn;
          await ctx.persistUiState();
          ctx.renderWidgetSettingsModal();
          ctx.renderDashboard();
        });
      }
      document.querySelectorAll("[data-remove-npm-btn]").forEach((button) => {
        button.addEventListener("click", async () => {
          const index = Number(button.getAttribute("data-remove-npm-btn"));
          if (!Number.isFinite(index)) return;
          const layout = ctx.getProjectLayoutState();
          const fn = layout.widgetFunctions.npm || { buttons: ctx.defaultNpmButtons() };
          fn.buttons = ctx.normalizeNpmButtons(fn.buttons).filter((_, idx) => idx !== index);
          layout.widgetFunctions.npm = fn;
          await ctx.persistUiState();
          ctx.renderWidgetSettingsModal();
          ctx.renderDashboard();
        });
      });
    },
  });
})();
