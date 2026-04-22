/**
 * chart.js — Custom candlestick chart renderer
 * Uses HTML Canvas. No external libraries.
 *
 * Logic:
 *   - Start value: 100
 *   - green day: close = open + score
 *   - red day:   close = open - score
 *   - wick:      high = Math.max(open, close) + score * 0.3
 *               low  = Math.min(open, close) - score * 0.3
 */

const CandleChart = (() => {
  // ── Config ─────────────────────────────────────────────────────────────────
  const CANDLE_WIDTH = 28;
  const CANDLE_GAP = 18;
  const WICK_WIDTH = 2;
  const CHART_PADDING = { top: 30, right: 20, bottom: 60, left: 60 };
  const CHART_HEIGHT = 320;
  const DATE_FONT = '11px "JetBrains Mono", monospace';
  const AXIS_FONT = '11px "JetBrains Mono", monospace';

  let canvas, ctx, entries = [], clickCallback = null;
  let candleRects = []; // stores hit-test rects

  // ── Public API ─────────────────────────────────────────────────────────────

  function init(canvasId, onCandleClick) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    clickCallback = onCandleClick;
    canvas.addEventListener('click', _handleClick);
    canvas.addEventListener('mousemove', _handleHover);
    canvas.addEventListener('mouseleave', _handleLeave);
  }

  function render(journalEntries) {
    if (!canvas || !ctx) return;

    // Sort entries by date ascending
    entries = [...journalEntries].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    if (entries.length === 0) {
      _drawEmpty();
      return;
    }

    // Build candle data
    const candles = _buildCandles(entries);
    const totalWidth = entries.length * (CANDLE_WIDTH + CANDLE_GAP) + CHART_PADDING.left + CHART_PADDING.right;
    canvas.width = Math.max(totalWidth, canvas.parentElement.clientWidth || 600);
    canvas.height = CHART_HEIGHT;

    _draw(candles);
  }

  // ── Private: build OHLC from entries ──────────────────────────────────────

  function _buildCandles(entries) {
    let currentValue = 100;
    return entries.map((entry) => {
      const open = currentValue;
      const delta = entry.type === 'green' ? entry.score : -entry.score;
      const close = open + delta;
      const wickExt = entry.score * 0.3;
      const high = Math.max(open, close) + wickExt;
      const low = Math.min(open, close) - wickExt;
      currentValue = close;
      return { open, high, low, close, entry };
    });
  }

  // ── Private: draw ──────────────────────────────────────────────────────────

  function _draw(candles) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    candleRects = [];

    const allValues = candles.flatMap((c) => [c.high, c.low]);
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const valueRange = maxVal - minVal || 10;

    const chartH = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
    const chartW = canvas.width - CHART_PADDING.left - CHART_PADDING.right;

    const toY = (v) =>
      CHART_PADDING.top + chartH - ((v - minVal) / valueRange) * chartH;

    // ── Background grid ────────────────────────────────────────────────────
    _drawGrid(minVal, maxVal, chartH, toY);

    // ── Candles ────────────────────────────────────────────────────────────
    candles.forEach((candle, i) => {
      const x = CHART_PADDING.left + i * (CANDLE_WIDTH + CANDLE_GAP) + CANDLE_GAP / 2;
      const isGreen = candle.entry.type === 'green';
      const color = isGreen ? _cssVar('--candle-green') : _cssVar('--candle-red');
      const shadowColor = isGreen ? _cssVar('--candle-green-shadow') : _cssVar('--candle-red-shadow');

      const openY = toY(candle.open);
      const closeY = toY(candle.close);
      const highY = toY(candle.high);
      const lowY = toY(candle.low);

      const bodyTop = Math.min(openY, closeY);
      const bodyH = Math.max(Math.abs(closeY - openY), 2);

      // Glow shadow
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 6;

      // Wick
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = WICK_WIDTH;
      ctx.moveTo(x + CANDLE_WIDTH / 2, highY);
      ctx.lineTo(x + CANDLE_WIDTH / 2, lowY);
      ctx.stroke();

      // Body
      ctx.fillStyle = color;
      ctx.fillRect(x, bodyTop, CANDLE_WIDTH, bodyH);

      ctx.shadowBlur = 0;

      // Date label
      const dateStr = _formatDate(candle.entry.date);
      ctx.save();
      ctx.fillStyle = _cssVar('--text-muted');
      ctx.font = DATE_FONT;
      ctx.textAlign = 'center';
      ctx.translate(x + CANDLE_WIDTH / 2, CHART_HEIGHT - CHART_PADDING.bottom + 18);
      ctx.rotate(Math.PI / 4);
      ctx.fillText(dateStr, 0, 0);
      ctx.restore();

      // Store hit rect
      candleRects.push({ x, y: bodyTop, w: CANDLE_WIDTH, h: bodyH, wickTop: highY, wickBottom: lowY, candle });
    });

    // Y-axis labels
    _drawYAxis(minVal, maxVal, toY);
  }

  function _drawGrid(minVal, maxVal, chartH, toY) {
    const steps = 5;
    ctx.save();
    ctx.strokeStyle = _cssVar('--grid-color');
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= steps; i++) {
      const v = minVal + (i / steps) * (maxVal - minVal);
      const y = toY(v);
      ctx.beginPath();
      ctx.moveTo(CHART_PADDING.left, y);
      ctx.lineTo(canvas.width - CHART_PADDING.right, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  function _drawYAxis(minVal, maxVal, toY) {
    const steps = 5;
    ctx.save();
    ctx.fillStyle = _cssVar('--text-muted');
    ctx.font = AXIS_FONT;
    ctx.textAlign = 'right';
    for (let i = 0; i <= steps; i++) {
      const v = minVal + (i / steps) * (maxVal - minVal);
      const y = toY(v);
      ctx.fillText(v.toFixed(1), CHART_PADDING.left - 8, y + 4);
    }
    ctx.restore();
  }

  function _drawEmpty() {
    canvas.width = canvas.parentElement.clientWidth || 600;
    canvas.height = CHART_HEIGHT;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = _cssVar('--text-muted');
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('No entries yet. Add your first day candle.', canvas.width / 2, CHART_HEIGHT / 2);
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  function _handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Scale for device pixel ratio
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = mx * scaleX;
    const cy = my * scaleY;

    for (const r of candleRects) {
      // Hit test: body + wick area
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.wickTop && cy <= r.wickBottom) {
        if (clickCallback) clickCallback(r.candle.entry);
        return;
      }
    }
  }

  let hoveredIdx = -1;
  function _handleHover(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    let found = -1;
    for (let i = 0; i < candleRects.length; i++) {
      const r = candleRects[i];
      if (mx >= r.x && mx <= r.x + r.w && my >= r.wickTop && my <= r.wickBottom) {
        found = i;
        break;
      }
    }

    if (found !== hoveredIdx) {
      hoveredIdx = found;
      canvas.style.cursor = found >= 0 ? 'pointer' : 'default';
    }
  }

  function _handleLeave() {
    hoveredIdx = -1;
    canvas.style.cursor = 'default';
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
  }

  function _formatDate(dateStr) {
    const d = new Date(dateStr);
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = d.getUTCDate().toString().padStart(2, '0');
    return `${month}/${day}`;
  }

  return { init, render };
})();
