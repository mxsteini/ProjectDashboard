(function registerCommandWidget() {
  window.ProjectDashboardWidgetRenderers.command = function renderCommandWidget(ctx, widgetId, fn) {
    const buttons = ctx.normalizeCommandButtons(fn?.buttons);
    if (!buttons.length) {
      return `<p class="status-warn">Keine Befehle konfiguriert.</p>`;
    }
    const rows = buttons
      .map((item) => {
        const mode = item.runInTerminal ? "Terminal" : "Inline";
        return `
          <div class="actions npm-row">
            <button data-command-widget="${ctx.escapeHtml(widgetId)}" data-command-btn="${ctx.escapeHtml(item.id)}">${ctx.escapeHtml(item.label)}</button>
            <span class="meta">${ctx.escapeHtml(mode)} · ${ctx.escapeHtml(item.command)}</span>
          </div>
        `;
      })
      .join("");
    return `<div class="git-branch-list">${rows}</div>`;
  };
})();
