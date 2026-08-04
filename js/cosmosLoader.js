/**
 * Stellar Panel — Cosmos Loading Screen (Black Hole / Accretion Disk)
 * Self-contained Canvas 2D loading animation with depth-sorted occlusion,
 * 3D tilted accretion disk, and graceful unmounting.
 */

(function () {
  'use strict';

  var MIN_DISPLAY_TIME = 1200; // ms minimum display time
  var MAX_TIMEOUT = 3500;     // safety fallback timeout ms
  var TRANSITION_TIME = 700;   // fade out duration ms

  var startTime = Date.now();
  var animId = null;
  var isDestroyed = false;

  function initCosmosLoader() {
    var overlay = document.getElementById('cosmos-loader');
    var canvas = document.getElementById('cosmos-loader-canvas');
    if (!overlay || !canvas) return;

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var width = 0;
    var height = 0;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    // Color palette aligned with Stellar Panel design tokens
    var colors = [
      '#E7B860', // --accent (gold)
      '#F0C878', // --nebula-hi (warm gold)
      '#F5F0E4', // --star (starlight)
      '#F6D48A', // --rust-hi (bright gold)
      '#8FA6FF'  // --blue-hi (subtle cyan/blue cosmos accent)
    ];

    // Particle construction
    var particleCount = width < 600 ? 180 : 320;
    var particles = [];

    var tiltX = 22 * (Math.PI / 180); // 22 deg disk tilt
    var rollZ = 12 * (Math.PI / 180); // 12 deg sideways roll

    var cosTx = Math.cos(tiltX), sinTx = Math.sin(tiltX);
    var cosRz = Math.cos(rollZ), sinRz = Math.sin(rollZ);

    for (var i = 0; i < particleCount; i++) {
      var minR = Math.min(width, height) * 0.12;
      var maxR = Math.min(width, height) * 0.42;
      // Exponential distribution towards inner disk
      var radius = minR + Math.pow(Math.random(), 1.8) * (maxR - minR);
      var angle = Math.random() * Math.PI * 2;
      var speed = (0.003 + (1 - radius / maxR) * 0.009) * (Math.random() < 0.5 ? 1 : -1);
      
      particles.push({
        radius: radius,
        baseRadius: radius,
        angle: angle,
        speed: speed,
        size: Math.random() * 1.8 + 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        yOffset: (Math.random() - 0.5) * 12,
        alpha: Math.random() * 0.7 + 0.3,
        inflowRate: 0.015 + Math.random() * 0.03
      });
    }

    function draw() {
      if (isDestroyed) return;

      var cx = width / 2;
      var cy = height / 2;
      var coreRadius = Math.max(22, Math.min(width, height) * 0.055);

      // Trailing fade effect on dark navy background (#07070F)
      ctx.fillStyle = 'rgba(7, 7, 15, 0.22)';
      ctx.fillRect(0, 0, width, height);

      // Core ambient glow
      var auraGrad = ctx.createRadialGradient(cx, cy, coreRadius * 0.2, cx, cy, coreRadius * 4.5);
      auraGrad.addColorStop(0, 'rgba(231, 184, 96, 0.4)');
      auraGrad.addColorStop(0.25, 'rgba(240, 200, 120, 0.18)');
      auraGrad.addColorStop(0.55, 'rgba(108, 140, 255, 0.08)');
      auraGrad.addColorStop(1, 'rgba(7, 7, 15, 0)');

      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius * 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Transform 3D particles & calculate depth sorting
      var projected = [];

      for (var p = 0; p < particles.length; p++) {
        var pt = particles[p];

        // Orbit update
        pt.angle += pt.speed;
        
        // Gentle inflow spiral
        pt.radius -= pt.inflowRate;
        if (pt.radius < coreRadius * 0.8) {
          pt.radius = pt.baseRadius * (0.85 + Math.random() * 0.3);
        }

        // 3D Disk projection
        var x0 = pt.radius * Math.cos(pt.angle);
        var z0 = pt.radius * Math.sin(pt.angle);
        var y0 = pt.yOffset;

        // X tilt
        var y1 = y0 * cosTx - z0 * sinTx;
        var z1 = y0 * sinTx + z0 * cosTx;

        // Z roll
        var x2 = x0 * cosRz - y1 * sinRz;
        var y2 = x0 * sinRz + y1 * cosRz;
        var z2 = z1;

        var px = cx + x2;
        var py = cy + y2;

        projected.push({
          px: px,
          py: py,
          z: z2,
          size: pt.size * (1 + z2 / (width * 0.8)),
          color: pt.color,
          alpha: pt.alpha,
          distToCenter: Math.hypot(px - cx, py - cy)
        });
      }

      // Sort particles by depth Z (furthest behind first)
      projected.sort(function (a, b) {
        return a.z - b.z;
      });

      // 1. Draw particles behind event horizon (z < 0)
      var frontStartIndex = projected.length;
      for (var j = 0; j < projected.length; j++) {
        var item = projected[j];
        if (item.z >= 0) {
          frontStartIndex = j;
          break; // front particles drawn after core
        }

        // Occlude particles directly behind black hole core
        if (item.distToCenter < coreRadius * 1.05) {
          continue;
        }

        ctx.save();
        ctx.globalAlpha = item.alpha * 0.55; // slightly dimmed behind
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(item.px, item.py, Math.max(0.4, item.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. Draw Central Event Horizon Black Hole
      // Dark core sphere
      var coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
      coreGrad.addColorStop(0, '#020205');
      coreGrad.addColorStop(0.7, '#07070F');
      coreGrad.addColorStop(0.95, '#12111F');
      coreGrad.addColorStop(1, 'rgba(231, 184, 96, 0.8)');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.fill();

      // Sharp glowing rim edge
      ctx.strokeStyle = 'rgba(245, 240, 228, 0.85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 3. Draw particles in front of event horizon (z >= 0)
      for (var k = frontStartIndex; k < projected.length; k++) {
        var frontItem = projected[k];
        ctx.save();
        ctx.globalAlpha = frontItem.alpha;
        ctx.fillStyle = frontItem.color;

        // Front glow blur for brighter particles
        if (frontItem.size > 1.4) {
          ctx.shadowColor = frontItem.color;
          ctx.shadowBlur = 4;
        }

        ctx.beginPath();
        ctx.arc(frontItem.px, frontItem.py, Math.max(0.5, frontItem.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);

    function dismissLoader() {
      if (isDestroyed || !overlay) return;
      var elapsed = Date.now() - startTime;
      var remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

      setTimeout(function () {
        overlay.classList.add('fade-out');

        setTimeout(function () {
          isDestroyed = true;
          if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
          }
          window.removeEventListener('resize', resize);
          if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        }, TRANSITION_TIME);
      }, remaining);
    }

    // Dismiss trigger: window load OR safety timeout
    if (document.readyState === 'complete') {
      dismissLoader();
    } else {
      window.addEventListener('load', dismissLoader, { once: true });
      setTimeout(dismissLoader, MAX_TIMEOUT);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCosmosLoader);
  } else {
    initCosmosLoader();
  }
})();
