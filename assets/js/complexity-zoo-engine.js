/*
 * Quantum Complexity Zoo engine.
 *
 * Pure (DOM-free) model + soft-body physics so it can run in the browser and in Node tests.
 *
 *  - buildModel(data): replays the paper timeline and returns the known relations at any event index
 *    (equality groups, inclusion closure, Hasse edges, unconditional strictness, oracle separations).
 *  - World: position-based dynamics for closed membranes. Every Hasse edge A ⊆ B is a *hard*
 *    constraint. A feasible circle layout initializes every timeline state. After the PBD
 *    proposal, continuous edge collision detection limits the accepted displacement and a
 *    final geometry validator rejects invalid states. Render these polygons without spline
 *    overshoot. Unknown problem membership is never used as a nonmembership constraint.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZooEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Model: timeline replay
   * ------------------------------------------------------------------ */

  function buildModel(data) {
    var classes = {};
    (data.classes || []).forEach(function (c) { classes[c.id] = c; });
    var problems = {};
    (data.problems || []).forEach(function (p) { problems[p.id] = p; });
    var events = (data.events || []).map(function (e, i) {
      var copy = {};
      for (var k in e) copy[k] = e[k];
      copy.index = i;
      return copy;
    }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || a.index - b.index; });
    events.forEach(function (e, i) { e.index = i; });

    function stateAt(idx) {
      var order = [];
      var present = {};
      var incl = [];
      var strictPairs = [];
      var eqs = [];
      var oracles = [];
      var membership = {};
      var nonmembership = {};
      var problemOrder = [];
      var warnings = [];

      for (var i = 0; i <= idx && i < events.length; i++) {
        var e = events[i];
        switch (e.type) {
          case "define":
            if (!present[e.class]) { present[e.class] = true; order.push(e.class); }
            (e.sub || []).forEach(function (s) { incl.push([s, e.class]); });
            (e.sup || []).forEach(function (p) { incl.push([e.class, p]); });
            break;
          case "inclusion":
            incl.push([e.sub, e.sup]);
            break;
          case "separation":
            incl.push([e.sub, e.sup]);
            strictPairs.push([e.sub, e.sup]);
            break;
          case "equality":
            eqs.push(e.classes.slice());
            break;
          case "oracle":
            oracles.push(e);
            break;
          case "problem":
            if (!membership[e.problem]) { membership[e.problem] = []; problemOrder.push(e.problem); }
            membership[e.problem].push(e.class);
            break;
          case "nonmembership":
            if (!nonmembership[e.problem]) nonmembership[e.problem] = [];
            nonmembership[e.problem].push(e.class);
            break;
          default:
            warnings.push("unknown event type " + e.type);
        }
      }

      // union-find over present classes
      var parent = {};
      order.forEach(function (c) { parent[c] = c; });
      function find(c) {
        while (parent[c] !== c) { parent[c] = parent[parent[c]]; c = parent[c]; }
        return c;
      }
      eqs.forEach(function (list) {
        var ok = list.every(function (c) { return present[c]; });
        if (!ok) { warnings.push("equality with undefined class " + list.join(",")); return; }
        for (var j = 1; j < list.length; j++) {
          var a = find(list[0]), b = find(list[j]);
          if (a !== b) {
            // keep the earlier-defined class as root so group keys are stable
            if (order.indexOf(a) < order.indexOf(b)) parent[b] = a; else parent[a] = b;
          }
        }
      });

      var groups = [];
      var groupIndex = {};
      order.forEach(function (c) {
        var r = find(c);
        if (groupIndex[r] === undefined) {
          groupIndex[r] = groups.length;
          groups.push({ key: r, members: [] });
        }
        groups[groupIndex[r]].members.push(c);
      });
      var gOf = {};
      order.forEach(function (c) { gOf[c] = groupIndex[find(c)]; });
      var n = groups.length;

      groups.forEach(function (g, gi) {
        g.index = gi;
        g.label = g.members.map(function (m) { return (classes[m] && classes[m].label) || m; }).join(" = ");
      });

      // inclusion closure
      var leq = [];
      for (var a = 0; a < n; a++) {
        leq.push(new Array(n).fill(false));
        leq[a][a] = true;
      }
      incl.forEach(function (p) {
        if (gOf[p[0]] === undefined || gOf[p[1]] === undefined) {
          warnings.push("inclusion with undefined class " + p.join(" ⊆ "));
          return;
        }
        leq[gOf[p[0]]][gOf[p[1]]] = true;
      });
      for (var k = 0; k < n; k++)
        for (var x = 0; x < n; x++)
          if (leq[x][k])
            for (var y = 0; y < n; y++)
              if (leq[k][y]) leq[x][y] = true;
      for (var x2 = 0; x2 < n; x2++)
        for (var y2 = x2 + 1; y2 < n; y2++)
          if (leq[x2][y2] && leq[y2][x2])
            warnings.push("cycle implies unrecorded equality: " + groups[x2].label + " / " + groups[y2].label);

      // unconditional strictness: A ⊆ X ⊊ Y ⊆ C  ⇒  A ⊊ C
      var strict = [];
      for (var s0 = 0; s0 < n; s0++) strict.push(new Array(n).fill(false));
      strictPairs.forEach(function (p) {
        var gx = gOf[p[0]], gy = gOf[p[1]];
        if (gx === undefined || gy === undefined) return;
        for (var aa = 0; aa < n; aa++) {
          if (!leq[aa][gx]) continue;
          for (var cc = 0; cc < n; cc++) if (leq[gy][cc]) strict[aa][cc] = true;
        }
      });

      // Hasse diagram (transitive reduction)
      var hasse = [];
      var parentsOf = [], childrenOf = [];
      for (var g0 = 0; g0 < n; g0++) { parentsOf.push([]); childrenOf.push([]); }
      for (var c1 = 0; c1 < n; c1++) {
        for (var p1 = 0; p1 < n; p1++) {
          if (c1 === p1 || !leq[c1][p1]) continue;
          var direct = true;
          for (var m = 0; m < n && direct; m++) {
            if (m !== c1 && m !== p1 && leq[c1][m] && leq[m][p1]) direct = false;
          }
          if (direct) {
            hasse.push({ child: c1, parent: p1, strict: strict[c1][p1] });
            parentsOf[c1].push(p1);
            childrenOf[p1].push(c1);
          }
        }
      }

      // heights (longest chain below) and depths (longest chain above)
      var height = new Array(n).fill(-1);
      function h(gi) {
        if (height[gi] >= 0) return height[gi];
        var best = 0;
        childrenOf[gi].forEach(function (ch) { best = Math.max(best, h(ch) + 1); });
        height[gi] = best;
        return best;
      }
      var depth = new Array(n).fill(-1);
      function d(gi) {
        if (depth[gi] >= 0) return depth[gi];
        var best = 0;
        parentsOf[gi].forEach(function (pa) { best = Math.max(best, d(pa) + 1); });
        depth[gi] = best;
        return best;
      }
      for (var q = 0; q < n; q++) { h(q); d(q); }

      // oracle separations between present groups
      var oracleList = [];
      oracles.forEach(function (e) {
        if (gOf[e.a] === undefined || gOf[e.b] === undefined) return;
        oracleList.push({ a: gOf[e.a], b: gOf[e.b], event: e });
      });

      // Positive, negative and unknown membership are distinct. Negatives propagate
      // down inclusions; missing positive evidence is NOT negative evidence.
      var probList = [];
      problemOrder.forEach(function (pid) {
        var gs = [];
        membership[pid].forEach(function (c) {
          if (gOf[c] !== undefined && gs.indexOf(gOf[c]) < 0) gs.push(gOf[c]);
        });
        if (!gs.length) return;
        var minimal = gs.filter(function (gi) {
          return !gs.some(function (gj) { return gj !== gi && leq[gj][gi]; });
        });
        var known = function (gi) { return gs.some(function (gj) { return leq[gj][gi]; }); };
        var exclude = [];
        var unknown = [];
        for (var gi = 0; gi < n; gi++) {
          var negative = (nonmembership[pid] || []).some(function (c) {
            return gOf[c] !== undefined && leq[gi][gOf[c]];
          });
          if (negative) exclude.push(gi);
          else if (!known(gi)) unknown.push(gi);
        }
        probList.push({ id: pid, groups: minimal, known: gs, exclude: exclude, unknown: unknown, kind: (problems[pid] || {}).kind || 'language' });
      });

      return {
        index: idx,
        event: events[idx] || null,
        groups: groups,
        groupOfClass: gOf,
        leq: leq,
        strict: strict,
        hasse: hasse,
        parentsOf: parentsOf,
        childrenOf: childrenOf,
        height: height,
        depth: depth,
        oracles: oracleList,
        problems: probList,
        warnings: warnings
      };
    }

    // relation of group b as seen from group a
    function relation(state, a, b) {
      if (a === b) return "self";
      var L = state.leq, S = state.strict;
      if (L[b][a]) return S[b][a] ? "sub-strict" : "sub";
      if (L[a][b]) return S[a][b] ? "sup-strict" : "sup";
      var oracle = state.oracles.filter(function (o) {
        return (o.a === a && o.b === b) || (o.a === b && o.b === a);
      });
      return oracle.length ? "oracle" : "unknown";
    }

    return { classes: classes, problems: problems, events: events, stateAt: stateAt, relation: relation };
  }

  /* ------------------------------------------------------------------ *
   * Geometry helpers
   * ------------------------------------------------------------------ */

  var NEAR = { d: 0, a: 0, b: 0, t: 0, nx: 0, ny: 0, inside: false };

  function signedArea(c) {
    var n = c.n, X = c.x, Y = c.y, s = 0;
    for (var i = 0, j = n - 1; i < n; j = i++) s += X[j] * Y[i] - X[i] * Y[j];
    return 0.5 * s;
  }

  function bbox(c) {
    var X = c.x, Y = c.y, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (var i = 0; i < c.n; i++) {
      if (X[i] < x0) x0 = X[i];
      if (X[i] > x1) x1 = X[i];
      if (Y[i] < y0) y0 = Y[i];
      if (Y[i] > y1) y1 = Y[i];
    }
    c.bx0 = x0; c.by0 = y0; c.bx1 = x1; c.by1 = y1;
  }

  // Nearest boundary point of polygon P to q. Fills NEAR; d > 0 inside. Normal points inward.
  function nearest(P, qx, qy, orient) {
    var n = P.n, X = P.x, Y = P.y;
    var best = Infinity, bj = 0, bt = 0, sx = 0, sy = 0, inside = false;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = X[i], yi = Y[i], xj = X[j], yj = Y[j];
      if ((yi > qy) !== (yj > qy) && qx < (xj - xi) * (qy - yi) / (yj - yi) + xi) inside = !inside;
      var ex = xi - xj, ey = yi - yj;
      var l2 = ex * ex + ey * ey;
      var t = l2 > 1e-12 ? ((qx - xj) * ex + (qy - yj) * ey) / l2 : 0;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      var px = xj + t * ex, py = yj + t * ey;
      var dx = qx - px, dy = qy - py;
      var d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; bj = j; bt = t; sx = px; sy = py; }
    }
    var dist = Math.sqrt(best);
    NEAR.a = bj; NEAR.b = (bj + 1) % n; NEAR.t = bt; NEAR.inside = inside;
    NEAR.d = inside ? dist : -dist;
    if (dist > 1e-6) {
      var nx = (qx - sx) / dist, ny = (qy - sy) / dist;
      if (!inside) { nx = -nx; ny = -ny; }
      NEAR.nx = nx; NEAR.ny = ny;
    } else {
      var ax = X[NEAR.b] - X[NEAR.a], ay = Y[NEAR.b] - Y[NEAR.a];
      var l = Math.sqrt(ax * ax + ay * ay) || 1;
      NEAR.nx = (-ay / l) * orient; NEAR.ny = (ax / l) * orient;
    }
    return NEAR;
  }

  function pointInPoly(c, qx, qy) {
    var n = c.n, X = c.x, Y = c.y, inside = false;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      if ((Y[i] > qy) !== (Y[j] > qy) && qx < (X[j] - X[i]) * (qy - Y[i]) / (Y[j] - Y[i]) + X[i]) inside = !inside;
    }
    return inside;
  }

  function segIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    var d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
    var d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    var d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    var d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return true;
    function on(x,y,x0,y0,x1,y1,d) {
      return Math.abs(d)<1e-8 && x>=Math.min(x0,x1)-1e-8 && x<=Math.max(x0,x1)+1e-8 && y>=Math.min(y0,y1)-1e-8 && y<=Math.max(y0,y1)+1e-8;
    }
    return on(ax,ay,cx,cy,dx,dy,d1)||on(bx,by,cx,cy,dx,dy,d2)||on(cx,cy,ax,ay,bx,by,d3)||on(dx,dy,ax,ay,bx,by,d4);
  }

  function convexHull(pts) {
    pts = pts.slice().sort(function (p, q) { return p[0] - q[0] || p[1] - q[1]; });
    if (pts.length < 3) return pts;
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lower = [], upper = [];
    for (var i = 0; i < pts.length; i++) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pts[i]) <= 0) lower.pop();
      lower.push(pts[i]);
    }
    for (var j = pts.length - 1; j >= 0; j--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[j]) <= 0) upper.pop();
      upper.push(pts[j]);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }

  function resampleClosed(pts, n) {
    var m = pts.length, lens = [], total = 0;
    for (var i = 0; i < m; i++) {
      var a = pts[i], b = pts[(i + 1) % m];
      var l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      lens.push(l); total += l;
    }
    var out = [], step = total / n, seg = 0, acc = 0;
    for (var k = 0; k < n; k++) {
      var target = k * step;
      while (seg < m - 1 && acc + lens[seg] < target) { acc += lens[seg]; seg++; }
      var u = lens[seg] > 1e-9 ? (target - acc) / lens[seg] : 0;
      var p = pts[seg], q = pts[(seg + 1) % m];
      out.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]);
    }
    return out;
  }

  function elastic(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return Math.pow(2, -9 * t) * Math.sin((t * 8 - 0.75) * (2 * Math.PI / 3)) + 1;
  }

  function hashString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967295;
  }

  /* ------------------------------------------------------------------ *
   * World: soft-body membranes
   * ------------------------------------------------------------------ */

  var DEFAULTS = {
    n: 48,
    substeps: 6,
    damping: 0.993,
    gapOpen: 3,
    gapStrict: 14,
    edgeK: 0.3,
    bendOpen: 0.03,
    bendStrict: 0.45,
    areaK: 0.22,
    wobbleOpen: 520,
    wobbleStrict: 45,
    hintK: 0.9,
    slack: 1.06,
    maxStep: 5,
    wall: 8,
    repairIters: 3,
    organelleR: 5
  };

  function World(opts) {
    this.o = {};
    for (var k in DEFAULTS) this.o[k] = DEFAULTS[k];
    for (var k2 in (opts || {})) this.o[k2] = opts[k2];
    this.W = 800; this.H = 500;
    this.cells = [];
    this.cellByKey = {};
    this.pairs = [];
    this.pairByKey = {};
    this.orgs = [];
    this.orgByKey = {};
    this.time = 0;
    this.state = null;
    this.grabbed = null;
    this.mouse = { x: 0, y: 0 };
    this.focus = null;          // { key -> 'strict' | 'open' | 'unknown' | 'self' }
    this.motion = 1;            // 0..1 (prefers-reduced-motion scales this down)
    this.hints = {};
    this.frame = 0;
    this.safety = { limited: 0, rejected: 0, recoveries: 0 };
    this._stalledFrames = 0;
  }

  World.prototype.setSize = function (w, h) {
    if (this.W && this.H && this.cells.length) {
      var sx = w / this.W, sy = h / this.H;
      this.cells.forEach(function (c) {
        for (var i = 0; i < c.n; i++) { c.x[i] *= sx; c.y[i] *= sy; c.px[i] *= sx; c.py[i] *= sy; }
      });
      this.orgs.forEach(function (o) { o.x *= sx; o.y *= sy; o.px *= sx; o.py *= sy; });
    }
    this.W = w; this.H = h;
    if (this.state) this._seedLayout(true);
  };

  World.prototype.setHints = function (hints) { this.hints = hints || {}; };

  World.prototype._hintFor = function (keys) {
    for (var i = 0; i < keys.length; i++) {
      var h = this.hints[keys[i]];
      if (h) return { x: h.x * this.W, y: h.y * this.H };
    }
    return { x: this.W / 2, y: this.H / 2 };
  };

  World.prototype._newCell = function (key, pts) {
    var n = this.o.n;
    var c = {
      key: key, n: n,
      x: new Float64Array(n), y: new Float64Array(n),
      px: new Float64Array(n), py: new Float64Array(n),
      mat: new Float64Array(n), matT: new Float64Array(n),
      nearD: new Float64Array(n), nearPair: new Int32Array(n),
      area0: 0, areaGoal: 0, areaStart: 0, spawnT: -1,
      alpha: 0, alphaGoal: 1, status: "alive", timer: 0,
      boost: 0, members: [key], label: key, group: -1,
      phase: [], label_i: -1, lx: 0, ly: 0, dash: 0, dashGoal: 0, dim: 1, dimGoal: 1
    };
    var seed = hashString(key);
    for (var p = 0; p < 4; p++) c.phase.push(seed * 6.283 * (p + 1.7) + p * 1.3);
    for (var i = 0; i < n; i++) {
      c.x[i] = c.px[i] = pts[i][0];
      c.y[i] = c.py[i] = pts[i][1];
    }
    if (signedArea(c) < 0) {
      // keep every membrane positively oriented
      for (var a = 0, b = n - 1; a < b; a++, b--) {
        var tx = c.x[a]; c.x[a] = c.x[b]; c.x[b] = tx;
        var ty = c.y[a]; c.y[a] = c.y[b]; c.y[b] = ty;
      }
      for (var k = 0; k < n; k++) { c.px[k] = c.x[k]; c.py[k] = c.y[k]; }
    }
    c.area0 = c.areaStart = Math.abs(signedArea(c));
    this.cells.push(c);
    this.cellByKey[key] = c;
    return c;
  };

  World.prototype._circle = function (cx, cy, r) {
    var pts = [], n = this.o.n;
    for (var i = 0; i < n; i++) {
      var t = (i / n) * Math.PI * 2;
      pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
    }
    return pts;
  };

  // best point inside every `inc` cell and outside every `exc` cell
  World.prototype._spawnPoint = function (inc, exc, hint, margin) {
    var self = this;
    var cands = [];
    if (hint) cands.push([hint.x, hint.y]);
    inc.forEach(function (c) { var m = self._centroid(c); cands.push([m.x, m.y]); });
    var box = null;
    inc.forEach(function (c) {
      bbox(c);
      var area = (c.bx1 - c.bx0) * (c.by1 - c.by0);
      if (!box || area < box.area) box = { x0: c.bx0, y0: c.by0, x1: c.bx1, y1: c.by1, area: area };
    });
    if (!box) box = { x0: this.W * 0.2, y0: this.H * 0.2, x1: this.W * 0.8, y1: this.H * 0.8 };
    var rnd = this._rng || (this._rng = mulberry(7));
    for (var s = 0; s < 80; s++) {
      cands.push([box.x0 + rnd() * (box.x1 - box.x0), box.y0 + rnd() * (box.y1 - box.y0)]);
    }
    var best = null, bestScore = -Infinity;
    cands.forEach(function (p, idx) {
      var score = Infinity;
      inc.forEach(function (c) { score = Math.min(score, nearest(c, p[0], p[1], 1).d); });
      if (!inc.length) score = 40;
      var pen = 0;
      exc.forEach(function (c) {
        var d = nearest(c, p[0], p[1], 1).d;
        if (d > -margin) pen += (d + margin);
      });
      var total = Math.min(score, 60) - pen * 0.7;
      if (hint) total -= 0.04 * Math.hypot(p[0] - hint.x, p[1] - hint.y);
      if (idx === 0) total += 4;
      if (total > bestScore) { bestScore = total; best = p; }
    });
    return { x: best[0], y: best[1], score: bestScore };
  };

  World.prototype._centroid = function (c) {
    var sx = 0, sy = 0;
    for (var i = 0; i < c.n; i++) { sx += c.x[i]; sy += c.y[i]; }
    return { x: sx / c.n, y: sy / c.n };
  };

  /* ------------------------------ sync ------------------------------ */

  World.prototype.sync = function (state, opts) {
    opts = opts || {};
    var self = this;
    var prevState = this.state;
    this.grabbed = null;
    this._stalledFrames = 0;
    this.state = state;
    var groups = state.groups;
    var groupCell = new Array(groups.length).fill(null);
    var claimed = {};

    // pass 1: match existing cells (largest current area wins; the rest fuse into it)
    groups.forEach(function (g, gi) {
      var cands = self.cells.filter(function (c) { return g.members.indexOf(c.key) >= 0 && !claimed[c.key]; });
      if (!cands.length) return;
      cands.forEach(function (c) { c._a = Math.abs(signedArea(c)); });
      cands.sort(function (a, b) {
        var al = a.status === "alive" ? 1 : 0, bl = b.status === "alive" ? 1 : 0;
        return (bl - al) || (b._a - a._a);
      });
      var keep = cands[0];
      claimed[keep.key] = true;
      groupCell[gi] = keep;
      if (keep.status !== "alive") { keep.status = "alive"; keep.alphaGoal = 1; }
      for (var i = 1; i < cands.length; i++) {
        var f = cands[i];
        claimed[f.key] = true;
        f.status = "fusing"; f.fuseInto = keep; f.timer = 0; f.alphaGoal = 0;
        keep.boost = Math.max(keep.boost, 1);
      }
    });

    // pass 2: spawn missing groups, children first (so supersets can wrap their children)
    var orderIdx = groups.map(function (g, i) { return i; });
    orderIdx.sort(function (a, b) { return state.height[a] - state.height[b]; });
    orderIdx.forEach(function (gi) {
      if (groupCell[gi]) return;
      var g = groups[gi];
      var kids = state.childrenOf[gi].map(function (ci) { return groupCell[ci]; }).filter(Boolean);
      var c;
      if (kids.length) {
        var pts = [];
        kids.forEach(function (k) { for (var i = 0; i < k.n; i++) pts.push([k.x[i], k.y[i]]); });
        var hull = convexHull(pts);
        var cx = 0, cy = 0;
        hull.forEach(function (p) { cx += p[0]; cy += p[1]; });
        cx /= hull.length; cy /= hull.length;
        var off = self.o.gapStrict + 6;
        hull = hull.map(function (p) {
          var dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1;
          return [p[0] + dx / l * off, p[1] + dy / l * off];
        });
        c = self._newCell(g.members[0], resampleClosed(hull, self.o.n));
      } else {
        var parents = state.parentsOf[gi].map(function (pi) { return groupCell[pi]; }).filter(Boolean);
        var sp = self._spawnPoint(parents, [], self._hintFor(g.members), 0);
        c = self._newCell(g.members[0], self._circle(sp.x, sp.y, 3));
      }
      c.spawnT = opts.instant ? 99 : 0;
      c.alpha = opts.instant ? 1 : 0;
      c.boost = 1.4;
      groupCell[gi] = c;
      claimed[c.key] = true;
    });

    // retire cells that are no longer part of the state
    this.cells.forEach(function (c) {
      if (!claimed[c.key] && c.status === "alive") {
        c.status = "dying"; c.timer = 0; c.alphaGoal = 0;
      }
    });

    groups.forEach(function (g, gi) {
      var c = groupCell[gi];
      c.group = gi; c.members = g.members.slice(); c.label = g.label;
    });
    this.groupCell = groupCell;

    // pairs (Hasse edges) + fusion pairs
    var nextPairs = [], nextByKey = {};
    function addPair(child, parent, strict, kind) {
      var key = child.key + "|" + parent.key;
      var p = self.pairByKey[key];
      var created = false;
      if (!p) {
        created = true;
        p = { key: key, child: child, parent: parent, gap: self.o.gapOpen, ramp: 0, done: false, age: 0 };
      }
      p.child = child; p.parent = parent; p.kind = kind;
      p.strict = strict;
      p.gapGoal = strict ? self.o.gapStrict : self.o.gapOpen;
      if (created) {
        p.gap = Math.min(p.gapGoal, self.o.gapOpen);
        if (self._violations(p, 0.5) === 0) { p.done = true; p.ramp = 1; }
        else { p.done = false; p.ramp = 0; p.age = 0; }
      }
      nextPairs.push(p); nextByKey[key] = p;
    }
    state.hasse.forEach(function (e) {
      addPair(groupCell[e.child], groupCell[e.parent], e.strict, "hasse");
    });
    this.cells.forEach(function (c) {
      if (c.status === "fusing" && c.fuseInto) addPair(c, c.fuseInto, false, "fuse");
    });
    this.pairs = nextPairs;
    this.pairByKey = nextByKey;

    // separation pulse: strictness newly acquired
    if (prevState && state.event && state.event.type === "separation") {
      var gs = state.groupOfClass[state.event.sub];
      if (gs !== undefined && groupCell[gs]) groupCell[gs].boost = Math.max(groupCell[gs].boost, 2.2);
    }

    // organelles
    var seen = {};
    state.problems.forEach(function (pr) {
      if (pr.kind === 'promise') return;
      var inc = pr.groups.map(function (gi) { return groupCell[gi]; }).filter(Boolean);
      var exc = pr.exclude.map(function (gi) { return groupCell[gi]; }).filter(Boolean);
      var o = self.orgByKey[pr.id];
      if (!o) {
        var sp = self._spawnPoint(inc, exc, self._hintFor([pr.id]), self.o.organelleR + 4);
        o = { key: pr.id, x: sp.x, y: sp.y, px: sp.x, py: sp.y, r: self.o.organelleR, alpha: 0, alphaGoal: 1, spawnT: opts.instant ? 99 : 0, status: "alive", inc: [], exc: [], ramp: 1 };
        self.orgs.push(o); self.orgByKey[pr.id] = o;
      }
      o.status = "alive"; o.alphaGoal = 1;
      var before = o.inc.map(function (c) { return c.key; }).join(",");
      o.inc = inc; o.exc = exc;
      if (before && before !== inc.map(function (c) { return c.key; }).join(",")) {
        var outside = inc.some(function (c) { return nearest(c, o.x, o.y, 1).d < o.r; });
        if (outside) o.ramp = 0;
      }
      seen[pr.id] = true;
    });
    this.orgs.forEach(function (o) {
      if (!seen[o.key]) { o.status = "dying"; o.alphaGoal = 0; o.inc = []; o.exc = []; }
    });

    // Forward steps may retain feasible shapes. A rewind must reset the layout:
    // forcing a late, deeply nested shape down to the early-history area targets
    // can pinch it into self-contact and stall all membranes behind the guard.
    if (prevState && state.index > prevState.index && !opts.instant && this._validGeometry()) {
      this._updateGoals();
      this.pairs.forEach(function (p) { p.done = true; p.ramp = 1; });
      this._placeOrganelles();
    } else this._seedLayout(!!opts.instant);
  };

  World.prototype._updateGoals = function () {
    var st = this.state;
    if (!st) return;
    var Hmax = 0;
    st.height.forEach(function (h) { if (h > Hmax) Hmax = h; });
    var D = Math.max(Hmax, 5);
    var W = this.W, H = this.H;
    var rx0 = Math.max(16, W * 0.034), ry0 = Math.max(14, H * 0.036);
    var rx1 = W * 0.43, ry1 = H * 0.41;
    var self = this;
    this.groupCell.forEach(function (c, gi) {
      var t = st.height[gi] / D;
      var rx = rx0 + (rx1 - rx0) * t, ry = ry0 + (ry1 - ry0) * t;
      c.areaGoal = Math.PI * rx * ry;
      c.hint = self._hintFor(c.members);
      if (Hmax < D) {
        // early history: keep the small zoo near the middle so it grows outward
        var s = 0.55 + 0.45 * (Hmax / D);
        c.hint = { x: W / 2 + (c.hint.x - W / 2) * s, y: H / 2 + (c.hint.y - H / 2) * s };
      }
    });
  };

  World.prototype._violations = function (p, tol) {
    var C = p.child, P = p.parent, count = 0;
    var oP = signedArea(P) >= 0 ? 1 : -1, oC = signedArea(C) >= 0 ? 1 : -1;
    for (var i = 0; i < C.n; i++) if (nearest(P, C.x[i], C.y[i], oP).d < -tol) count++;
    bbox(C);
    for (var j = 0; j < P.n; j++) {
      var x = P.x[j], y = P.y[j];
      if (x < C.bx0 || x > C.bx1 || y < C.by0 || y > C.by1) continue;
      if (nearest(C, x, y, oC).d > tol) count++;
    }
    return count;
  };

  /* ------------------------------ interaction ------------------------------ */

  World.prototype.pick = function (x, y, radius) {
    radius = radius || 18;
    var best = null, bestD = radius;
    this.orgs.forEach(function (o) {
      if (o.status !== "alive") return;
      var d = Math.hypot(o.x - x, o.y - y) - o.r;
      if (d < bestD) { bestD = d; best = { org: o }; }
    });
    if (best) return best;
    bestD = radius;
    this.cells.forEach(function (c) {
      if (c.status !== "alive") return;
      for (var i = 0; i < c.n; i++) {
        var d = Math.hypot(c.x[i] - x, c.y[i] - y);
        if (d < bestD - 0.5 || (best && Math.abs(d - bestD) <= 0.5 && c._a < best.cell._a)) {
          bestD = d; best = { cell: c, i: i };
        }
      }
    });
    return best;
  };

  World.prototype.grab = function (x, y, preferredCell) {
    this.cells.forEach(function (c) { c._a = Math.abs(signedArea(c)); });
    var hit;
    if (preferredCell && preferredCell.status === 'alive') {
      var nearestIndex=0,nearestDistance=Infinity;
      for(var vi=0;vi<preferredCell.n;vi++) {
        var distance=Math.hypot(preferredCell.x[vi]-x,preferredCell.y[vi]-y);
        if(distance<nearestDistance){nearestDistance=distance;nearestIndex=vi;}
      }
      hit={cell:preferredCell,i:nearestIndex};
    } else hit = this.pick(x, y, 20);
    if (!hit) { this.grabbed = null; return null; }
    this.mouse.x = x; this.mouse.y = y;
    if (hit.org) {
      this.grabbed = { org: hit.org, ox: hit.org.x - x, oy: hit.org.y - y, x0: x, y0: y };
      return this.grabbed;
    }
    var c = hit.cell, n = c.n, sigma = 4.5, span = 11, list = [];
    for (var j = -span; j <= span; j++) {
      var k = ((hit.i + j) % n + n) % n;
      list.push({ k: k, w: Math.exp(-(j * j) / (2 * sigma * sigma)), ox: c.x[k] - c.x[hit.i], oy: c.y[k] - c.y[hit.i] });
    }
    this.grabbed = { cell: c, i: hit.i, list: list, x0: c.x[hit.i], y0: c.y[hit.i] };
    c.boost = Math.max(c.boost, 0.6);
    return this.grabbed;
  };

  World.prototype.drag = function (x, y) { this.mouse.x = x; this.mouse.y = y; };
  World.prototype.release = function () {
    if (this.grabbed && this.grabbed.cell) this.grabbed.cell.boost = Math.max(this.grabbed.cell.boost, 0.8);
    this.grabbed = null;
  };

  // innermost alive cell under the point
  World.prototype.hit = function (x, y) {
    var best = null, bestA = Infinity;
    var org = null;
    this.orgs.forEach(function (o) {
      if (o.status === "alive" && Math.hypot(o.x - x, o.y - y) <= o.r + 5) org = o;
    });
    if (org) return { org: org };
    this.cells.forEach(function (c) {
      if (c.status !== "alive") return;
      if (pointInPoly(c, x, y)) {
        var a = Math.abs(signedArea(c));
        if (a < bestA) { bestA = a; best = c; }
      }
    });
    return best ? { cell: best } : null;
  };

  /* ------------------------------ simulation ------------------------------ */

  World.prototype.step = function (dt) {
    dt = Math.min(Math.max(dt, 0), 1 / 30);
    if (dt === 0) return;
    var before = this._capture();
    this._stepReference = before;
    this.time += dt;
    this.frame++;
    this._schedule(dt);
    var S = this.o.substeps, h = dt / S;
    for (var s = 0; s < S; s++) {
      this._integrate(h);
      this._solve(s === S - 1);
    }
    this._repair();
    this._acceptSafe(before);
    this._placeOrganelles();
    this._materials(dt);
  };

  World.prototype._schedule = function (dt) {
    var self = this, o = this.o;
    var removeCells = false;
    this.cells.forEach(function (c) {
      c.alpha += (c.alphaGoal - c.alpha) * (1 - Math.exp(-dt * (c.status === "alive" ? 6 : 3.2)));
      c.boost *= Math.exp(-dt * 1.1);
      var goal = c.areaGoal * (1 + 0.025 * Math.sin(self.time * 0.6 + c.phase[0]) * self.motion);
      if (c.status === "fusing") {
        c.timer += dt;
        var target = c.fuseInto ? Math.abs(signedArea(c.fuseInto)) * 0.97 : goal;
        c.area0 += (target - c.area0) * (1 - Math.exp(-dt * 2.4));
        if (c.timer > 1.5) { c.status = "dead"; removeCells = true; }
      } else if (c.status === "dying") {
        c.timer += dt;
        c.area0 += (goal * 0.02 - c.area0) * (1 - Math.exp(-dt * 4));
        if (c.timer > 0.7) { c.status = "dead"; removeCells = true; }
      } else if (c.spawnT >= 0 && c.spawnT < 1.4) {
        c.spawnT += dt;
        var u = Math.min(1, c.spawnT / 1.15);
        var e = self.motion > 0.5 ? elastic(u) : 1 - Math.pow(1 - u, 3);
        c.area0 = c.areaStart + (goal - c.areaStart) * e;
      } else {
        c.area0 += (goal - c.area0) * (1 - Math.exp(-dt * 1.8));
      }
      c.restEdge = Math.sqrt(Math.max(c.area0, 4) * 4 * Math.PI) / c.n * o.slack;
    });
    if (removeCells) {
      this.cells = this.cells.filter(function (c) { return c.status !== "dead"; });
      this.cellByKey = {};
      this.cells.forEach(function (c) { self.cellByKey[c.key] = c; });
      this.pairs = this.pairs.filter(function (p) { return p.child.status !== "dead" && p.parent.status !== "dead"; });
      this.pairByKey = {};
      this.pairs.forEach(function (p) { self.pairByKey[p.key] = p; });
    }
    this.pairs.forEach(function (p) {
      p.gap += (p.gapGoal - p.gap) * (1 - Math.exp(-dt * 2.2));
      if (!p.done) {
        p.age += dt;
        p.ramp = Math.min(1, p.age / 1.4);
        if (p.ramp >= 1 && (p.age > 3.2 || self._violations(p, 0.5) === 0)) p.done = true;
      }
    });
    var removeOrgs = false;
    this.orgs.forEach(function (g) {
      g.alpha += (g.alphaGoal - g.alpha) * (1 - Math.exp(-dt * 5));
      if (g.spawnT >= 0 && g.spawnT < 1.4) g.spawnT += dt;
      if (g.ramp < 1) g.ramp = Math.min(1, g.ramp + dt / 1.6);
      if (g.status === "dying" && g.alpha < 0.02) { g.status = "dead"; removeOrgs = true; }
    });
    if (removeOrgs) {
      this.orgs = this.orgs.filter(function (g) { return g.status !== "dead"; });
      this.orgByKey = {};
      this.orgs.forEach(function (g) { self.orgByKey[g.key] = g; });
    }
  };

  World.prototype._integrate = function (h) {
    var o = this.o, t = this.time, h2 = h * h, damp = o.damping, maxStep = o.maxStep;
    var motion = this.motion;
    var self = this;
    // engulf attraction for ramping pairs
    var pull = {};
    this.pairs.forEach(function (p) {
      if (p.done) return;
      var cc = self._centroid(p.child), pc = self._centroid(p.parent);
      var k = 5 * (1 - 0.5 * p.ramp);
      var acc = pull[p.child.key] || (pull[p.child.key] = { x: 0, y: 0 });
      acc.x += (pc.x - cc.x) * k; acc.y += (pc.y - cc.y) * k;
    });
    this.cells.forEach(function (c) {
      var n = c.n, X = c.x, Y = c.y, PX = c.px, PY = c.py;
      var ax = 0, ay = 0;
      if (c.status === "alive" && c.hint) {
        var m = self._centroid(c);
        ax = (c.hint.x - m.x) * o.hintK;
        ay = (c.hint.y - m.y) * o.hintK;
      }
      var pl = pull[c.key];
      if (pl) { ax += pl.x; ay += pl.y; }
      var orient = signedArea(c) >= 0 ? 1 : -1;
      var boost = 1 + c.boost * 1.6;
      var ph = c.phase;
      for (var i = 0; i < n; i++) {
        var ip = i === n - 1 ? 0 : i + 1, im = i === 0 ? n - 1 : i - 1;
        var ex = X[ip] - X[im], ey = Y[ip] - Y[im];
        var l = Math.sqrt(ex * ex + ey * ey) || 1;
        // outward normal for a positively oriented polygon
        var nx = (ey / l) * orient, ny = (-ex / l) * orient;
        var th = (i / n) * 6.283185307;
        var amp = (o.wobbleOpen + (o.wobbleStrict - o.wobbleOpen) * c.mat[i]) * boost * motion;
        var f = amp * (0.5 * Math.sin(2 * th + 0.9 * t + ph[1]) +
                       0.35 * Math.sin(3 * th - 1.3 * t + ph[2]) +
                       0.22 * Math.sin(5 * th + 2.1 * t + ph[3]));
        var vx = (X[i] - PX[i]) * damp, vy = (Y[i] - PY[i]) * damp;
        PX[i] = X[i]; PY[i] = Y[i];
        var dx = vx + (ax + f * nx) * h2, dy = vy + (ay + f * ny) * h2;
        var dl = Math.sqrt(dx * dx + dy * dy);
        if (dl > maxStep) { dx *= maxStep / dl; dy *= maxStep / dl; }
        X[i] += dx; Y[i] += dy;
      }
    });
    var rnd = this._rng || (this._rng = mulberry(7));
    this.orgs.forEach(function (g) {
      var vx = (g.x - g.px) * 0.97, vy = (g.y - g.py) * 0.97;
      g.px = g.x; g.py = g.y;
      var jx = (rnd() - 0.5) * 900 * motion, jy = (rnd() - 0.5) * 900 * motion;
      if (g.ramp < 1 && g.inc.length) {
        var m = self._centroid(g.inc[0]);
        jx += (m.x - g.x) * 8; jy += (m.y - g.y) * 8;
      }
      var dx = vx + jx * h2, dy = vy + jy * h2;
      var dl = Math.sqrt(dx * dx + dy * dy);
      if (dl > maxStep) { dx *= maxStep / dl; dy *= maxStep / dl; }
      g.x += dx; g.y += dy;
    });
  };

  World.prototype._solve = function (last) {
    var o = this.o, self = this;
    var g = this.grabbed;
    // mouse
    if (g) {
      var mx = this.mouse.x, my = this.mouse.y;
      var maxPull = 150;
      var dx = mx - g.x0, dy = my - g.y0, dl = Math.hypot(dx, dy);
      if (dl > maxPull) { mx = g.x0 + dx / dl * maxPull; my = g.y0 + dy / dl * maxPull; }
      if (g.org) {
        var tx = mx + g.ox, ty = my + g.oy;
        g.org.x += (tx - g.org.x) * 0.35; g.org.y += (ty - g.org.y) * 0.35;
      } else if (g.cell.status === "alive") {
        var c = g.cell;
        g.list.forEach(function (it) {
          var tx2 = mx + it.ox * 0.85, ty2 = my + it.oy * 0.85;
          var k = 0.32 * it.w;
          c.x[it.k] += (tx2 - c.x[it.k]) * k;
          c.y[it.k] += (ty2 - c.y[it.k]) * k;
        });
      }
    }

    // membrane internal constraints
    this.cells.forEach(function (c) {
      var n = c.n, X = c.x, Y = c.y;
      // Births start at a tiny radius, while a timeline event can change the
      // desired area by orders of magnitude. Applying that whole pressure/rest
      // length jump folds the polygon, after which the global safety guard can
      // reject every subsequent frame. Advance the target by at most 8% of the
      // current area per substep; keep the final collision guard unchanged.
      var currentArea = Math.max(1, Math.abs(signedArea(c)));
      var solveArea = Math.max(currentArea * 0.92, Math.min(c.area0, currentArea * 1.08));
      var L = Math.sqrt(solveArea * 4 * Math.PI) / n * o.slack;
      c.restEdge = L;
      var ek = o.edgeK;
      for (var i = 0; i < n; i++) {
        var j = i === n - 1 ? 0 : i + 1;
        var dx = X[j] - X[i], dy = Y[j] - Y[i];
        var d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
        var corr = (d - L) / d * 0.5 * ek;
        X[i] += dx * corr; Y[i] += dy * corr;
        X[j] -= dx * corr; Y[j] -= dy * corr;
      }
      var Lb = 2 * L * Math.cos(Math.PI / n) * 0.985;
      for (var i2 = 0; i2 < n; i2++) {
        var a = i2 === 0 ? n - 1 : i2 - 1, b = i2 === n - 1 ? 0 : i2 + 1;
        var bk = o.bendOpen + (o.bendStrict - o.bendOpen) * c.mat[i2];
        var bx = X[b] - X[a], by = Y[b] - Y[a];
        var bd = Math.sqrt(bx * bx + by * by) || 1e-6;
        if (bd >= Lb) continue;              // only resist folding, never straightening
        var bc = (bd - Lb) / bd * 0.5 * bk;
        X[a] += bx * bc; Y[a] += by * bc;
        X[b] -= bx * bc; Y[b] -= by * bc;
      }
      // area (pressure)
      var A = signedArea(c), sgn = A >= 0 ? 1 : -1;
      var C = Math.abs(A) - solveArea;
      var gsum = 0;
      for (var k = 0; k < n; k++) {
        var kp = k === n - 1 ? 0 : k + 1, km = k === 0 ? n - 1 : k - 1;
        var gx = 0.5 * (Y[kp] - Y[km]), gy = 0.5 * (X[km] - X[kp]);
        gsum += gx * gx + gy * gy;
      }
      if (gsum > 1e-9) {
        var lam = -C / gsum * o.areaK * sgn;
        var gxs = new Float64Array(n), gys = new Float64Array(n);
        for (var k2 = 0; k2 < n; k2++) {
          var kp2 = k2 === n - 1 ? 0 : k2 + 1, km2 = k2 === 0 ? n - 1 : k2 - 1;
          gxs[k2] = 0.5 * (Y[kp2] - Y[km2]); gys[k2] = 0.5 * (X[km2] - X[kp2]);
        }
        for (var k3 = 0; k3 < n; k3++) { X[k3] += lam * gxs[k3]; Y[k3] += lam * gys[k3]; }
      }
      for (var r = 0; r < n; r++) { c.nearD[r] = Infinity; c.nearPair[r] = -1; }
      self._selfContact(c, self._stepReference[c.key]);
    });

    // containment (hard; ramped while a newly proven inclusion is being established)
    this.pairs.forEach(function (p, pi) {
      var k = p.done ? 1 : p.ramp * p.ramp * 0.5;
      if (k <= 0) return;
      self._contain(p, p.gap, 1, p.parent.status === "alive" ? 1 : 0.2, k, pi, last || !p.done);
    });

    this._solveOrganelles(1);
    this._walls();
  };

  // Enforce child ⊂ parent with clearance `gap`. wC / wP are inverse masses.
  World.prototype._contain = function (p, gap, wC, wP, k, pairIndex, checkParentVerts) {
    var C = p.child, P = p.parent;
    var oP = signedArea(P) >= 0 ? 1 : -1, oC = signedArea(C) >= 0 ? 1 : -1;
    var n = C.n;
    for (var i = 0; i < n; i++) {
      var q = nearest(P, C.x[i], C.y[i], oP);
      if (pairIndex >= 0 && q.d < C.nearD[i]) { C.nearD[i] = q.d; C.nearPair[i] = pairIndex; }
      var viol = q.d - gap;
      if (viol >= 0) continue;
      var t = q.t, wa = wP * (1 - t), wb = wP * t;
      var denom = wC + wP * ((1 - t) * (1 - t) + t * t);
      if (denom <= 0) continue;
      var dl = -viol / denom * k;
      C.x[i] += wC * dl * q.nx; C.y[i] += wC * dl * q.ny;
      if (wP > 0) {
        P.x[q.a] -= wa * dl * q.nx; P.y[q.a] -= wa * dl * q.ny;
        P.x[q.b] -= wb * dl * q.nx; P.y[q.b] -= wb * dl * q.ny;
      }
    }
    if (!checkParentVerts) return;
    bbox(C);
    var pad = gap + 1;
    for (var j = 0; j < P.n; j++) {
      var x = P.x[j], y = P.y[j];
      if (x < C.bx0 - pad || x > C.bx1 + pad || y < C.by0 - pad || y > C.by1 + pad) continue;
      var r = nearest(C, x, y, oC);
      var v = -gap - r.d;             // want r.d <= -gap
      if (v >= 0) continue;
      var t2 = r.t, wa2 = wC * (1 - t2), wb2 = wC * t2;
      var den2 = wP + wC * ((1 - t2) * (1 - t2) + t2 * t2);
      if (den2 <= 0) continue;
      var dl2 = -v / den2 * k;
      P.x[j] -= wP * dl2 * r.nx; P.y[j] -= wP * dl2 * r.ny;
      C.x[r.a] += wa2 * dl2 * r.nx; C.y[r.a] += wa2 * dl2 * r.ny;
      C.x[r.b] += wb2 * dl2 * r.nx; C.y[r.b] += wb2 * dl2 * r.ny;
    }
  };

  World.prototype._solveOrganelles = function (wMembrane) {
    var orgs = this.orgs;
    for (var i = 0; i < orgs.length; i++) {
      var g = orgs[i];
      if (g.status !== "alive") continue;
      var margin = g.r + 3;
      var k = g.ramp >= 1 ? 1 : g.ramp * g.ramp * 0.4;
      for (var a = 0; a < g.inc.length; a++) {
        var P = g.inc[a];
        var oP = signedArea(P) >= 0 ? 1 : -1;
        var q = nearest(P, g.x, g.y, oP);
        var v = q.d - margin;
        if (v >= 0) continue;
        var t = q.t, wP = 0.25 * wMembrane;
        var den = 1 + wP * ((1 - t) * (1 - t) + t * t);
        var dl = -v / den * k;
        g.x += dl * q.nx; g.y += dl * q.ny;
        if (wP > 0) {
          P.x[q.a] -= wP * (1 - t) * dl * q.nx; P.y[q.a] -= wP * (1 - t) * dl * q.ny;
          P.x[q.b] -= wP * t * dl * q.nx; P.y[q.b] -= wP * t * dl * q.ny;
        }
      }
      // Explicit, sourced nonmembership only.
      for (var b = 0; b < g.exc.length; b++) {
        var E = g.exc[b];
        if (E.status !== "alive") continue;
        var oE = signedArea(E) >= 0 ? 1 : -1;
        var r = nearest(E, g.x, g.y, oE);
        var w = r.d + margin;
        if (w <= 0) continue;
        var push = Math.min(w, 3) * 0.12;
        g.x -= push * r.nx; g.y -= push * r.ny;
      }
      for (var j = i + 1; j < orgs.length; j++) {
        var h = orgs[j];
        if (h.status !== "alive") continue;
        var dx = h.x - g.x, dy = h.y - g.y, d = Math.hypot(dx, dy) || 1e-3, min = 26;
        if (d < min) {
          var c = (min - d) / d * 0.25;
          g.x -= dx * c; g.y -= dy * c; h.x += dx * c; h.y += dy * c;
        }
      }
    }
  };

  World.prototype._walls = function () {
    var w = this.o.wall, W = this.W - w, H = this.H - w;
    this.cells.forEach(function (c) {
      for (var i = 0; i < c.n; i++) {
        if (c.x[i] < w) c.x[i] = w; else if (c.x[i] > W) c.x[i] = W;
        if (c.y[i] < w) c.y[i] = w; else if (c.y[i] > H) c.y[i] = H;
      }
    });
    this.orgs.forEach(function (g) {
      g.x = Math.min(W, Math.max(w, g.x)); g.y = Math.min(H, Math.max(w, g.y));
    });
  };

  // Parents first: project children into fixed parents so residual violations never survive a frame.
  World.prototype._repair = function () {
    var st = this.state;
    if (!st) return;
    var self = this;
    var depthOf = function (c) { return c.group >= 0 && st.depth[c.group] !== undefined ? st.depth[c.group] : 99; };
    var list = this.pairs.filter(function (p) { return p.done; });
    list.sort(function (a, b) { return depthOf(a.child) - depthOf(b.child); });
    for (var it = 0; it < this.o.repairIters; it++) {
      list.forEach(function (p) {
        self._contain(p, Math.max(1, p.gap * 0.5), 1, 0, 1, -1, true);
      });
    }
    this._walls();
    this._solveOrganelles(0);
  };

  World.prototype._materials = function (dt) {
    var self = this, focus = this.focus;
    var rate = 1 - Math.exp(-dt * 3);
    this.cells.forEach(function (c) {
      var n = c.n;
      var rel = focus ? focus[c.key] : null;
      for (var i = 0; i < n; i++) {
        var target;
        if (rel) {
          target = rel === "strict" ? 1 : rel === "self" ? c.matT[i] : 0;
        } else if (c.nearPair[i] >= 0) {
          var p = self.pairs[c.nearPair[i]];
          target = p && p.strict ? 1 : 0;
        } else {
          target = 0.3;
        }
        if (!rel) c.matT[i] = target;
        c.mat[i] += (target - c.mat[i]) * rate;
      }
      c.dashGoal = rel === "unknown" || rel === "oracle" ? 1 : 0;
      c.dimGoal = focus && rel !== "self" && (rel === "unknown" || rel === "oracle") ? 0.45 : 1;
      c.dash += (c.dashGoal - c.dash) * rate;
      c.dim += (c.dimGoal - c.dim) * rate;
    });
  };

  /* ----------------------- feasible geometry ----------------------- */

  // The safety guard prevents self-intersections, but cannot by itself unjam a
  // folded membrane: all future proposals may keep pushing through the same
  // contact. Resolve near vertex/edge contacts in the solver, on the side from
  // the previous accepted frame, before asking the guard to accept the proposal.
  World.prototype._selfContact = function (c, reference) {
    var n=c.n, margin=Math.min(4, c.restEdge*0.65);
    for(var pass=0;pass<2;pass++) for(var i=0;i<n;i++) {
      for(var j=0;j<n;j++) {
        var b=(j+1)%n, sep=(j-i+n)%n;
        if(sep<=1 || sep>=n-2) continue;
        var ex=c.x[b]-c.x[j],ey=c.y[b]-c.y[j],l2=ex*ex+ey*ey;
        if(l2<1e-10) continue;
        var t=((c.x[i]-c.x[j])*ex+(c.y[i]-c.y[j])*ey)/l2;
        if(t<0 || t>1) continue;
        var l=Math.sqrt(l2),dist=cross2(ex,ey,c.x[i]-c.x[j],c.y[i]-c.y[j])/l;
        if(Math.abs(dist)>margin*4) continue;
        var oldSide=cross2(reference.x[b]-reference.x[j],reference.y[b]-reference.y[j],reference.x[i]-reference.x[j],reference.y[i]-reference.y[j]);
        var sign=oldSide>=0?1:-1, signed=dist*sign;
        if(signed>=margin) continue;
        var nx=-ey/l*sign,ny=ex/l*sign;
        var correction=Math.min(margin-signed,c.restEdge)/(1+(1-t)*(1-t)+t*t);
        c.x[i]+=nx*correction;c.y[i]+=ny*correction;
        c.x[j]-=nx*correction*(1-t);c.y[j]-=ny*correction*(1-t);
        c.x[b]-=nx*correction*t;c.y[b]-=ny*correction*t;
      }
    }
  };

  World.prototype._seedLayout = function (instant) {
    var self = this, st = this.state;
    var order = st.groups.map(function (_, i) { return i; }).sort(function (a, b) { return st.height[a] - st.height[b]; });
    var discs = [];
    order.forEach(function (i) {
      var hint = self._hintFor(st.groups[i].members);
      var c = { x: (hint.x / self.W - 0.5) * 360, y: (hint.y / self.H - 0.5) * 300, r: 30 };
      st.childrenOf[i].forEach(function (j) {
        var d = discs[j];
        c.r = Math.max(c.r, Math.hypot(c.x - d.x, c.y - d.y) + d.r + 22);
      });
      discs[i] = c;
    });
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    discs.forEach(function (c) { minX = Math.min(minX, c.x-c.r); maxX = Math.max(maxX, c.x+c.r); minY = Math.min(minY, c.y-c.r); maxY = Math.max(maxY, c.y+c.r); });
    var scale = Math.min((self.W-50)/(maxX-minX), (self.H-50)/(maxY-minY), 1.6);
    st.groups.forEach(function (_, i) {
      var c = self.groupCell[i], d = discs[i];
      var cx = self.W/2 + (d.x-(minX+maxX)/2)*scale, cy = self.H/2 + (d.y-(minY+maxY)/2)*scale;
      var pts = self._circle(cx, cy, d.r*scale);
      var targetArea = 0.5 * c.n * (d.r*scale)**2 * Math.sin(2*Math.PI/c.n);
      var isBirth = !instant && st.event && st.event.type === 'define' && c.members.indexOf(st.event.class) >= 0;
      if (isBirth && !st.childrenOf[i].length) pts = self._circle(cx, cy, d.r*scale*0.35);
      for (var k = 0; k < c.n; k++) { c.x[k] = c.px[k] = pts[k][0]; c.y[k] = c.py[k] = pts[k][1]; }
      c.areaStart = c.area0 = Math.abs(signedArea(c));
      c.areaGoal = targetArea;
      c.hint = { x: cx, y: cy };
      c.spawnT = instant ? 99 : 0;
      c.alpha = instant ? 1 : Math.max(c.alpha, 0.12);
    });
    // Fusion retains a fading inner contour, initialized safely inside its survivor.
    self.cells.forEach(function (c) {
      if (c.status !== 'fusing' || !c.fuseInto) return;
      var p = c.fuseInto, m = self._centroid(p);
      for (var i = 0; i < c.n; i++) { c.x[i] = c.px[i] = m.x + (p.x[i]-m.x)*0.88; c.y[i] = c.py[i] = m.y + (p.y[i]-m.y)*0.88; }
      c.areaGoal = c.area0 = Math.abs(signedArea(c));
    });
    self.cells = self.cells.filter(function (c) { return c.status === 'alive' || c.status === 'fusing'; });
    self.cellByKey = {};
    self.cells.forEach(function (c) { self.cellByKey[c.key] = c; });
    self.pairs = self.pairs.filter(function (p) { return self.cells.indexOf(p.child) >= 0 && self.cells.indexOf(p.parent) >= 0; });
    self.pairs.forEach(function (p) { p.done = true; p.ramp = 1; });
    self.grabbed = null;
    self._placeOrganelles();
    if (!self._validGeometry()) throw new Error('Cannot initialize a feasible membrane layout');
  };

  World.prototype._capture = function () {
    var result = {};
    this.cells.forEach(function (c) { result[c.key] = { x: c.x.slice(), y: c.y.slice() }; });
    return result;
  };

  function cross2(ax, ay, bx, by) { return ax*by-ay*bx; }
  function roots(a, b, c) {
    if (Math.abs(a) < 1e-10) return Math.abs(b) < 1e-10 ? [] : [-c/b];
    var d = b*b-4*a*c;
    if (d < 0) return [];
    var q = -0.5*(b+(b >= 0 ? 1 : -1)*Math.sqrt(d));
    return q === 0 ? [-b/(2*a)] : [q/a, c/q];
  }

  // Moving vertex against moving segment. All trajectories are linear during the
  // acceptance step. Contact can occur only at a root of the orientation polynomial.
  function vertexContact(v, a, b, limit) {
    var ux = b[0]-a[0], uy = b[1]-a[1], vx = v[0]-a[0], vy = v[1]-a[1];
    var dux = b[2]-a[2], duy = b[3]-a[3], dvx = v[2]-a[2], dvy = v[3]-a[3];
    var A = cross2(dux,duy,dvx,dvy), B = cross2(dux,duy,vx,vy)+cross2(ux,uy,dvx,dvy), C = cross2(ux,uy,vx,vy);
    if (Math.abs(A)+Math.abs(B)+Math.abs(C) < 1e-10) return 0; // conservative collinear fallback
    roots(A,B,C).forEach(function (t) {
      if (t < 0 || t > limit) return;
      var px = v[0]+t*v[2], py = v[1]+t*v[3];
      var ax = a[0]+t*a[2], ay = a[1]+t*a[3], bx = b[0]+t*b[2], by = b[1]+t*b[3];
      if (px >= Math.min(ax,bx)-1e-7 && px <= Math.max(ax,bx)+1e-7 && py >= Math.min(ay,by)-1e-7 && py <= Math.max(ay,by)+1e-7) limit = t;
    });
    return limit;
  }

  function movingEdges(c, old) {
    var vs = [], edges = [];
    for (var i = 0; i < c.n; i++) vs.push([old.x[i],old.y[i],c.x[i]-old.x[i],c.y[i]-old.y[i]]);
    for (var j = 0; j < c.n; j++) {
      var a=vs[j], b=vs[(j+1)%c.n];
      edges.push({ a:a, b:b, x0:Math.min(a[0],b[0],a[0]+a[2],b[0]+b[2]), x1:Math.max(a[0],b[0],a[0]+a[2],b[0]+b[2]), y0:Math.min(a[1],b[1],a[1]+a[3],b[1]+b[3]), y1:Math.max(a[1],b[1],a[1]+a[3],b[1]+b[3]) });
    }
    return edges;
  }

  function edgeContact(a,b,limit) {
    if (a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0) return limit;
    limit=vertexContact(a.a,b.a,b.b,limit); limit=vertexContact(a.b,b.a,b.b,limit);
    limit=vertexContact(b.a,a.a,a.b,limit); return vertexContact(b.b,a.a,a.b,limit);
  }

  World.prototype._validGeometry = function () {
    for (var k=0;k<this.cells.length;k++) {
      var c=this.cells[k];
      if (!(signedArea(c)>1)) return false;
      for(var i=0;i<c.n;i++) {
        if(!Number.isFinite(c.x[i]) || !Number.isFinite(c.y[i])) return false;
        var j=(i+1)%c.n;
        if(Math.hypot(c.x[i]-c.x[j],c.y[i]-c.y[j])<0.01) return false;
        var prev=(i+c.n-1)%c.n,ax=c.x[prev]-c.x[i],ay=c.y[prev]-c.y[i],bx=c.x[j]-c.x[i],by=c.y[j]-c.y[i];
        if(Math.abs(cross2(ax,ay,bx,by))<1e-8 && ax*bx+ay*by>0) return false;
        for(var b=i+2;b<c.n;b++) {
          if(i===0 && b===c.n-1) continue;
          var bb=(b+1)%c.n;
          if(segIntersect(c.x[i],c.y[i],c.x[j],c.y[j],c.x[b],c.y[b],c.x[bb],c.y[bb])) return false;
        }
      }
    }
    for(var p=0;p<this.pairs.length;p++) {
      var C=this.pairs[p].child, P=this.pairs[p].parent;
      for(var a=0;a<C.n;a++) {
        if(nearest(P,C.x[a],C.y[a],1).d<0.001) return false;
        var aa=(a+1)%C.n;
        for(var b2=0;b2<P.n;b2++) {
          var b3=(b2+1)%P.n;
          if(segIntersect(C.x[a],C.y[a],C.x[aa],C.y[aa],P.x[b2],P.y[b2],P.x[b3],P.y[b3])) return false;
        }
      }
    }
    return true;
  };

  World.prototype._acceptSafe = function (before) {
    var self=this, candidate=this._capture(), edges={}, limit=1;
    if(this.cells.some(function(c){return Array.from(c.x).concat(Array.from(c.y)).some(function(v){return !Number.isFinite(v);});})) {
      this.cells.forEach(function(c){c.x.set(before[c.key].x);c.y.set(before[c.key].y);c.px.set(c.x);c.py.set(c.y);});
      this.safety.rejected++;return;
    }
    this.cells.forEach(function(c) { edges[c.key]=movingEdges(c,before[c.key]); });
    this.cells.forEach(function(c) {
      var e=edges[c.key];
      for(var a=0;a<e.length;a++) for(var b=a+2;b<e.length;b++) {
        if(a===0 && b===e.length-1) continue;
        limit=edgeContact(e[a],e[b],limit);
      }
    });
    this.pairs.forEach(function(p) {
      var a=edges[p.child.key],b=edges[p.parent.key];
      for(var i=0;i<a.length;i++) for(var j=0;j<b.length;j++) limit=edgeContact(a[i],b[j],limit);
    });
    var alpha=limit<1 ? Math.max(0,limit*0.9) : 1;
    function apply(t) {
      self.cells.forEach(function(c) {
        var a=before[c.key],b=candidate[c.key];
        for(var i=0;i<c.n;i++) { c.x[i]=t===0?a.x[i]:a.x[i]+(b.x[i]-a.x[i])*t; c.y[i]=t===0?a.y[i]:a.y[i]+(b.y[i]-a.y[i])*t; }
      });
    }
    if(alpha<1) apply(alpha);
    for(var tries=0;!this._validGeometry() && tries<12;tries++) { alpha*=0.5; apply(alpha); }
    if(!this._validGeometry()) { alpha=0; apply(0); this.safety.rejected++; }
    if(alpha<1) {
      this.safety.limited++;
      this.cells.forEach(function(c) {
        var a=before[c.key];
        for(var i=0;i<c.n;i++) { c.px[i]=c.x[i]-(c.x[i]-a.x[i])*0.15; c.py[i]=c.y[i]-(c.y[i]-a.y[i])*0.15; }
      });
    }
    // Advect nearby organelles with the accepted drag, not with an unvalidated
    // mouse target. Their known memberships are enforced immediately afterwards.
    if(this.grabbed && this.grabbed.cell) {
      var c=this.grabbed.cell, a=before[c.key], k=this.grabbed.i;
      var dx=c.x[k]-a.x[k],dy=c.y[k]-a.y[k];
      this.orgs.forEach(function(g) {
        var fall=Math.exp(-((g.x-a.x[k])**2+(g.y-a.y[k])**2)/(2*120*120));
        g.x+=dx*fall;g.y+=dy*fall;
      });
    }
    // A valid but nearly pinched state can have no useful admissible step in
    // the proposed direction. Do not let one such contact freeze the whole
    // atlas forever. Only recover when motion was actually proposed and is
    // persistently blocked; never reset a membrane while the user holds it.
    var proposed=0,accepted=0;
    this.cells.forEach(function(c) {
      var a=before[c.key],b=candidate[c.key];
      for(var i=0;i<c.n;i++) {
        proposed=Math.max(proposed,Math.hypot(b.x[i]-a.x[i],b.y[i]-a.y[i]));
        accepted=Math.max(accepted,Math.hypot(c.x[i]-a.x[i],c.y[i]-a.y[i]));
      }
    });
    this._stalledFrames = !this.grabbed && proposed>0.05 && accepted<0.001 ? this._stalledFrames+1 : 0;
    if(this._stalledFrames>=18) {
      this._seedLayout(true);
      this._stalledFrames=0;
      this.safety.recoveries++;
    }
  };

  World.prototype._placeOrganelles = function () {
    var self=this;
    this.orgs.forEach(function(g) {
      if(g.status!=='alive') return;
      function valid() {
        return g.inc.every(function(c) { return nearest(c,g.x,g.y,1).d >= g.r+0.1; }) &&
          g.exc.every(function(c) { return nearest(c,g.x,g.y,1).d <= -g.r-0.1; });
      }
      for(var it=0;it<30 && !valid();it++) {
        g.inc.forEach(function(c) { var q=nearest(c,g.x,g.y,1),v=g.r+0.5-q.d;if(v>0){g.x+=q.nx*v;g.y+=q.ny*v;} });
        g.exc.forEach(function(c) { var q=nearest(c,g.x,g.y,1),v=g.r+0.5+q.d;if(v>0){g.x-=q.nx*v;g.y-=q.ny*v;} });
      }
      if(!valid()) {
        var p=self._spawnPoint(g.inc,g.exc,self._hintFor([g.key]),g.r+1);g.x=p.x;g.y=p.y;
      }
      g.hidden=!valid(); // do not display a falsely located example when no placement fits
      if(g.hidden || Math.hypot(g.x-g.px,g.y-g.py)>8) {g.px=g.x;g.py=g.y;}
    });
  };

  /* ------------------------------ diagnostics ------------------------------ */

  World.prototype.checkInvariants = function (tol) {
    tol = tol === undefined ? 0.01 : tol;
    var report = { pairs: 0, vertexOut: 0, parentIn: 0, crossings: 0, worst: 0, orgOut: 0, failures: [] };
    this.pairs.forEach(function (p) {
      if (!p.done || p.kind !== "hasse") return;
      report.pairs++;
      var C = p.child, P = p.parent;
      var oP = signedArea(P) >= 0 ? 1 : -1, oC = signedArea(C) >= 0 ? 1 : -1;
      var bad = 0;
      for (var i = 0; i < C.n; i++) {
        var d = nearest(P, C.x[i], C.y[i], oP).d;
        if (d < -tol) { report.vertexOut++; bad++; report.worst = Math.max(report.worst, -d); }
      }
      for (var j = 0; j < P.n; j++) {
        var d2 = nearest(C, P.x[j], P.y[j], oC).d;
        if (d2 > tol) { report.parentIn++; bad++; report.worst = Math.max(report.worst, d2); }
      }
      for (var a = 0; a < C.n; a++) {
        var a2 = (a + 1) % C.n;
        for (var b = 0; b < P.n; b++) {
          var b2 = (b + 1) % P.n;
          if (segIntersect(C.x[a], C.y[a], C.x[a2], C.y[a2], P.x[b], P.y[b], P.x[b2], P.y[b2])) { report.crossings++; bad++; }
        }
      }
      if (bad) report.failures.push(p.key);
    });
    this.orgs.forEach(function (g) {
      if (g.status !== "alive" || g.ramp < 1) return;
      g.inc.forEach(function (P) {
        if (nearest(P, g.x, g.y, 1).d < -tol) report.orgOut++;
      });
    });
    return report;
  };

  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return {
    buildModel: buildModel,
    World: World,
    geometry: { signedArea: signedArea, pointInPoly: pointInPoly, nearest: nearest }
  };
});
