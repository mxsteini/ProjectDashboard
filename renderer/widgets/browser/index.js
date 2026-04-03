(function registerBrowserWidget() {
  window.ProjectDashboardWidgetRenderers.browser = function renderBrowserWidget(ctx, fn) {
    const urls = ctx.state.projectData?.urls || [];
    if (urls.length === 0) {
      return `<p class="status-warn">Keine URLs gefunden.</p>`;
    }
    const buttons = urls
      .map((url, idx) => `<button data-url="${idx}">${ctx.escapeHtml(url)}</button>`)
      .join("");
    return `
      <div class="actions">${buttons}</div>
      ${fn.showSourceHint ? `<p class="meta">URLs aus .ddev/config.yaml und config/sites/**/*.yaml</p>` : ""}
    `;
  };
})();
