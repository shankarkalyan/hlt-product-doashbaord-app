import { useEffect, useRef } from "react";
import * as d3 from "d3";

const TECH_COLORS = {
  TERRAFORM: "#3b82f6",
  ECS: "#10b981",
  LAMBDA: "#f97316",
  EKS: "#8b5cf6",
  GKP: "#ec4899",
  GAP: "#14b8a6",
  GLUE: "#f59e0b",
  VSI: "#6366f1",
  AWS: "#ef4444",
};
const FALLBACK = ["#0ea5e9", "#84cc16", "#a855f7", "#f43f5e", "#06b6d4"];

function colorFor(deployType, idx) {
  return TECH_COLORS[deployType] || FALLBACK[idx % FALLBACK.length];
}

const STATUS_COLORS = {
  success: "#ffffff",
  ack: "#fde047",
  failed: "#fda4af",
};

export default function TechnologyHeatmap({ data, onTechClick }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!data) return;
    const techs = data.technologies;

    const width = 960;
    const height = 520;

    const root = d3.select(ref.current);
    root.selectAll("*").remove();

    const tooltip = root
      .append("div")
      .attr("class", "heatmap-tooltip")
      .style("opacity", 0);

    const svg = root
      .append("svg")
      .attr("width", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const hierarchy = d3
      .hierarchy({ children: techs })
      .sum((d) => d.count)
      .sort((a, b) => b.value - a.value);

    d3.treemap().size([width, height]).paddingInner(8).round(true)(hierarchy);

    const total = data.summary?.total_deployments || d3.sum(techs, (t) => t.count);

    const tile = svg
      .selectAll("g.tile")
      .data(hierarchy.leaves())
      .enter()
      .append("g")
      .attr("class", "tile")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`)
      .style("cursor", "pointer")
      .on("mouseover", function (_, d) {
        d3.select(this)
          .select("rect.bg")
          .attr("stroke", "#0f172a")
          .attr("stroke-width", 3);
        const t = d.data;
        tooltip.style("opacity", 1).html(
          `<strong>${t.deploy_type}</strong> — ${t.count} deploy${
            t.count === 1 ? "" : "s"
          } (${t.percent}% of total)<br/>
           Success rate: <strong>${t.success_rate}%</strong><br/>
           ✓ ${t.successful} successful · ⚠ ${t.acknowledged} ack · ✕ ${t.failed} failed`
        );
      })
      .on("mousemove", function (event) {
        const [mx, my] = d3.pointer(event, ref.current);
        tooltip.style("left", `${mx + 14}px`).style("top", `${my + 14}px`);
      })
      .on("mouseout", function () {
        d3.select(this)
          .select("rect.bg")
          .attr("stroke", "rgba(255,255,255,0.4)")
          .attr("stroke-width", 1);
        tooltip.style("opacity", 0);
      })
      .on("click", (_, d) => onTechClick && onTechClick(d.data.deploy_type));

    tile
      .append("rect")
      .attr("class", "bg")
      .attr("width", (d) => d.x1 - d.x0)
      .attr("height", (d) => d.y1 - d.y0)
      .attr("rx", 10)
      .attr("fill", (d, i) => colorFor(d.data.deploy_type, i))
      .attr("stroke", "rgba(255,255,255,0.35)")
      .attr("stroke-width", 1)
      .attr("shape-rendering", "geometricPrecision");

    // ----- Tile content -----
    tile.each(function (d) {
      const g = d3.select(this);
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      const t = d.data;

      const showPercent = h >= 90 && w >= 90;
      const showSuccessRate = h >= 130 && w >= 120;
      const showStatus = h >= 150 && w >= 140;

      const stripHeight = showStatus ? 32 : 0;
      const contentH = h - stripHeight;

      // ---- Width-aware font sizing ----
      // Glyph width ≈ fontSize * factor. Digits (with tnum) are ~0.62, bold caps ~0.6,
      // mixed text ~0.55. We size each text so it fits in ~80% of tile width.

      const countText = String(t.count);
      const countWidthCap = (w * 0.78) / (countText.length * 0.62);
      const countHeightCap = Math.min(w, contentH) / 2.4;
      const countSize = Math.min(
        72,
        Math.max(18, Math.min(countWidthCap, countHeightCap))
      );

      const labelText = t.deploy_type;
      const labelWidthCap = (w * 0.86) / (labelText.length * 0.6);
      const labelHeightCap = Math.min(20, Math.max(12, w / 9));
      const labelSize = Math.max(10, Math.min(labelHeightCap, labelWidthCap));

      // ---- Label (top) ----
      g.append("text")
        .attr("class", "tile-label")
        .attr("x", w / 2)
        .attr("y", Math.max(22, contentH * 0.18))
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "#fff")
        .attr("font-weight", 800)
        .attr("font-size", labelSize)
        .attr("letter-spacing", "0.8")
        .style("text-rendering", "geometricPrecision")
        .style("paint-order", "stroke")
        .attr("stroke", "rgba(0,0,0,0.42)")
        .attr("stroke-width", 0.9)
        .attr("stroke-linejoin", "round")
        .text(t.deploy_type);

      // ---- Count (center) ----
      const centerY = contentH / 2 + (showPercent ? -2 : 6);
      g.append("text")
        .attr("class", "tile-count")
        .attr("x", w / 2)
        .attr("y", centerY)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("fill", "#fff")
        .attr("font-weight", 900)
        .attr("font-size", countSize)
        .attr("letter-spacing", "-1")
        .style("text-rendering", "geometricPrecision")
        .style("font-feature-settings", "'tnum' 1, 'lnum' 1")
        .style("paint-order", "stroke")
        .attr("stroke", "rgba(0,0,0,0.45)")
        .attr("stroke-width", 1.6)
        .attr("stroke-linejoin", "round")
        .text(t.count);

      // ---- Percent (below count) ----
      if (showPercent) {
        const percentText = `${t.percent}% of total`;
        const percentTarget = Math.max(11, labelSize * 0.72);
        const percentWidthCap = (w * 0.86) / (percentText.length * 0.55);
        const percentSize = Math.max(
          9,
          Math.min(percentTarget, percentWidthCap)
        );
        g.append("text")
          .attr("class", "tile-percent")
          .attr("x", w / 2)
          .attr("y", centerY + countSize * 0.62 + 4)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .attr("fill", "#fff")
          .attr("font-weight", 700)
          .attr("font-size", percentSize)
          .style("text-rendering", "geometricPrecision")
          .style("font-feature-settings", "'tnum' 1, 'lnum' 1")
          .style("paint-order", "stroke")
          .attr("stroke", "rgba(0,0,0,0.4)")
          .attr("stroke-width", 0.8)
          .attr("stroke-linejoin", "round")
          .text(percentText);
      }

      // ---- Success rate ----
      if (showSuccessRate) {
        const rateText = `SUCCESS RATE ${t.success_rate}%`;
        const rateWidthCap = (w * 0.9) / (rateText.length * 0.55);
        const rateSize = Math.max(9, Math.min(11, rateWidthCap));
        const rateY = centerY + countSize * 0.62 + Math.max(20, labelSize * 1.1);
        g.append("text")
          .attr("class", "tile-rate")
          .attr("x", w / 2)
          .attr("y", rateY)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .attr("fill", "#fff")
          .attr("font-size", rateSize)
          .attr("font-weight", 700)
          .attr("letter-spacing", "0.8")
          .style("text-rendering", "geometricPrecision")
          .style("paint-order", "stroke")
          .attr("stroke", "rgba(0,0,0,0.4)")
          .attr("stroke-width", 0.7)
          .attr("stroke-linejoin", "round")
          .text(rateText);
      }

      // ---- Status strip (bottom) ----
      if (showStatus) {
        const stripY = h - stripHeight;
        // Dark glass background for high contrast
        g.append("path")
          .attr(
            "d",
            `M0,${stripY} h${w} v${stripHeight - 10} a10,10 0 0 1 -10,10 h${
              -(w - 20)
            } a10,10 0 0 1 -10,-10 z`
          )
          .attr("fill", "rgba(0,0,0,0.28)")
          .attr("pointer-events", "none");

        const items = [
          { key: "success", value: t.successful, color: STATUS_COLORS.success, sym: "✓" },
          { key: "ack", value: t.acknowledged, color: STATUS_COLORS.ack, sym: "⚠" },
          { key: "failed", value: t.failed, color: STATUS_COLORS.failed, sym: "✕" },
        ];
        const cellW = w / items.length;
        const rowY = stripY + stripHeight / 2;
        items.forEach((it, i) => {
          const cx = i * cellW + cellW / 2;
          g.append("text")
            .attr("x", cx)
            .attr("y", rowY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("fill", it.color)
            .attr("font-size", 13)
            .attr("font-weight", 800)
            .style("text-rendering", "geometricPrecision")
            .style("font-feature-settings", "'tnum' 1")
            .text(`${it.sym} ${it.value}`);
        });
      }
    });
  }, [data, onTechClick]);

  return <div className="heatmap" ref={ref}></div>;
}
