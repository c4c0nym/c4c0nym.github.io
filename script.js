(() => {
  const $ = (id) => document.getElementById(id);
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* file:// in some browsers */ } },
  };

  // ---- clock & greeting
  function tick() {
    const now = new Date();
    $("time").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    $("date").textContent = now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
    const h = now.getHours();
    $("greeting").textContent =
      h < 5 ? "still up" : h < 12 ? "good morning" : h < 18 ? "good afternoon" : "good evening";
  }
  $("name").textContent = CONFIG.name;
  tick();
  setInterval(tick, 1000);

  // ---- picture (click to cycle, remembered)
  const gifs = CONFIG.gifs;
  let gifIndex = Math.max(0, gifs.indexOf(store.get("startpage.gif")));
  const showGif = () => { $("gif-img").src = gifs[gifIndex]; store.set("startpage.gif", gifs[gifIndex]); };
  $("gif").addEventListener("click", () => { gifIndex = (gifIndex + 1) % gifs.length; showGif(); });
  showGif();

  // ---- bookmarks
  const nav = $("bookmarks");
  for (const group of CONFIG.bookmarks) {
    const col = document.createElement("div");
    col.className = "category";
    const title = document.createElement("h2");
    title.textContent = group.title;
    const list = document.createElement("ul");
    for (const [label, url] of group.links) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = url;
      a.textContent = label;
      li.append(a);
      list.append(li);
    }
    col.append(title, list);
    nav.append(col);
  }

  // ---- search with shortcuts
  const q = $("q");
  const looksLikeUrl = (s) =>
    /^https?:\/\/\S+$/i.test(s) || /^(localhost|([\w-]+\.)+[a-z]{2,})(:\d+)?(\/\S*)?$/i.test(s);

  function resolve(raw) {
    const text = raw.trim();
    if (!text) return null;
    const [first, ...rest] = text.split(/\s+/);
    const sc = CONFIG.shortcuts[first.toLowerCase()];
    if (sc && rest.length) {
      return { label: `${sc.name}: ${rest.join(" ")}`,
               url: sc.url.replace("%s", encodeURIComponent(rest.join(" "))) };
    }
    if (looksLikeUrl(text) && !/^\d+(\.\d+){3}$/.test(text)) {   // a bare IP is searched, not opened
      return { label: `open ${text}`, url: /^https?:\/\//i.test(text) ? text : `https://${text}` };
    }
    return { label: `search: ${text}`, url: CONFIG.search + encodeURIComponent(text) };
  }

  q.addEventListener("input", () => {
    const r = resolve(q.value);
    const [first] = q.value.trim().split(/\s+/);
    const sc = CONFIG.shortcuts[(first || "").toLowerCase()];
    $("hint").textContent = r ? (sc && !/\s/.test(q.value.trim()) ? `${sc.name} …` : `↵ ${r.label}`) : "";
  });
  $("search").addEventListener("submit", (e) => {
    e.preventDefault();
    const r = resolve(q.value);
    if (r) window.location.href = r.url;
  });

  // ---- shortcut help
  const help = $("help");
  for (const [key, sc] of Object.entries(CONFIG.shortcuts)) {
    const span = document.createElement("span");
    const kbd = document.createElement("kbd");
    kbd.textContent = key;
    span.append(kbd, ` ${sc.name}`);
    help.append(span);
  }

  // ---- keyboard
  document.addEventListener("keydown", (e) => {
    const typing = document.activeElement === q;
    if (e.key === "/" && !typing) { e.preventDefault(); q.focus(); }
    else if (e.key === "?" && !typing) { help.hidden = !help.hidden; }
    else if (e.key === "Escape") { q.value = ""; $("hint").textContent = ""; q.blur(); help.hidden = true; }
  });
})();
