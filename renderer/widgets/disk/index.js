(function registerDiskWidget() {
  window.ProjectDashboardWidgetRenderers.disk = function renderDiskWidget(ctx) {
    const disk = ctx.state.projectData?.diskUsage;
    return `
      <p class="${ctx.statusClass(Boolean(disk?.ok))}">
        ${disk?.ok ? `Projektgroesse: ${ctx.escapeHtml(disk.size)}` : ctx.escapeHtml(disk?.message || "n/a")}
      </p>
    `;
  };
})();
