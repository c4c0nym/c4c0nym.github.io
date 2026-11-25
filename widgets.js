(() => {
  const W = (typeof CONFIG !== "undefined" && CONFIG.widgets) || {};
  const $ = (id) => document.getElementById(id);

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ } },
  };

  // tiny DOM helper: everything goes in as text or properties, never as HTML
  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    el.append(...kids.flat().filter((x) => x != null));
    return el;
  }
  // parse SVG markup in the right namespace by wrapping it in an <svg> root
  const svg = (markup) => { const t = document.createElement("template"); t.innerHTML = markup.trim(); return t.content.firstChild; };
  const svgPart = (markup) => svg('<svg xmlns="http://www.w3.org/2000/svg">' + markup + "</svg>").firstChild;

  /* ================= weather ================= */
  const WMO = [
    [[0], "☀️", "clear", "🌙"],
    [[1, 2], "⛅", "partly cloudy", "☁️"],
    [[3], "☁️", "overcast"],
    [[45, 48], "🌫️", "fog"],
    [[51, 53, 55, 56, 57], "🌦️", "drizzle"],
    [[61, 63, 65, 66, 67], "🌧️", "rain"],
    [[71, 73, 75, 77, 85, 86], "🌨️", "snow"],
    [[80, 81, 82], "🌦️", "showers"],
    [[95, 96, 99], "⛈️", "thunderstorm"],
  ];
  const describe = (code, isDay) => {
    const row = WMO.find((r) => r[0].includes(code));
    if (!row) return { icon: "🌡️", label: "" };
    return { icon: !isDay && row[3] ? row[3] : row[1], label: row[2] };
  };

  // reverse geocoding sometimes answers "Gemeente Amsterdam" or "City of X": keep the place name
  const cleanName = (s) => (s ? s.replace(/^(gemeente|municipality of|city of)\s+/i, "") : s);

  function weatherWidget() {
    const root = $("w-weather");
    const unit = W.units === "fahrenheit" ? "fahrenheit" : "celsius";
    const body = h("div", { class: "wx" });
    const refreshBtn = h("button", { class: "icon-btn", type: "button", "aria-label": "Update my location", title: "Update my location", text: "↻" });
    root.append(h("div", { class: "card-head" }, h("span", { class: "card-title", id: "wx-place", text: "Weather" }), refreshBtn), body);
    const place = $("wx-place");

    const say = (msg, extra) => { body.replaceChildren(h("p", { class: "muted small", text: msg }), extra || null); };

    function render(d) {
      place.textContent = d.name || "Weather";
      const { icon, label } = describe(d.code, d.isDay);
      body.replaceChildren(
        h("div", { class: "wx-main" },
          h("div", { class: "wx-icon", "aria-hidden": "true", text: icon }),
          h("div", {},
            h("div", { class: "wx-temp", text: `${Math.round(d.temp)}°${unit === "celsius" ? "C" : "F"}` }),
            h("div", { class: "wx-range", text: `↑${Math.round(d.max)}°  ↓${Math.round(d.min)}°` }))),
        h("div", { class: "muted small", text: label }));
    }

    async function load(lat, lon, name) {
      // coordinates are rounded to 2 decimals (about 1 km) before they leave the browser
      lat = Math.round(lat * 100) / 100; lon = Math.round(lon * 100) / 100;
      const wxUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
        "&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min" +
        "&forecast_days=1&timezone=auto&temperature_unit=" + unit;
      const geoUrl = "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" + lat + "&longitude=" + lon + "&localityLanguage=en";
      const [wx, geo] = await Promise.all([
        fetch(wxUrl).then((r) => { if (!r.ok) throw new Error("weather " + r.status); return r.json(); }),
        name ? Promise.resolve(null) : fetch(geoUrl).then((r) => r.json()).catch(() => null),
      ]);
      const data = {
        lat, lon, at: Date.now(),
        name: name || cleanName(geo && (geo.city || geo.locality || geo.principalSubdivision)) || "Your location",
        temp: wx.current.temperature_2m, code: wx.current.weather_code, isDay: wx.current.is_day === 1,
        max: wx.daily.temperature_2m_max[0], min: wx.daily.temperature_2m_min[0],
      };
      store.set("startpage.weather", data);
      render(data);
    }

    function locate() {
      if (!navigator.geolocation) return fallback("This browser has no geolocation.");
      say("Locating…");
      navigator.geolocation.getCurrentPosition(
        (pos) => load(pos.coords.latitude, pos.coords.longitude).catch(() => say("Could not load the weather.")),
        (err) => fallback(err && err.code === 1 ? "Location is blocked for this page." : "Could not get your location."),
        { timeout: 10000, maximumAge: 600000 });
    }

    function fallback(msg) {
      const input = h("input", { type: "text", placeholder: "or type a city", "aria-label": "City", spellcheck: "false" });
      const form = h("form", { class: "wx-form", onsubmit: async (e) => {
        e.preventDefault();
        const name = input.value.trim();
        if (!name) return;
        try {
          const r = await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(name)).then((x) => x.json());
          const hit = r.results && r.results[0];
          if (!hit) return say("No place called “" + name + "”.", retry());
          await load(hit.latitude, hit.longitude, hit.name);
        } catch { say("Could not load the weather."); }
      } }, input);
      body.replaceChildren(h("p", { class: "muted small", text: msg }), retry(), form);
    }
    function retry() { return h("button", { class: "pill", type: "button", onclick: locate, text: "Use my location" }); }

    refreshBtn.addEventListener("click", locate);

    // never prompt on page load: only ask when permission is already granted or the person clicks
    const cached = store.get("startpage.weather", null);
    if (cached) render(cached);
    const fresh = cached && Date.now() - cached.at < 15 * 60 * 1000;
    (async () => {
      let state = null;
      try { state = (await navigator.permissions.query({ name: "geolocation" })).state; } catch { /* unsupported */ }
      if (state === "granted") { if (!fresh) locate(); }
      else if (cached) { if (!fresh) load(cached.lat, cached.lon, cached.name).catch(() => {}); }
      else say("Show the weather where you are.", retry());
    })();
    setInterval(() => { const c = store.get("startpage.weather", null); if (c) load(c.lat, c.lon, c.name).catch(() => {}); }, 15 * 60 * 1000);
  }

  /* ================= timezones ================= */
  function timezoneWidget() {
    const MAX = 4;
    const root = $("w-zones");
    let zones = store.get("startpage.timezones", null) || W.timezones || ["Europe/Amsterdam", "UTC", "America/New_York", "Asia/Tokyo"];
    zones = zones.slice(0, MAX);
    let editing = false;

    const all = (Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : []).concat(["UTC"]);
    const resolveZone = (text) => {
      const t = text.trim().toLowerCase().replace(/\s+/g, "_");
      if (!t) return null;
      return all.find((z) => z.toLowerCase() === t) ||
             all.find((z) => z.split("/").pop().toLowerCase() === t) ||
             all.find((z) => z.split("/").pop().toLowerCase().startsWith(t)) || null;
    };
    const label = (z) => z.split("/").pop().replace(/_/g, " ");

    const list = h("div", { class: "zones" });
    const editBtn = h("button", { class: "icon-btn", type: "button", "aria-label": "Edit time zones", title: "Edit time zones", text: "✎" });
    const datalist = h("datalist", { id: "zone-list" }, all.map((z) => h("option", { value: label(z) })));
    const input = h("input", { type: "text", list: "zone-list", placeholder: "add a city or zone", "aria-label": "Add a time zone", spellcheck: "false" });
    const msg = h("p", { class: "muted small", text: "" });
    const form = h("form", { class: "zone-add", onsubmit: (e) => {
      e.preventDefault();
      const z = resolveZone(input.value);
      if (!z) { msg.textContent = "Unknown place. Try a city such as Tokyo or a zone such as Europe/Paris."; return; }
      if (zones.includes(z)) { msg.textContent = label(z) + " is already listed."; return; }
      zones.push(z); store.set("startpage.timezones", zones);
      input.value = ""; msg.textContent = ""; draw();
    } }, input, h("button", { class: "pill", type: "submit", text: "Add" }), datalist);
    root.append(h("div", { class: "card-head" }, h("span", { class: "card-title", text: "Time zones" }), editBtn), list, form, msg);

    editBtn.addEventListener("click", () => { editing = !editing; draw(); });

    function abbr(z, now) {
      try { return new Intl.DateTimeFormat("en-US", { timeZone: z, timeZoneName: "short" }).formatToParts(now).find((p) => p.type === "timeZoneName").value; }
      catch { return ""; }
    }
    function clock(z, now) {
      return new Intl.DateTimeFormat("en-GB", { timeZone: z, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
    }
    function draw() {
      const now = new Date();
      list.replaceChildren(...zones.map((z, i) => h("div", { class: "zone" },
        h("div", {}, h("div", { class: "zone-name", text: label(z) }), h("div", { class: "muted small", text: abbr(z, now) })),
        h("div", { class: "zone-time", "data-zone": z, text: clock(z, now) }),
        editing ? h("button", { class: "icon-btn danger", type: "button", "aria-label": "Remove " + label(z), text: "×", onclick: () => {
          zones.splice(i, 1); store.set("startpage.timezones", zones); draw();
        } }) : null)));
      form.hidden = !editing || zones.length >= MAX;
      msg.hidden = !editing;
      editBtn.setAttribute("aria-pressed", String(editing));
      if (editing && zones.length >= MAX) msg.textContent = "Four time zones is the maximum. Remove one to add another.";
      else if (!editing) msg.textContent = "";
    }
    draw();
    setInterval(() => {
      const now = new Date();
      for (const el of list.querySelectorAll(".zone-time")) el.textContent = clock(el.dataset.zone, now);
    }, 1000);
  }

  /* ================= pomodoro ================= */
  function pomodoroWidget() {
    const root = $("w-pomo");
    const cfg = Object.assign({ focus: 25, break: 5 }, W.pomodoro || {});
    const saved = store.get("startpage.pomodoro", {});
    const mins = { focus: saved.focus || cfg.focus, break: saved.break || cfg.break };
    const limits = { focus: { min: 5, max: 90, step: 5 }, break: { min: 1, max: 30, step: 1 } };
    let mode = "focus", running = false, left = mins.focus * 60, endAt = 0, timer = null;
    const baseTitle = document.title;

    const R = 50, C = 2 * Math.PI * R;
    const arc = svgPart(`<circle class="ring-arc" cx="60" cy="60" r="${R}" fill="none" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${C}" stroke-dashoffset="0" transform="rotate(-90 60 60)"/>`);
    const playIcon = svgPart(`<path class="play" d="M50 42 L50 78 L80 60 Z"/>`);
    const pauseIcon = svgPart(`<g class="pause"><rect x="47" y="42" width="8" height="36" rx="2"/><rect x="65" y="42" width="8" height="36" rx="2"/></g>`);
    const ring = svg(`<svg viewBox="0 0 120 120" width="128" height="128" aria-hidden="true">
      <circle cx="60" cy="60" r="${R}" fill="none" stroke-width="10" class="ring-track"/></svg>`);
    ring.append(arc);
    const ringBtn = h("button", { class: "ring-btn", type: "button", "aria-label": "Start timer" });
    ringBtn.append(ring);
    const iconHost = svgPart("<g></g>");
    ring.append(iconHost);

    const timeEl = h("div", { class: "pomo-time", "aria-live": "off", text: "25:00" });
    const minus = h("button", { class: "icon-btn", type: "button", "aria-label": "Shorter", text: "−" });
    const plus = h("button", { class: "icon-btn", type: "button", "aria-label": "Longer", text: "+" });
    const reset = h("button", { class: "icon-btn", type: "button", "aria-label": "Reset timer", title: "Reset", text: "↺", hidden: true });
    const modeBtns = {
      focus: h("button", { type: "button", "data-mode": "focus", text: "Focus" }),
      break: h("button", { type: "button", "data-mode": "break", text: "Break" }),
    };
    const seg = h("div", { class: "seg", role: "group", "aria-label": "Timer mode" }, modeBtns.focus, modeBtns.break);
    root.append(h("div", { class: "pomo" }, ringBtn, h("div", { class: "pomo-row" }, minus, timeEl, plus, reset), seg));

    const fmt = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    function paint() {
      const total = mins[mode] * 60;
      timeEl.textContent = fmt(left);
      arc.setAttribute("stroke-dashoffset", String(C * (1 - (total - left) / total)));
      arc.classList.toggle("break", mode === "break");
      iconHost.replaceChildren((running ? pauseIcon : playIcon).cloneNode(true));
      ringBtn.setAttribute("aria-label", running ? "Pause timer" : "Start timer");
      for (const [m, b] of Object.entries(modeBtns)) b.setAttribute("aria-pressed", String(m === mode));
      minus.disabled = plus.disabled = running;
      reset.hidden = running || left === total;
      document.title = running ? `${fmt(left)} · ${mode}` : baseTitle;
    }
    function beep() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.28, 0.56].forEach((t) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
          g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
          g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
          o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
        });
        setTimeout(() => ctx.close(), 1200);
      } catch { /* no audio */ }
    }
    function stop() { running = false; clearInterval(timer); timer = null; }
    function setMode(m) { stop(); mode = m; left = mins[m] * 60; paint(); }
    function tick() {
      left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      if (left === 0) { stop(); beep(); setMode(mode === "focus" ? "break" : "focus"); return; }
      paint();
    }
    ringBtn.addEventListener("click", () => {
      if (running) { stop(); paint(); return; }
      running = true; endAt = Date.now() + left * 1000;
      timer = setInterval(tick, 250); paint();
    });
    reset.addEventListener("click", () => { left = mins[mode] * 60; paint(); });
    for (const [m, b] of Object.entries(modeBtns)) b.addEventListener("click", () => setMode(m));
    const adjust = (dir) => {
      const l = limits[mode];
      mins[mode] = Math.min(l.max, Math.max(l.min, mins[mode] + dir * l.step));
      store.set("startpage.pomodoro", mins);
      left = mins[mode] * 60; paint();
    };
    minus.addEventListener("click", () => adjust(-1));
    plus.addEventListener("click", () => adjust(1));
    paint();
  }

  /* ================= checklist ================= */
  function checklistWidget() {
    const root = $("w-todo");
    const MAX_ITEMS = 50, MAX_LEN = 120;
    let items = store.get("startpage.todos", []);
    if (!Array.isArray(items)) items = [];
    items = items.filter((i) => i && typeof i.text === "string").slice(0, MAX_ITEMS);
    let adding = false, editingId = null;
    const save = () => store.set("startpage.todos", items);
    const uid = () => Math.random().toString(36).slice(2, 9);

    const list = h("ul", { class: "todo-list" });
    const top = h("div", { class: "todo-top" });
    const clearBtn = h("button", { class: "link-btn", type: "button", text: "clear done", onclick: () => { items = items.filter((i) => !i.done); save(); draw(); } });
    root.append(h("div", { class: "card-head" }, h("span", { class: "card-title", text: "Checklist" }), clearBtn), top, list);

    function addControl() {
      if (!adding) {
        return h("button", { class: "pill add", type: "button", onclick: () => { adding = true; draw(); }, disabled: items.length >= MAX_ITEMS },
          h("span", { "aria-hidden": "true", text: "+" }), " Add an item");
      }
      const input = h("input", { type: "text", maxlength: String(MAX_LEN), placeholder: "What needs doing?", "aria-label": "New item", spellcheck: "false" });
      const commit = () => {
        const text = input.value.trim();
        if (text) items.push({ id: uid(), text: text.slice(0, MAX_LEN), done: false });
        adding = false; save(); draw();
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        else if (e.key === "Escape") { e.stopPropagation(); adding = false; draw(); }
      });
      queueMicrotask(() => input.focus());
      return h("div", { class: "todo-new" }, input, h("button", { class: "pill", type: "button", onclick: commit, text: "Add" }));
    }

    function row(item) {
      const check = h("input", { type: "checkbox", "aria-label": "Done: " + item.text, onchange: () => { item.done = check.checked; save(); draw(); } });
      check.checked = !!item.done;
      let main;
      if (editingId === item.id) {
        const input = h("input", { class: "todo-edit", type: "text", maxlength: String(MAX_LEN), value: item.text, "aria-label": "Edit item", spellcheck: "false" });
        const finish = (keep) => {
          const text = input.value.trim();
          if (keep && text) { item.text = text.slice(0, MAX_LEN); save(); }
          editingId = null; draw();
        };
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); finish(true); }
          else if (e.key === "Escape") { e.stopPropagation(); finish(false); }
        });
        input.addEventListener("blur", () => { if (editingId === item.id) finish(true); });
        queueMicrotask(() => { input.focus(); input.select(); });
        main = input;
      } else {
        main = h("span", { class: "todo-text" + (item.done ? " done" : ""), text: item.text, title: "Double-click to edit", ondblclick: () => { editingId = item.id; draw(); } });
      }
      return h("li", { class: "todo" }, check, main,
        editingId === item.id ? null : h("span", { class: "todo-actions" },
          h("button", { class: "icon-btn", type: "button", "aria-label": "Edit " + item.text, title: "Edit", text: "✎", onclick: () => { editingId = item.id; draw(); } }),
          h("button", { class: "icon-btn danger", type: "button", "aria-label": "Delete " + item.text, title: "Delete", text: "×", onclick: () => { items = items.filter((i) => i !== item); save(); draw(); } })));
    }

    function draw() {
      top.replaceChildren(addControl());
      list.replaceChildren(...items.map(row));
      if (!items.length && !adding) list.append(h("li", { class: "muted small", text: "Nothing here. Add something." }));
      clearBtn.hidden = !items.some((i) => i.done);
    }
    draw();
  }

  weatherWidget();
  timezoneWidget();
  pomodoroWidget();
  checklistWidget();
})();
