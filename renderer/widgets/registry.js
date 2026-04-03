(function initWidgetRegistry() {
  if (!window.ProjectDashboardWidgetRenderers) {
    window.ProjectDashboardWidgetRenderers = {};
  }
  if (!window.ProjectDashboardWidgetConfiguration) {
    window.ProjectDashboardWidgetConfiguration = {};
  }
  if (!window.ProjectDashboardWidgetConfigurationModules) {
    window.ProjectDashboardWidgetConfigurationModules = [];
  }
  if (!window.registerProjectDashboardWidgetConfigurationModule) {
    window.registerProjectDashboardWidgetConfigurationModule = function registerModule(module) {
      window.ProjectDashboardWidgetConfigurationModules.push(module);
    };
  }
})();
