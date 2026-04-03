(function registerFilebrowserWidgetConfiguration() {
  window.registerProjectDashboardWidgetConfigurationModule({
    render(ctx, widgetId, definition, fn) {
      if (widgetId !== "filebrowser") return null;
      const selectedProject = ctx.state.selectedProjectEntry.project;
      const directories = ctx.getFilebrowserDirectories(fn, selectedProject.path);
      const rows = directories
        .map((dir, index) => {
          const isProjectDir = index === 0;
          const label = ctx.toProjectRelativeDisplayPath(dir, selectedProject.path);
          const removeButton = isProjectDir ? "" : `<button data-remove-filebrowser-dir="${ctx.escapeHtml(dir)}">Entfernen</button>`;
          return `
            <div class="actions filebrowser-row">
              <span>${ctx.escapeHtml(label)}</span>
              ${removeButton}
            </div>
          `;
        })
        .join("");
      return `
        <h3>${ctx.escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <p>Der Projektpfad steht immer als erstes in der Liste.</p>
        <div class="actions">
          <button id="addFilebrowserDirectoryBtn">Verzeichnis hinzufuegen</button>
        </div>
        <div class="filebrowser-list">${rows}</div>
      `;
    },
    bindExtraEvents(ctx) {
      const addFilebrowserDirectoryBtn = document.getElementById("addFilebrowserDirectoryBtn");
      if (addFilebrowserDirectoryBtn) {
        addFilebrowserDirectoryBtn.addEventListener("click", async () => {
          const selectedProject = ctx.state.selectedProjectEntry.project;
          const layout = ctx.getProjectLayoutState();
          const fn = layout.widgetFunctions.filebrowser || { directories: [] };
          const startPath = selectedProject.path;
          const result = await window.dashboardApi.pickDirectory({ startPath });
          if (!result?.ok || !result.path) return;
          const picked = String(result.path).trim();
          if (!picked || picked === selectedProject.path) return;
          const merged = ctx.getFilebrowserDirectories({ directories: fn.directories || [] }, selectedProject.path);
          if (merged.includes(picked)) return;
          fn.directories = [...(Array.isArray(fn.directories) ? fn.directories : []), picked];
          layout.widgetFunctions.filebrowser = fn;
          await ctx.persistUiState();
          ctx.renderWidgetSettingsModal();
          ctx.renderDashboard();
        });
      }
      document.querySelectorAll("[data-remove-filebrowser-dir]").forEach((button) => {
        button.addEventListener("click", async () => {
          const target = button.getAttribute("data-remove-filebrowser-dir");
          if (!target) return;
          const layout = ctx.getProjectLayoutState();
          const fn = layout.widgetFunctions.filebrowser || { directories: [] };
          fn.directories = (Array.isArray(fn.directories) ? fn.directories : []).filter((dir) => dir !== target);
          layout.widgetFunctions.filebrowser = fn;
          await ctx.persistUiState();
          ctx.renderWidgetSettingsModal();
          ctx.renderDashboard();
        });
      });
    },
  });
})();
