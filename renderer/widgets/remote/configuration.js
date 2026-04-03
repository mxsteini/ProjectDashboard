(function registerRemoteWidgetConfiguration() {
  window.registerProjectDashboardWidgetConfigurationModule({
    render(ctx, widgetId, definition, fn) {
      if (!(widgetId === "ssh" || ctx.isSshWidgetId(widgetId))) return null;
      const sshFn = ctx.normalizeSshWidgetSettings(fn);
      const allHosts = Array.isArray(ctx.state.projectData?.sshHosts) ? ctx.state.projectData.sshHosts : [];
      const rows = allHosts.length
        ? allHosts
            .map((entry) => {
              const alias = String(entry.alias || "").trim();
              if (!alias) return "";
              const details = [entry.user ? `user: ${entry.user}` : "", entry.hostname ? `host: ${entry.hostname}` : "", entry.port ? `port: ${entry.port}` : ""]
                .filter(Boolean)
                .join(" · ");
              const checked = sshFn.selectedHosts.includes(alias) ? "checked" : "";
              const searchable = `${alias} ${entry.user || ""} ${entry.hostname || ""} ${entry.port || ""}`.toLowerCase();
              return `
                <label class="config-block" data-ssh-host-row="${ctx.escapeHtml(searchable)}">
                  <input type="checkbox" data-ssh-select-host="${ctx.escapeHtml(alias)}" ${checked} />
                  <strong>${ctx.escapeHtml(alias)}</strong>
                  ${details ? `<span class="meta">${ctx.escapeHtml(details)}</span>` : ""}
                </label>
              `;
            })
            .join("")
        : `<p class="status-warn">Keine Hosts in ~/.ssh/config gefunden.</p>`;
      return `
        <h3>${ctx.escapeHtml(definition?.title || widgetId)} Funktionen</h3>
        <label>Widget Titel</label>
        <input id="sshWidgetTitle" value="${ctx.escapeHtml(sshFn.title)}" placeholder="Remote-Widget" />
        <label><input id="sshShowHint" type="checkbox" ${sshFn.showHint ? "checked" : ""} /> Hinweistext anzeigen</label>
        <label>Remote Kommando</label>
        <input id="sshCommandTemplate" value="${ctx.escapeHtml(sshFn.commandTemplate)}" placeholder="ssh {host}" />
        <label><input id="sshRunInTerminal" type="checkbox" ${sshFn.runInTerminal ? "checked" : ""} /> Im Terminal ausfuehren</label>
        <p class="meta">Platzhalter: {host}, {user}, {hostname}, {port}, {projectFolder}</p>
        <label>Hosts durchsuchen</label>
        <input id="sshHostSearchInput" placeholder="Alias, User, Hostname..." />
        <div class="filebrowser-list">${rows}</div>
        <div class="actions"><button id="saveWidgetSettingsBtn" data-widget-id="${ctx.escapeHtml(widgetId)}">Einstellungen speichern</button></div>
      `;
    },
    apply(ctx, widgetId, fn, layout) {
      if (!(widgetId === "ssh" || ctx.isSshWidgetId(widgetId))) return false;
      const sshFn = ctx.normalizeSshWidgetSettings(fn);
      const selectedHosts = Array.from(document.querySelectorAll("[data-ssh-select-host]"))
        .filter((node) => node.checked)
        .map((node) => String(node.getAttribute("data-ssh-select-host") || "").trim())
        .filter(Boolean);
      sshFn.title = String(document.getElementById("sshWidgetTitle")?.value || "").trim() || "Remote-Widget";
      sshFn.showHint = Boolean(document.getElementById("sshShowHint")?.checked);
      sshFn.selectedHosts = selectedHosts;
      sshFn.commandTemplate = String(document.getElementById("sshCommandTemplate")?.value || "").trim() || "ssh {host}";
      sshFn.runInTerminal = Boolean(document.getElementById("sshRunInTerminal")?.checked);
      layout.widgetFunctions[widgetId] = sshFn;
      return true;
    },
    bindExtraEvents() {
      const sshHostSearchInput = document.getElementById("sshHostSearchInput");
      if (sshHostSearchInput) {
        sshHostSearchInput.addEventListener("input", () => {
          const query = String(sshHostSearchInput.value || "").trim().toLowerCase();
          document.querySelectorAll("[data-ssh-host-row]").forEach((row) => {
            const haystack = String(row.getAttribute("data-ssh-host-row") || "");
            row.style.display = !query || haystack.includes(query) ? "" : "none";
          });
        });
      }
    },
  });
})();
