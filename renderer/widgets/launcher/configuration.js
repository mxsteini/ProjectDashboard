(function registerLauncherWidgetConfiguration() {
  window.registerProjectDashboardWidgetConfigurationModule({
    render(ctx, widgetId, definition, fn) {
      if (widgetId !== "launcher") return null;
      return `
        <h3>${ctx.escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <label><input id="launcherAllowCursor" type="checkbox" ${fn.allowCursor ? "checked" : ""} /> Cursor Button</label>
        <label><input id="launcherAllowVscode" type="checkbox" ${fn.allowVscode ? "checked" : ""} /> VS Code Button</label>
        <label><input id="launcherAllowExplorer" type="checkbox" ${fn.allowExplorer ? "checked" : ""} /> Explorer Button</label>
        <label><input id="launcherAllowTerminal" type="checkbox" ${fn.allowTerminal ? "checked" : ""} /> Terminal Button</label>
        <div class="actions"><button id="saveWidgetSettingsBtn" data-widget-id="launcher">Einstellungen speichern</button></div>
      `;
    },
    apply(_ctx, widgetId, fn, layout) {
      if (widgetId !== "launcher") return false;
      fn.allowCursor = Boolean(document.getElementById("launcherAllowCursor")?.checked);
      fn.allowVscode = Boolean(document.getElementById("launcherAllowVscode")?.checked);
      fn.allowExplorer = Boolean(document.getElementById("launcherAllowExplorer")?.checked);
      fn.allowTerminal = Boolean(document.getElementById("launcherAllowTerminal")?.checked);
      layout.widgetFunctions[widgetId] = fn;
      return true;
    },
  });
})();
