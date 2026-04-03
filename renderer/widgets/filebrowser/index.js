(function registerFilebrowserWidget() {
  window.ProjectDashboardWidgetRenderers.filebrowser = function renderFilebrowserWidget(ctx, fn) {
    const selectedProject = ctx.state.selectedProjectEntry.project;
    const directories = ctx.getFilebrowserDirectories(fn, selectedProject.path);
    if (!directories.length) {
      return `<p class="status-warn">Keine Verzeichnisse konfiguriert.</p>`;
    }

    const rows = directories
      .map((dir) => {
        const label = ctx.toProjectRelativeDisplayPath(dir, selectedProject.path);
        return `
          <div class="filebrowser-row">
            <button class="filebrowser-open-icon-btn" data-open-path="${ctx.escapeHtml(dir)}" aria-label="Verzeichnis oeffnen" title="Verzeichnis oeffnen">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M10 4a2 2 0 0 1 1.4.6l1.2 1.2c.2.2.5.2.7.2H18a2 2 0 0 1 2 2v1h-2V8h-4.7a3 3 0 0 1-2.1-.9L10 5.9V6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h5v2H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4h4Zm8.7 8.3a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-2.6 2.6a1 1 0 1 1-1.4-1.4l.9-.9H14a1 1 0 1 1 0-2h5.6l-.9-.9a1 1 0 0 1 0-1.4Z"/>
              </svg>
            </button>
            <span class="filebrowser-path" title="${ctx.escapeHtml(label)}">${ctx.escapeHtml(label)}</span>
          </div>
        `;
      })
      .join("");

    return `<div class="filebrowser-list">${rows}</div>`;
  };
})();
