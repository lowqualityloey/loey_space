/* ==========================================================================
   ✨ OBSIDIAN ACTIVITY HISTORY CODEBLOCK PROCESSOR PLUGIN (main.js)
   ========================================================================== */

const { Plugin } = require("obsidian");

module.exports = class ActivityHistoryPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor("ActivityHistory", (source, el, ctx) => {
      const folderPath = source.trim();
      const targetYear = new Date().getFullYear();
      
      // Get all markdown files in vault
      const files = this.app.vault.getMarkdownFiles();
      
      // Map date YYYY-MM-DD -> edit/creation count
      const activityMap = {};
      for (const f of files) {
        if (folderPath && folderPath !== "/" && !f.path.startsWith(folderPath)) continue;
        
        // Check ctime and mtime
        if (f.stat && f.stat.ctime) {
          const d = new Date(f.stat.ctime);
          if (d.getFullYear() === targetYear) {
            const key = d.toISOString().split("T")[0];
            activityMap[key] = (activityMap[key] || 0) + 2;
          }
        }
        if (f.stat && f.stat.mtime) {
          const d = new Date(f.stat.mtime);
          if (d.getFullYear() === targetYear) {
            const key = d.toISOString().split("T")[0];
            activityMap[key] = (activityMap[key] || 0) + 1;
          }
        }
      }
      
      // Render SVG Heatmap Grid container
      const container = el.createDiv({ cls: "activity-history-container" });
      
      // Year selector for HomePulse integration
      const selectDiv = container.createDiv({ cls: "selectYear" });
      const selectEl = selectDiv.createEl("select", { attr: { id: "SelectYear" } });
      const opt = selectEl.createEl("option", { value: String(targetYear), text: String(targetYear) });
      opt.selected = true;

      // SVG Contribution Grid (53 weeks x 7 days)
      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 720 110");
      svg.setAttribute("class", "activity-heatmap-svg");
      svg.style.width = "100%";
      svg.style.height = "auto";

      const cellSize = 10;
      const cellGap = 3;
      const startX = 30;
      const startY = 20;

      // Month labels
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      months.forEach((m, idx) => {
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", startX + idx * 56);
        text.setAttribute("y", 12);
        text.setAttribute("fill", "#94a3b8");
        text.setAttribute("font-size", "10");
        text.setAttribute("font-family", "sans-serif");
        text.textContent = m;
        svg.appendChild(text);
      });

      // Day labels
      const dayLabels = [{ y: 32, t: "Mon" }, { y: 58, t: "Wed" }, { y: 84, t: "Fri" }];
      dayLabels.forEach(lbl => {
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", 4);
        text.setAttribute("y", lbl.y);
        text.setAttribute("fill", "#64748b");
        text.setAttribute("font-size", "9");
        text.setAttribute("font-family", "sans-serif");
        text.textContent = lbl.t;
        svg.appendChild(text);
      });

      // Build day cells for targetYear
      const jan1 = new Date(Date.UTC(targetYear, 0, 1));
      const startDayOfWeek = (jan1.getUTCDay() + 6) % 7; // Mon=0, Sun=6

      for (let dayIdx = 0; dayIdx < 365; dayIdx++) {
        const curDate = new Date(Date.UTC(targetYear, 0, 1 + dayIdx));
        const dateStr = curDate.toISOString().split("T")[0];
        
        const totalDayIdx = dayIdx + startDayOfWeek;
        const weekCol = Math.floor(totalDayIdx / 7);
        const dayRow = totalDayIdx % 7;

        const posX = startX + weekCol * (cellSize + cellGap);
        const posY = startY + dayRow * (cellSize + cellGap);

        const count = activityMap[dateStr] || 0;
        
        let color = "#1e222d"; // empty day
        if (count >= 5) color = "#22c55e"; // bright green
        else if (count >= 3) color = "#16a34a"; // mid green
        else if (count >= 1) color = "#15803d"; // dark green

        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", posX);
        rect.setAttribute("y", posY);
        rect.setAttribute("width", cellSize);
        rect.setAttribute("height", cellSize);
        rect.setAttribute("rx", "2");
        rect.setAttribute("fill", color);
        rect.setAttribute("data-value", String(count));
        rect.setAttribute("data-date", dateStr);
        
        const title = document.createElementNS(svgNS, "title");
        title.textContent = `${dateStr}: ${count} activities`;
        rect.appendChild(title);
        
        svg.appendChild(rect);
      }

      container.appendChild(svg);
    });
  }
};
