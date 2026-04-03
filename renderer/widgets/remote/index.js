(function registerRemoteWidget() {
  window.ProjectDashboardWidgetRenderers.remote = function renderRemoteWidget(ctx, widgetId, fn) {
    const sshFn = ctx.normalizeSshWidgetSettings(fn);
    const allHosts = Array.isArray(ctx.state.projectData?.sshHosts) ? ctx.state.projectData.sshHosts : [];
    if (!allHosts.length) {
      return `<p class="status-warn">Keine Hosts in ~/.ssh/config gefunden.</p>`;
    }

    const hostMap = new Map(allHosts.map((entry) => [entry.alias, entry]));
    const selected = sshFn.selectedHosts
      .map((alias) => hostMap.get(alias))
      .filter(Boolean);
    if (!selected.length) {
      return `<p class="status-warn">Keine Hosts ausgewaehlt.</p>`;
    }

    const buttons = selected
      .map((entry) => {
        const subtitle = [entry.user, entry.hostname].filter(Boolean).join("@");
        return `
          <div class="actions npm-row">
            <button data-ssh-run="${ctx.escapeHtml(widgetId)}" data-ssh-host="${ctx.escapeHtml(entry.alias)}">${ctx.escapeHtml(entry.alias)}</button>
            ${subtitle ? `<span class="meta">${ctx.escapeHtml(subtitle)}</span>` : ""}
          </div>
        `;
      })
      .join("");

    return `
      <div class="git-branch-list">${buttons}</div>
      ${sshFn.showHint ? `<p class="meta">Hinweis: Passwoerter werden nicht automatisiert uebergeben.</p>` : ""}
    `;
  };
})();
