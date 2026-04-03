(function registerWidgetConfigurationDispatcher() {
  const modules = window.ProjectDashboardWidgetConfigurationModules || [];

  window.ProjectDashboardWidgetConfiguration = {
    render(ctx, widgetId, definition, fn) {
      for (const module of modules) {
        if (typeof module.render !== "function") continue;
        const content = module.render(ctx, widgetId, definition, fn);
        if (typeof content === "string") return content;
      }
      return `
        <h3>${ctx.escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <p>Keine zusaetzlichen Funktionsoptionen vorhanden.</p>
      `;
    },

    apply(ctx, widgetId, fn, layout) {
      for (const module of modules) {
        if (typeof module.apply !== "function") continue;
        const handled = module.apply(ctx, widgetId, fn, layout);
        if (handled) return;
      }
      layout.widgetFunctions[widgetId] = fn;
    },

    bindExtraEvents(ctx) {
      for (const module of modules) {
        if (typeof module.bindExtraEvents === "function") {
          module.bindExtraEvents(ctx);
        }
      }
    },
  };
})();
