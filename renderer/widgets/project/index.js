(function registerProjectWidget() {
  window.ProjectDashboardWidgetRenderers.project = function renderProjectWidget(ctx) {
    const selected = ctx.state.selectedProjectEntry;
    const project = selected.project;
    const layout = ctx.getProjectLayoutState();
    const fn = layout?.widgetFunctions || ctx.baseWidgetFunctionSettings();
    return `
      <p><strong>${ctx.escapeHtml(project.name)}</strong></p>
      <p>Kunde: ${ctx.escapeHtml(selected.customerName)}</p>
      <p>Projektmanager: ${ctx.escapeHtml(selected.managerName)}</p>
      ${fn.project?.showPath ? `<p>Pfad: ${ctx.escapeHtml(project.path)}</p>` : ""}
      <div class="actions">
        <button id="refreshDashboard">Aktualisieren</button>
        <button id="openGridSettingsBtn">Dashboard Settings</button>
      </div>
    `;
  };
})();
