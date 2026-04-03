(function registerBrowserWidgetConfiguration() {
  window.registerProjectDashboardWidgetConfigurationModule({
    render(ctx, widgetId, definition, fn) {
      if (widgetId !== "browser") return null;
      return `
        <h3>${ctx.escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <label><input id="browserShowSourceHint" type="checkbox" ${fn.showSourceHint ? "checked" : ""} /> Quellenhinweis anzeigen</label>
        <div class="actions"><button id="saveWidgetSettingsBtn" data-widget-id="browser">Einstellungen speichern</button></div>
      `;
    },
    apply(_ctx, widgetId, fn, layout) {
      if (widgetId !== "browser") return false;
      fn.showSourceHint = Boolean(document.getElementById("browserShowSourceHint")?.checked);
      layout.widgetFunctions[widgetId] = fn;
      return true;
    },
  });
})();
