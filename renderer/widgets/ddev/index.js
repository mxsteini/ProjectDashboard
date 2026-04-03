(function registerDdevWidget() {
  window.ProjectDashboardWidgetRenderers.ddev = function renderDdevWidget(ctx, fn) {
    const ddev = ctx.state.projectData?.ddevStatus;
    const out = ddev?.stdout || ddev?.stderr || "Keine Ausgabe.";
    const cls = ctx.statusClass(Boolean(ddev?.ok));
    const buttons = ctx
      .normalizeDdevButtons(fn?.buttons || fn)
      .map((item) => `<button data-ddev-run="${ctx.escapeHtml(item.id)}">${ctx.escapeHtml(item.label)}</button>`)
      .join("");
    return `
      <p class="${cls}">${ddev?.ok ? "Status abrufbar" : "DDEV nicht verfuegbar oder Projekt nicht initialisiert"}</p>
      <div class="actions">${buttons || `<span class="status-warn">Keine DDEV Aktionen aktiv.</span>`}</div>
      <pre>${ctx.escapeHtml(out)}</pre>
    `;
  };
})();
