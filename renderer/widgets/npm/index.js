(function registerNpmWidget() {
  window.ProjectDashboardWidgetRenderers.npm = function renderNpmWidget(ctx, fn) {
    const buttons = ctx.normalizeNpmButtons(fn?.buttons);
    const rows = buttons
      .map((item) => {
        const mode = item.runInTerminal ? "Terminal" : "Inline";
        return `
          <div class="actions npm-row">
            <button data-npm-run="${ctx.escapeHtml(item.id)}">${ctx.escapeHtml(item.label)}</button>
            <span class="meta">${ctx.escapeHtml(mode)} · ${ctx.escapeHtml(item.command)}</span>
          </div>
        `;
      })
      .join("");
    return `<div class="git-branch-list">${rows}</div>`;
  };
})();
