/**
 * chart.js - Custom candlestick chart renderer
 * Uses HTML Canvas. No external libraries.
 */

const CandleChart = (() => {
  const BASE_CHART_HEIGHT = 320;
  const MIN_CHART_HEIGHT = 280;

  let canvas;
  let ctx;
  let entries = [];
  let clickCallback = null;
  let candleRects = [];
  let hoveredIdx = -1;

  function init(canvasId, onCandleClick) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    clickCallback = onCandleClick;

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleHover);
    canvas.addEventListener('mouseleave', handleLeave);
  }

  function render(journalEntries) {
    if (!canvas || !ctx) return;

    entries = [...journalEntries].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (!entries.length) {
      drawEmpty();
      return;
    }

    const candles = buildCandles(entries);
    const metrics = getMetrics(entries.length);

    setCanvasSize(metrics.width, metrics.height);
    draw(candles, metrics);
  }

  function getMetrics(entryCount) {
    const parentWidth = canvas.parentElement?.clientWidth || window.innerWidth || 600;
    const viewportWidth = Math.min(window.innerWidth || parentWidth, parentWidth);

    const mobile = viewportWidth <= 430;
    const compact = viewportWidth <= 375;

    const candleWidth = compact ? 20 : mobile ? 22 : 28;
    const candleGap = compact ? 12 : mobile ? 14 : 18;

    const padding = {
      top: mobile ? 20 : 30,
      right: mobile ? 12 : 20,
      bottom: mobile ? 56 : 64,
      left: mobile ? 46 : 60,
    };

    const bodyWidth = entryCount * (candleWidth + candleGap) + candleGap;
    const width = Math.max(parentWidth, bodyWidth + padding.left + padding.right);
    const height = Math.max(
      MIN_CHART_HEIGHT,
      mobile ? BASE_CHART_HEIGHT - 20 : BASE_CHART_HEIGHT
    );

    return {
      width,
      height,
      candleWidth,
      candleGap,
      wickWidth: mobile ? 2 : 2,
      padding,
      dateFont: mobile ? '10px "JetBrains Mono", monospace' : '11px "JetBrains Mono", monospace',
      axisFont: mobile ? '10px "JetBrains Mono", monospace' : '11px "JetBrains Mono", monospace',
      labelOffsetY: mobile ? 15 : 18,
    };
  }

  function setCanvasSize(cssWidth, cssHeight) {
    const dpr = Math.max(window.devicePixelRatio || 1, 1);

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildCandles(sortedEntries) {
    let currentValue = 100;

    return sortedEntries.map((entry) => {
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

  function draw(candles, metrics) {
    const { width, height, padding, candleWidth, candleGap, wickWidth, dateFont, axisFont, labelOffsetY } = metrics;

    ctx.clearRect(0, 0, width, height);
    candleRects = [];

    const allValues = candles.flatMap((candle) => [candle.high, candle.low]);
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const valueRange = Math.max(maxVal - minVal, 10);

    const chartHeight = height - padding.top - padding.bottom;

    const toY = (value) => {
      return padding.top + chartHeight - ((value - minVal) / valueRange) * chartHeight;
    };

    drawGrid(minVal, maxVal, toY, metrics);

    candles.forEach((candle, index) => {
      const x = padding.left + index * (candleWidth + candleGap) + candleGap / 2;
      const isGreen = candle.entry.type === 'green';

      const candleColor = isGreen ? cssVar('--candle-green') : cssVar('--candle-red');
      const shadowColor = isGreen ? cssVar('--candle-green-shadow') : cssVar('--candle-red-shadow');

      const openY = toY(candle.open);
      const closeY = toY(candle.close);
      const highY = toY(candle.high);
      const lowY = toY(candle.low);

      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(Math.abs(closeY - openY), 2);

      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 6;

      ctx.beginPath();
      ctx.strokeStyle = candleColor;
      ctx.lineWidth = wickWidth;
      ctx.moveTo(x + candleWidth / 2, highY);
      ctx.lineTo(x + candleWidth / 2, lowY);
      ctx.stroke();

      ctx.fillStyle = candleColor;
      ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);

      ctx.shadowBlur = 0;

      const dateStr = formatDate(candle.entry.date);
      ctx.save();
      ctx.fillStyle = cssVar('--text-muted');
      ctx.font = dateFont;
      ctx.textAlign = 'center';
      ctx.translate(x + candleWidth / 2, height - padding.bottom + labelOffsetY);
      ctx.rotate(Math.PI / 4);
      ctx.fillText(dateStr, 0, 0);
      ctx.restore();

      candleRects.push({
        x,
        y: bodyTop,
        w: candleWidth,
        h: bodyHeight,
        wickTop: highY,
        wickBottom: lowY,
        candle,
      });
    });

    drawYAxis(minVal, maxVal, toY, metrics);
  }

  function drawGrid(minVal, maxVal, toY, metrics) {
    const { width, padding } = metrics;
    const steps = 5;

    ctx.save();
    ctx.strokeStyle = cssVar('--grid-color');
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);

    for (let i = 0; i <= steps; i += 1) {
      const value = minVal + (i / steps) * (maxVal - minVal);
      const y = toY(value);

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawYAxis(minVal, maxVal, toY, metrics) {
    const { padding, axisFont } = metrics;
    const steps = 5;

    ctx.save();
    ctx.fillStyle = cssVar('--text-muted');
    ctx.font = axisFont;
    ctx.textAlign = 'right';

    for (let i = 0; i <= steps; i += 1) {
      const value = minVal + (i / steps) * (maxVal - minVal);
      const y = toY(value);
      ctx.fillText(value.toFixed(1), padding.left - 8, y + 3);
    }

    ctx.restore();
  }

  function drawEmpty() {
    const parentWidth = canvas.parentElement?.clientWidth || window.innerWidth || 600;
    const width = parentWidth;
    const height = Math.max(MIN_CHART_HEIGHT, BASE_CHART_HEIGHT - 20);

    setCanvasSize(width, height);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = cssVar('--text-muted');
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('No entries yet. Add your first day candle.', width / 2, height / 2);
  }

  function pointerToCanvasCoords(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width ? canvas.width / rect.width : 1;
    const scaleY = rect.height ? canvas.height / rect.height : 1;

    return {
      x: (event.clientX - rect.left) * scaleX / (window.devicePixelRatio || 1),
      y: (event.clientY - rect.top) * scaleY / (window.devicePixelRatio || 1),
    };
  }

  function findHoveredCandle(x, y) {
    for (let i = 0; i < candleRects.length; i += 1) {
      const rect = candleRects[i];
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.wickTop && y <= rect.wickBottom) {
        return i;
      }
    }
    return -1;
  }

  function handleClick(event) {
    const coords = pointerToCanvasCoords(event);
    const idx = findHoveredCandle(coords.x, coords.y);

    if (idx >= 0 && clickCallback) {
      clickCallback(candleRects[idx].candle.entry);
    }
  }

  function handleHover(event) {
    const coords = pointerToCanvasCoords(event);
    const idx = findHoveredCandle(coords.x, coords.y);

    if (idx !== hoveredIdx) {
      hoveredIdx = idx;
      canvas.style.cursor = idx >= 0 ? 'pointer' : 'default';
    }
  }

  function handleLeave() {
    hoveredIdx = -1;
    canvas.style.cursor = 'default';
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${month}/${day}`;
  }

  return { init, render };
})();
