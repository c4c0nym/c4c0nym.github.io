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

  // A shortcut is "<key> <text>", "!<key> <text>" or "<text> !<key>".
  // Unknown bangs fall through to the default search, where DuckDuckGo handles them.
  function parse(text) {
    const words = text.split(/\s+/);
    const find = (w, bang) => CONFIG.shortcuts[(bang ? w.replace(/^!/, "") : w).toLowerCase()];
    const first = words[0], last = words[words.length - 1];
    if (/^!\w+$/.test(first) && find(first, true)) return { sc: find(first, true), query: words.slice(1).join(" ") };
    if (words.length > 1 && /^!\w+$/.test(last) && find(last, true)) return { sc: find(last, true), query: words.slice(0, -1).join(" ") };
    if (find(first, false)) return { sc: find(first, false), query: words.slice(1).join(" ") };
    const dd = (w) => /^!\w+$/.test(w) && CONFIG.ddgBangs[w.slice(1).toLowerCase()];
    if (dd(first)) return { ddg: dd(first), query: words.slice(1).join(" ") };
    if (words.length > 1 && dd(last)) return { ddg: dd(last), query: words.slice(0, -1).join(" ") };
    return { sc: null, query: text };
  }

  function resolve(raw) {
    const text = raw.trim();
    if (!text) return null;
    const { sc, ddg, query } = parse(text);
    if (ddg && query) {
      return { label: `${ddg} via DuckDuckGo: ${query}`, url: CONFIG.search + encodeURIComponent(text) };
    }
    if (sc && query) {
      return { label: `${sc.name}: ${query}`,
               url: sc.url.replace("%s", encodeURIComponent(query)) };
    }
    if (looksLikeUrl(text) && !/^\d+(\.\d+){3}$/.test(text)) {   // a bare IP is searched, not opened
      return { label: `open ${text}`, url: /^https?:\/\//i.test(text) ? text : `https://${text}` };
    }
    return { label: `search: ${text}`, url: CONFIG.search + encodeURIComponent(text) };
  }

  q.addEventListener("input", () => {
    const text = q.value.trim();
    const r = resolve(text);
    const { sc, ddg, query } = text ? parse(text) : {};
    const named = sc ? sc.name : ddg;
    $("hint").textContent = r ? (named && !query ? `${named} …` : `↵ ${r.label}`) : "";
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
    kbd.textContent = "!" + key;
    span.append(kbd, ` ${sc.name}`);
    help.append(span);
  }
  const sep = document.createElement("span");
  sep.className = "sep";
  sep.textContent = "via DuckDuckGo";
  help.append(sep);
  for (const [key, name] of Object.entries(CONFIG.ddgBangs)) {
    const span = document.createElement("span");
    const kbd = document.createElement("kbd");
    kbd.textContent = "!" + key;
    span.append(kbd, ` ${name}`);
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
