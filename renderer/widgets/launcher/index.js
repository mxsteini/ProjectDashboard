(function registerLauncherWidget() {
  window.ProjectDashboardWidgetRenderers.launcher = function renderLauncherWidget(_ctx, fn) {
    const buttons = [];
    if (fn.allowCursor) buttons.push(`<button data-launcher="cursor">Cursor</button>`);
    if (fn.allowVscode) buttons.push(`<button data-launcher="vscode">VS Code</button>`);
    if (fn.allowExplorer) buttons.push(`<button data-launcher="explorer">Explorer</button>`);
    if (fn.allowTerminal) buttons.push(`<button data-launcher="terminal">Terminal</button>`);
    return `
      <div class="actions">${buttons.join("") || `<span class="status-warn">Keine Launcher Aktionen aktiv.</span>`}</div>
      <p class="meta">Startet Programme im Projektkontext.</p>
    `;
  };
})();
