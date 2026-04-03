(function registerGitWidgetConfiguration() {
  window.registerProjectDashboardWidgetConfigurationModule({
    render(ctx, widgetId, definition, fn) {
      if (widgetId !== "git") return null;
      return `
        <h3>${ctx.escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <label><input id="gitAllowCheckout" type="checkbox" ${fn.allowCheckout ? "checked" : ""} /> Checkout Icon anzeigen</label>
        <label><input id="gitAllowDelete" type="checkbox" ${fn.allowDelete !== false ? "checked" : ""} /> Delete Icon anzeigen</label>
        <label><input id="gitShowCurrentBranch" type="checkbox" ${fn.showCurrentBranch ? "checked" : ""} /> Aktiven Branch markieren</label>
        <div class="actions"><button id="saveWidgetSettingsBtn" data-widget-id="git">Einstellungen speichern</button></div>
      `;
    },
    apply(_ctx, widgetId, fn, layout) {
      if (widgetId !== "git") return false;
      fn.allowCheckout = Boolean(document.getElementById("gitAllowCheckout")?.checked);
      fn.allowDelete = Boolean(document.getElementById("gitAllowDelete")?.checked);
      fn.showCurrentBranch = Boolean(document.getElementById("gitShowCurrentBranch")?.checked);
      layout.widgetFunctions[widgetId] = fn;
      return true;
    },
  });
})();
