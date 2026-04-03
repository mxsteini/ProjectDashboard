(function registerGitWidget() {
  window.ProjectDashboardWidgetRenderers.git = function renderGitWidget(ctx, fn) {
    const git = ctx.state.projectData?.gitInfo;
    const cls = ctx.statusClass(Boolean(git?.ok));
    if (!git?.ok) {
      return `<p class="${cls}">${ctx.escapeHtml(git?.message || "Kein Git-Repository.")}</p>`;
    }

    const branches = Array.isArray(git.branches) ? git.branches : [];
    if (!branches.length) {
      return `<p class="status-warn">Keine lokalen Branches gefunden.</p>`;
    }

    const rows = branches
      .map((branch) => {
        const isCurrent = branch === git.currentBranch;
        const label = fn.showCurrentBranch && isCurrent ? `${branch} (aktiv)` : branch;
        const checkout = fn.allowCheckout
          ? `
            <button class="git-icon-btn" data-git-checkout="${ctx.escapeHtml(branch)}" ${isCurrent ? "disabled" : ""} aria-label="Branch auschecken" title="Checkout">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M10 4a1 1 0 0 1 1 1v5h7a1 1 0 1 1 0 2h-7v5a1 1 0 0 1-1.7.7l-6-6a1 1 0 0 1 0-1.4l6-6A1 1 0 0 1 10 4Z"/>
              </svg>
            </button>
          `
          : "";
        const remove = fn.allowDelete !== false
          ? `
            <button class="git-icon-btn danger" data-git-delete="${ctx.escapeHtml(branch)}" ${isCurrent ? "disabled" : ""} aria-label="Branch loeschen" title="Delete">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 3a2 2 0 0 0-2 2v1H4a1 1 0 1 0 0 2h1l1 11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-11h1a1 1 0 1 0 0-2h-3V5a2 2 0 0 0-2-2H9Zm0 3V5h6v1H9Zm1 4a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z"/>
              </svg>
            </button>
          `
          : "";
        return `
          <div class="actions git-branch-row">
            ${checkout}${remove}
            <span class="${isCurrent ? "status-ok" : ""}">${ctx.escapeHtml(label)}</span>
          </div>
        `;
      })
      .join("");

    return `
      <p class="${cls}">Lokale Branches</p>
      <div class="git-branch-list">${rows}</div>
    `;
  };
})();
