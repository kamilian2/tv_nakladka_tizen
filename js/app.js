/*
 * TV Nakładka – wersja dla telewizorów Samsung (Tizen).
 *
 * Tizen nie pozwala zwykłym aplikacjom rysować nad innymi aplikacjami,
 * dlatego ta aplikacja sama pokazuje obraz telewizji (tuner) albo HDMI
 * na całym ekranie (tizen.tvwindow, warstwa POD stroną), a na nim:
 * zegar, 5 pól z encjami Home Assistanta i kamery pod przyciskami pilota.
 */
(function () {
  "use strict";

  // ======================= ustawienia =======================

  var SLOTS = ["e1", "e2", "e3", "e4", "e5"];
  var ELEMENTS = ["clock"].concat(SLOTS);
  var NAMES = { clock: "Zegar", e1: "Encja 1", e2: "Encja 2", e3: "Encja 3", e4: "Encja 4", e5: "Encja 5" };
  var SCALE = 2; // rozmiary jak w wersji na Androida (1 jednostka = 2 px na ekranie 1920×1080)

  var FONTS = [
    ["sans", "Zwykła"], ["sans-light", "Cienka"], ["sans-medium", "Średnia"], ["sans-black", "Gruba"],
    ["serif", "Szeryfowa"], ["mono", "Maszynowa"], ["rounded", "Zaokrąglona"],
    ["dseg7", "Cyfrowa 7-segmentowa"], ["dseg14", "Cyfrowa 14-segmentowa"]
  ];
  var COLORS = [
    ["#FFFFFF", "Biały"], ["#FFD54F", "Żółty"], ["#FFB74D", "Pomarańczowy"], ["#E57373", "Czerwony"],
    ["#81C784", "Zielony"], ["#4FC3F7", "Niebieski"], ["#CE93D8", "Fioletowy"], ["#B0BEC5", "Szary"], ["#000000", "Czarny"]
  ];
  var BACKGROUNDS = [
    ["#000000", "Czarne"], ["#0F2A3F", "Granatowe"], ["#37474F", "Grafitowe"],
    ["#1B5E20", "Zielone"], ["#B71C1C", "Czerwone"], ["#FFFFFF", "Białe"]
  ];
  var STYLES = [["solid", "Jednolite"], ["glass", "Szkło jasne (iOS)"], ["glass_dark", "Szkło ciemne (iOS)"], ["outline", "Ramka"]];
  var TRANSITIONS = [
    ["fade", "Zanikanie"], ["flip_x", "Obrót 3D w pionie"], ["flip_y", "Obrót 3D w poziomie"],
    ["zoom", "Powiększenie"], ["slide_up", "Przesunięcie w górę"], ["slide_left", "Przesunięcie w lewo"], ["none", "Bez animacji"]
  ];
  var FORMATS = ["HH:mm:ss", "HH:mm", "H:mm:ss", "HH:mm:ss  EEE", "EEE d MMM  HH:mm:ss", "d.MM.yyyy  HH:mm:ss"];
  var MODES = [["value", "Sama wartość"], ["name_value", "Nazwa + wartość"], ["name", "Sama nazwa"]];
  var SHOW_WHEN = [["always", "Zawsze"], ["above", "Wartość > próg"], ["below", "Wartość < próg"],
    ["equals", "Stan = próg/tekst"], ["not_equals", "Stan ≠ próg/tekst"]];

  function slotDefaults(n) {
    return {
      visible: true, x: 100, y: 1 + 8 * n, size: 24, font: "sans", bold: true,
      color: "#FFFFFF", background: "#000000", opacity: 60, text_opacity: 100, style: "solid", shadow: false,
      in_group: true,
      entity: "", label: "", icon: "", decimals: -1, unit: true, mode: "value",
      show_when: "always", threshold: 0, match: "",
      on_demand: false, demand_seconds: 10,
      entity2: "", label2: "", icon2: "", entity3: "", label3: "", icon3: "", entity4: "", label4: "", icon4: "",
      cycle_seconds: 5, transition: "fade", transition_ms: 600
    };
  }

  function defaults() {
    var d = {
      source: { type: "TV", number: 1, show: true },
      general: { margin: 24, group_dx: 0, group_dy: 0, back_closes: true },
      clock: {
        visible: true, x: 100, y: 0, size: 34, font: "sans-medium", bold: false,
        color: "#FFFFFF", background: "#000000", opacity: 60, text_opacity: 100, style: "solid", shadow: false,
        in_group: true, format: "HH:mm:ss", icon: ""
      },
      camera: { max_seconds: 30, width: 560, gap: 16, align: "center", bottom: 40 },
      ha: { url: "", token: "", interval: 5 },
      cams: {},
      keys: {}
    };
    SLOTS.forEach(function (s, i) { d[s] = slotDefaults(i + 1); });
    for (var i = 1; i <= 6; i++) { d.cams["c" + i + "_name"] = "Kamera " + i; d.cams["c" + i + "_url"] = ""; }
    var keyDefaults = [["ColorF0Red", "cams:all"], ["ColorF1Green", "show:all"], ["ColorF2Yellow", "none"],
      ["ColorF3Blue", "none"], ["", "none"], ["", "none"]];
    for (var k = 1; k <= 6; k++) {
      d.keys["k" + k + "_key"] = keyDefaults[k - 1][0];
      d.keys["k" + k + "_action"] = keyDefaults[k - 1][1];
    }
    return d;
  }

  var STORAGE = "tvnakladka_config";
  var bundled = {};   // config.json dołączony do aplikacji (np. adres i token HA)
  var stored = {};    // zmiany zrobione pilotem (localStorage)

  function merge(dst, src) {
    if (!src) return dst;
    Object.keys(src).forEach(function (sec) {
      if (typeof src[sec] !== "object" || src[sec] === null) return;
      dst[sec] = dst[sec] || {};
      Object.keys(src[sec]).forEach(function (k) { dst[sec][k] = src[sec][k]; });
    });
    return dst;
  }

  function cfg(sec) {
    var d = defaults();
    merge(d, bundled);
    merge(d, stored);
    return sec ? d[sec] : d;
  }

  function setValue(sec, key, value) {
    stored[sec] = stored[sec] || {};
    stored[sec][key] = value;
    try { localStorage.setItem(STORAGE, JSON.stringify(stored)); } catch (e) { /* brak miejsca */ }
    refreshAll();
    if (sec === "source") applySource();
    if (sec === "ha" || /^entity/.test(key)) haNow();
  }

  function resetSection(sec) {
    delete stored[sec];
    try { localStorage.setItem(STORAGE, JSON.stringify(stored)); } catch (e) {}
    refreshAll();
  }

  function loadStored() {
    try { stored = JSON.parse(localStorage.getItem(STORAGE) || "{}") || {}; } catch (e) { stored = {}; }
  }

  function loadBundled(done) {
    var x = new XMLHttpRequest();
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      try { bundled = JSON.parse(x.responseText) || {}; } catch (e) { bundled = {}; }
      done();
    };
    try { x.open("GET", "config.json", true); x.send(); } catch (e) { done(); }
  }

  // ======================= pomocnicze =======================

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s === undefined || s === null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function hexToRgb(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length === 8) h = h.slice(2);
    if (h.length !== 6) return [255, 255, 255];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgba(hex, alpha) {
    var c = hexToRgb(hex);
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.max(0, Math.min(1, alpha)).toFixed(3) + ")";
  }
  function mixRgba(hex, withHex, f, alpha) {
    var a = hexToRgb(hex), b = hexToRgb(withHex);
    var c = [0, 1, 2].map(function (i) { return Math.round(a[i] * (1 - f) + b[i] * f); });
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.max(0, Math.min(1, alpha)).toFixed(3) + ")";
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  var DAYS = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
  var DAYS_SHORT = ["nie", "pon", "wto", "śro", "czw", "pią", "sob"];
  var MONTHS_SHORT = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

  function formatDate(fmt, d) {
    return fmt.replace(/yyyy|MMM|MM|dd|d|HH|H|mm|ss|EEEE|EEE/g, function (t) {
      switch (t) {
        case "yyyy": return d.getFullYear();
        case "MMM": return MONTHS_SHORT[d.getMonth()];
        case "MM": return pad(d.getMonth() + 1);
        case "dd": return pad(d.getDate());
        case "d": return d.getDate();
        case "HH": return pad(d.getHours());
        case "H": return d.getHours();
        case "mm": return pad(d.getMinutes());
        case "ss": return pad(d.getSeconds());
        case "EEEE": return DAYS[d.getDay()];
        case "EEE": return DAYS_SHORT[d.getDay()];
      }
      return t;
    });
  }

  function fontCss(font, bold) {
    var map = {
      "sans": ["SamsungOne, Tizen, Roboto, sans-serif", bold ? 700 : 400],
      "sans-light": ["SamsungOne, Tizen, Roboto, sans-serif", 300],
      "sans-medium": ["SamsungOne, Tizen, Roboto, sans-serif", bold ? 800 : 500],
      "sans-black": ["SamsungOne, Tizen, Roboto, sans-serif", 900],
      "serif": ["Georgia, 'Times New Roman', serif", bold ? 700 : 400],
      "mono": ["'Courier New', monospace", bold ? 700 : 400],
      "rounded": ["'Comic Sans MS', 'Trebuchet MS', sans-serif", bold ? 700 : 400],
      "dseg7": ["DSEG7", 400],
      "dseg14": ["DSEG14", 400]
    };
    return map[font] || map.sans;
  }

  // ======================= komunikaty =======================

  function toast(title, msg, icon, seconds) {
    var t = el("div", "toast",
      (icon ? '<span class="mdi mdi-' + esc(icon.replace("mdi:", "")) + '"></span>' : "") +
      "<div>" + esc(title) + (msg ? "<small>" + esc(msg) + "</small>" : "") + "</div>");
    $("toasts").appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, (seconds || 4) * 1000);
  }

  // ======================= obraz TV / HDMI =======================

  function applySource() {
    var s = cfg("source");
    if (!window.tizen || !tizen.tvwindow) return;
    if (!s.show) { try { tizen.tvwindow.hide(function () {}, function () {}); } catch (e) {} return; }
    try {
      tizen.systeminfo.getPropertyValue("VIDEOSOURCE", function (info) {
        var list = (info.connected || []).concat(info.disconnected || []);
        var src = null;
        for (var i = 0; i < list.length; i++) {
          if (list[i].type === s.type && Number(list[i].number) === Number(s.number)) { src = list[i]; break; }
        }
        if (!src) {
          for (var j = 0; j < list.length; j++) if (list[j].type === s.type) { src = list[j]; break; }
        }
        if (!src) { toast("Brak źródła " + s.type + " " + s.number, "Zmień je w ustawieniach (OK)", "mdi:television-off"); return; }
        tizen.tvwindow.setSource(src, function () {
          tizen.tvwindow.show(function () {}, function (e) { toast("Nie można pokazać obrazu", e.message, "mdi:alert"); },
            ["0px", "0px", "1920px", "1080px"], "MAIN", "BEHIND");
        }, function (e) { toast("Nie można przełączyć źródła", e.message, "mdi:alert"); });
      }, function (e) { toast("Brak listy źródeł", e.message, "mdi:alert"); });
    } catch (e) {
      toast("Błąd obrazu TV", e.message, "mdi:alert");
    }
  }

  function channel(up) {
    if (!window.tizen || !tizen.tvchannel) return;
    try {
      var fn = up ? tizen.tvchannel.tuneUp : tizen.tvchannel.tuneDown;
      fn.call(tizen.tvchannel, {
        onsuccess: function () {}, onnosignal: function () {}, onprograminforeceived: function () {}
      }, function () {}, "ALL");
    } catch (e) { /* tylko dla źródła TV */ }
  }

  // ======================= zegar i pola =======================

  var nodes = {};     // name -> {pill, inner, icon, text}
  var contents = {};  // slot -> {items:[{text,icon,ok}], index, lastSwitch, animating}
  var demandShown = {};
  var demandTimers = {};
  var editMode = false;

  function buildStage() {
    var stage = $("stage");
    ELEMENTS.forEach(function (name) {
      var pill = el("div", "pill");
      var inner = el("div", "inner");
      var icon = el("span", "icon mdi");
      var text = el("span", "text");
      inner.appendChild(icon); inner.appendChild(text); pill.appendChild(inner); stage.appendChild(pill);
      nodes[name] = { pill: pill, inner: inner, icon: icon, text: text };
      if (name !== "clock") contents[name] = { items: [], index: 0, lastSwitch: 0, animating: false };
    });
  }

  function pool(name) {
    var c = contents[name];
    if (!c) return [];
    var forced = demandShown[name] || editMode;
    return c.items.filter(function (it) { return it.text && (it.ok || forced); });
  }

  function setIcon(node, icon) {
    var n = String(icon || "").replace("mdi:", "").trim();
    node.className = "icon mdi" + (n ? " mdi-" + n : "");
    node.style.display = n ? "" : "none";
  }

  function styleElement(name) {
    var n = nodes[name];
    if (!n) return;
    var c = cfg(name);
    var size = Number(c.size) * SCALE;
    var p = pool(name);
    var content = contents[name];
    var item = p.length ? p[(content ? content.index : 0) % p.length] : null;

    var color = rgba((item && item.color) || c.color, Number(c.text_opacity) / 100);
    var f = fontCss(c.font, c.bold);
    n.text.style.fontFamily = f[0];
    n.text.style.fontWeight = f[1];
    n.text.style.fontSize = size + "px";
    n.text.style.color = color;
    n.icon.style.fontSize = size + "px";
    n.icon.style.color = color;
    n.icon.style.marginRight = (size * 0.35) + "px";

    var style = c.style || "solid";
    var op = Number(c.opacity) / 100;
    var radius = size * 0.45;
    var pill = n.pill;
    pill.className = "pill " + style + ((c.shadow || style.indexOf("glass") === 0) ? " shadow" : "") + (editMode ? " edit" : "");
    pill.style.borderRadius = radius + "px";
    pill.style.padding = (size * 0.22) + "px " + (size * 0.5) + "px";
    pill.style.border = "none";
    pill.style.boxShadow = "none";
    if (style === "glass") {
      pill.style.background = "linear-gradient(180deg," + mixRgba(c.background, "#FFFFFF", 0.55, op + 0.28) + "," +
        mixRgba(c.background, "#FFFFFF", 0.25, op + 0.08) + "," + mixRgba(c.background, "#FFFFFF", 0.1, op) + ")";
      pill.style.border = "1.5px solid rgba(255,255,255,.6)";
      pill.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.7), 0 8px 24px rgba(0,0,0,.25)";
    } else if (style === "glass_dark") {
      pill.style.background = "linear-gradient(180deg," + mixRgba(c.background, "#FFFFFF", 0.22, op + 0.12) + "," +
        mixRgba(c.background, "#000000", 0.2, op) + "," + mixRgba(c.background, "#000000", 0.45, op + 0.08) + ")";
      pill.style.border = "1.2px solid rgba(255,255,255,.35)";
      pill.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.35), 0 8px 24px rgba(0,0,0,.35)";
    } else if (style === "outline") {
      pill.style.background = rgba(c.background, op / 3);
      pill.style.border = "2px solid " + rgba(c.color, 1);
    } else {
      pill.style.background = rgba(c.background, op);
    }

    var show;
    if (name === "clock") {
      n.text.textContent = formatDate(c.format || "HH:mm:ss", new Date());
      setIcon(n.icon, c.icon);
      show = !!c.visible;
    } else {
      var forced = !!demandShown[name];
      var demandOk = !c.on_demand || forced || editMode;
      var visibleOk = c.visible || forced;
      show = visibleOk && demandOk && (item || editMode);
      n.text.textContent = item ? item.text : (editMode ? NAMES[name] : "");
      setIcon(n.icon, item ? item.icon : "");
    }
    pill.style.display = show ? "flex" : "none";
    position(name);
  }

  function position(name) {
    var n = nodes[name];
    if (!n || n.pill.style.display === "none") return;
    var c = cfg(name), g = cfg("general");
    var m = Number(g.margin) * SCALE;
    var w = n.pill.offsetWidth, h = n.pill.offsetHeight;
    var freeW = Math.max(0, 1920 - 2 * m - w), freeH = Math.max(0, 1080 - 2 * m - h);
    var x = m + freeW * Math.max(0, Math.min(100, Number(c.x))) / 100;
    var y = m + freeH * Math.max(0, Math.min(100, Number(c.y))) / 100;
    if (c.in_group) {
      x += Number(g.group_dx) / 100 * (1920 - 2 * m);
      y += Number(g.group_dy) / 100 * (1080 - 2 * m);
      x = Math.max(m, Math.min(m + freeW, x));
      y = Math.max(m, Math.min(m + freeH, y));
    }
    n.pill.style.left = Math.round(x) + "px";
    n.pill.style.top = Math.round(y) + "px";
  }

  function refreshAll() {
    ELEMENTS.forEach(styleElement);
    applyCameraLayout();
  }

  function tickClock() {
    var c = cfg("clock");
    if (nodes.clock && c.visible) {
      var t = formatDate(c.format || "HH:mm:ss", new Date());
      if (nodes.clock.text.textContent !== t) {
        var oldW = nodes.clock.pill.offsetWidth;
        nodes.clock.text.textContent = t;
        if (nodes.clock.pill.offsetWidth !== oldW) position("clock");
      }
    }
    setTimeout(tickClock, 1000 - (Date.now() % 1000) + 10);
  }

  // ---------- zmiana encji z animacją ----------

  function animateNext(name) {
    var n = nodes[name], content = contents[name], c = cfg(name);
    var half = Math.max(50, Math.min(1500, Number(c.transition_ms) / 2));
    var type = c.transition || "fade";
    var p = n.pill, inner = n.inner;
    content.animating = true;

    function advance() { content.index++; styleElement(name); }
    function setT(e, ms) { e.style.transitionDuration = ms + "ms"; }
    function after(ms, fn) { setTimeout(fn, ms + 20); }
    function done() { content.animating = false; }

    if (type === "none") { advance(); done(); return; }

    var out, inStart;
    var target = (type === "slide_up" || type === "slide_left") ? inner : p;
    switch (type) {
      case "flip_x": out = "perspective(800px) rotateX(90deg)"; inStart = "perspective(800px) rotateX(-90deg)"; break;
      case "flip_y": out = "perspective(800px) rotateY(90deg)"; inStart = "perspective(800px) rotateY(-90deg)"; break;
      case "zoom": out = "scale(0.01)"; inStart = "scale(0.01)"; break;
      case "slide_up": out = "translateY(-120%)"; inStart = "translateY(120%)"; break;
      case "slide_left": out = "translateX(-120%)"; inStart = "translateX(120%)"; break;
      default: out = "none"; inStart = "none";
    }
    setT(target, half);
    target.style.transform = out;
    target.style.opacity = "0";
    after(half, function () {
      advance();
      setT(target, 0);
      target.style.transform = inStart;
      void target.offsetWidth; // wymuś przeliczenie przed animacją powrotu
      setT(target, half);
      target.style.transform = "none";
      target.style.opacity = "1";
      after(half, done);
    });
  }

  function cycleTick() {
    var now = Date.now();
    SLOTS.forEach(function (name) {
      var content = contents[name];
      if (!content || content.animating || nodes[name].pill.style.display === "none") return;
      if (pool(name).length < 2) return;
      var every = Math.max(1, Number(cfg(name).cycle_seconds)) * 1000;
      if (now - content.lastSwitch >= every) {
        content.lastSwitch = now;
        animateNext(name);
      }
    });
  }

  function setItems(slot, items) {
    var c = contents[slot];
    var same = c.items.length === items.length && c.items.every(function (x, i) {
      return x.text === items[i].text && x.icon === items[i].icon && x.ok === items[i].ok;
    });
    if (same) return;
    c.items = items;
    if (!c.animating) styleElement(slot);
  }

  // ---------- pola na żądanie ----------

  function toggleDemand(slot, forceShow) {
    if (SLOTS.indexOf(slot) < 0) return;
    clearTimeout(demandTimers[slot]);
    if (demandShown[slot] && !forceShow) {
      delete demandShown[slot];
    } else {
      demandShown[slot] = true;
      var secs = Number(cfg(slot).demand_seconds);
      if (secs > 0) demandTimers[slot] = setTimeout(function () { delete demandShown[slot]; styleElement(slot); }, secs * 1000);
      haNow();
      if (!contents[slot].items.length) toast(NAMES[slot], "Brak danych – przypisz encję HA do tego pola", "mdi:alert-circle-outline");
    }
    styleElement(slot);
  }

  // ======================= Home Assistant =======================

  var haStatus = "Nie skonfigurowano";
  var slotStatus = {};
  var haBusy = false;
  var haLast = 0;

  function haNow() { haLast = 0; }

  function haGet(url, token, ok, fail) {
    var x = new XMLHttpRequest();
    x.timeout = 8000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      if (x.status === 401) return fail("zły token (401)");
      if (x.status === 404) return fail("nie znaleziono (404) – sprawdź nazwę encji");
      if (x.status < 200 || x.status > 299) return fail(x.status ? "HTTP " + x.status : "brak połączenia z HA");
      try { ok(JSON.parse(x.responseText)); } catch (e) { fail("zła odpowiedź"); }
    };
    x.ontimeout = function () { fail("przekroczono czas"); };
    try {
      x.open("GET", url, true);
      x.setRequestHeader("Authorization", "Bearer " + token);
      x.send();
    } catch (e) { fail(e.message); }
  }

  function formatState(st, c, suf) {
    var raw = String(st.state === undefined ? "" : st.state);
    var attrs = st.attributes || {};
    var num = parseFloat(raw.replace(",", "."));
    var isNum = raw !== "" && !isNaN(num) && isFinite(raw.replace(",", "."));
    var th = Number(c.threshold), match = String(c.match || "").trim();
    var show = true;
    switch (c.show_when) {
      case "above": show = isNum && num > th; break;
      case "below": show = isNum && num < th; break;
      case "equals": show = match ? raw.toLowerCase() === match.toLowerCase() : isNum && num === th; break;
      case "not_equals": show = match ? raw.toLowerCase() !== match.toLowerCase() : !(isNum && num === th); break;
    }
    var unit = c.unit ? (attrs.unit_of_measurement || "") : "";
    var value;
    if (raw === "unavailable" || raw === "unknown") value = "—";
    else if (raw === "on") value = "wł.";
    else if (raw === "off") value = "wył.";
    else if (Number(c.decimals) >= 0 && isNum) value = num.toFixed(Number(c.decimals)).replace(".", ",");
    else value = raw;
    var valueText = [value, unit].filter(Boolean).join(" ");
    var name = String(c["label" + suf] || "").trim() || attrs.friendly_name || "";
    var text = c.mode === "name" ? (name || valueText) : c.mode === "name_value" ? [name, valueText].filter(Boolean).join(" ") : valueText;
    return { text: text, ok: show, icon: String(c["icon" + suf] || "").trim() || attrs.icon || "" };
  }

  function haPoll() {
    var h = cfg("ha");
    var url = String(h.url || "").trim().replace(/\/+$/, ""), token = String(h.token || "").trim();
    var suffixes = ["", "2", "3", "4"];
    var jobs = [];
    SLOTS.forEach(function (slot) {
      var c = cfg(slot);
      var ents = suffixes.filter(function (s) { return String(c["entity" + s] || "").trim(); });
      if (!ents.length) { slotStatus[slot] = "brak encji"; return; }
      jobs.push({ slot: slot, c: c, suffixes: ents });
    });
    if (!jobs.length) { haStatus = "Brak przypisanych encji"; return; }
    if (!url || !token) { haStatus = "Podaj adres i token Home Assistanta"; return; }

    haBusy = true;
    var pending = 0, errors = 0;
    jobs.forEach(function (job) {
      var results = new Array(job.suffixes.length), info = new Array(job.suffixes.length), left = job.suffixes.length;
      job.suffixes.forEach(function (suf, i) {
        var entity = String(job.c["entity" + suf]).trim();
        pending++;
        haGet(url + "/api/states/" + encodeURIComponent(entity), token, function (st) {
          var r = formatState(st, job.c, suf);
          results[i] = r;
          info[i] = entity + " = " + st.state + " → „" + r.text + "”" + (r.ok ? "" : " (ukryte – warunek)");
          finish();
        }, function (msg) {
          errors++;
          haStatus = "Błąd (" + entity + "): " + msg;
          results[i] = { text: "—", icon: "mdi:alert-circle-outline", ok: true };
          info[i] = entity + " → błąd: " + msg;
          finish();
        });
        function finish() {
          pending--; left--;
          if (left === 0) {
            slotStatus[job.slot] = info.join("  |  ");
            setItems(job.slot, results);
          }
          if (pending === 0) {
            haBusy = false;
            if (!errors) haStatus = "OK – ostatnie pobranie " + formatDate("HH:mm:ss", new Date());
            if (menuOpen) renderRowsKeepFocus();
          }
        }
      });
    });
  }

  function haTick() {
    var every = Math.max(1, Number(cfg("ha").interval)) * 1000;
    if (!haBusy && Date.now() - haLast >= every) {
      haLast = Date.now();
      haPoll();
    }
  }

  // ======================= kamery =======================

  var camTimer = null, camAction = null, camRefresh = [];

  function stopCameras() {
    clearTimeout(camTimer);
    camRefresh.forEach(clearInterval);
    camRefresh = [];
    camAction = null;
    var box = $("cameras");
    box.innerHTML = "";
  }

  function camerasActive() { return $("cameras").children.length > 0; }

  function applyCameraLayout() {
    var c = cfg("camera");
    var box = $("cameras");
    box.style.justifyContent = c.align === "start" ? "flex-start" : c.align === "end" ? "flex-end" : "center";
    box.style.bottom = (Number(c.bottom) * SCALE / 2) + "px";
    var w = Number(c.width) * SCALE / 2 * 1.4;
    Array.prototype.forEach.call(box.children, function (cell, i) {
      cell.style.width = w + "px";
      cell.style.height = Math.round(w * 9 / 16) + "px";
      cell.style.marginLeft = i ? (Number(c.gap) + "px") : "0";
    });
  }

  function showCameras(urls) {
    stopCameras();
    var box = $("cameras");
    urls.forEach(function (url) {
      var cell = el("div", "cam");
      if (/^rtsp:/i.test(url)) {
        cell.appendChild(el("div", "msg", "RTSP nie działa na Samsungu.<br>Użyj adresu z go2rtc (MJPEG lub HLS) – instrukcja w README."));
      } else if (/\.m3u8(\?|$)/i.test(url) || /stream\.m3u8/i.test(url)) {
        var v = el("video");
        v.autoplay = true; v.muted = true; v.setAttribute("playsinline", ""); v.src = url;
        cell.appendChild(v);
        try { v.play(); } catch (e) {}
      } else {
        var img = el("img");
        img.src = url;
        img.onerror = function () { cell.innerHTML = '<div class="msg">Brak obrazu z kamery</div>'; };
        cell.appendChild(img);
        // pojedyncze zdjęcie (np. go2rtc frame.jpeg) – odświeżaj co sekundę
        if (/frame\.jpe?g|snapshot|\.jpe?g(\?|$)/i.test(url)) {
          camRefresh.push(setInterval(function () {
            img.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "_t=" + Date.now();
          }, 1000));
        }
      }
      box.appendChild(cell);
    });
    applyCameraLayout();
    var max = Number(cfg("camera").max_seconds);
    if (max > 0) camTimer = setTimeout(stopCameras, max * 1000);
  }

  function savedCamUrls(ids) {
    var cams = cfg("cams");
    return ids.map(function (id) { return String(cams[id + "_url"] || "").trim(); }).filter(Boolean);
  }

  // ======================= przyciski pilota =======================

  // przyciski, które aplikacja przejmuje (jeśli telewizor je ma)
  var WANTED_KEYS = [
    "ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue",
    "MediaPlayPause", "MediaPlay", "MediaPause", "MediaStop", "MediaRewind", "MediaFastForward",
    "MediaRecord", "MediaTrackPrevious", "MediaTrackNext",
    "ChannelUp", "ChannelDown", "Info", "Caption", "Extra", "PictureSize", "Teletext", "Search", "Guide"
  ];
  var keyNames = {};   // keyCode -> nazwa
  var keyCodes = {};   // nazwa -> keyCode
  var learning = null;

  function registerKeys() {
    if (!window.tizen || !tizen.tvinputdevice) return;
    try {
      tizen.tvinputdevice.getSupportedKeys().forEach(function (k) {
        keyNames[k.code] = k.name; keyCodes[k.name] = k.code;
      });
    } catch (e) {}
    WANTED_KEYS.forEach(function (k) {
      if (keyCodes[k] !== undefined) { try { tizen.tvinputdevice.registerKey(k); } catch (e) {} }
    });
  }

  var KEY_LABELS = {
    ColorF0Red: "Czerwony", ColorF1Green: "Zielony", ColorF2Yellow: "Żółty", ColorF3Blue: "Niebieski",
    MediaPlayPause: "Odtwórz/Pauza", MediaPlay: "Odtwórz", MediaPause: "Pauza", MediaStop: "Stop",
    MediaRewind: "Przewiń do tyłu", MediaFastForward: "Przewiń do przodu", MediaRecord: "Nagrywanie",
    Info: "Info", Caption: "Napisy", Extra: "Extra", PictureSize: "Format obrazu", Teletext: "Teletekst",
    Search: "Szukaj", Guide: "Przewodnik"
  };
  function keyLabel(name) { return name ? (KEY_LABELS[name] || name) : "nie przypisano"; }

  function keyActions() {
    var cams = cfg("cams");
    var list = [["none", "Brak"]];
    for (var i = 1; i <= 6; i++) list.push(["cam:c" + i, cams["c" + i + "_name"] || ("Kamera " + i)]);
    list.push(["cams:all", "Wszystkie kamery"], ["stop", "Zamknij kamery"]);
    SLOTS.forEach(function (s) {
      var c = cfg(s);
      list.push(["show:" + s, "Pokaż: " + (c.label || c.entity || NAMES[s])]);
    });
    list.push(["show:all", "Pokaż wszystkie pola „na żądanie”"]);
    return list;
  }

  function runAction(action) {
    if (!action || action === "none") return;
    if (action.indexOf("show:") === 0) {
      var what = action.slice(5);
      if (what === "all") {
        var list = SLOTS.filter(function (s) { return cfg(s).on_demand; });
        var any = list.some(function (s) { return demandShown[s]; });
        list.forEach(function (s) { if (any) { if (demandShown[s]) toggleDemand(s); } else toggleDemand(s, true); });
      } else toggleDemand(what);
      return;
    }
    if (action === "stop" || (camerasActive() && camAction === action)) { stopCameras(); return; }
    var ids = action.indexOf("cam:") === 0 ? [action.slice(4)] :
      action === "cams:all" ? ["c1", "c2", "c3", "c4", "c5", "c6"] : [];
    var urls = savedCamUrls(ids);
    if (!urls.length) { toast("Brak adresu kamery", "Ustaw go: OK → Kamery", "mdi:cctv-off"); return; }
    showCameras(urls);
    camAction = action;
  }

  function keyName(e) {
    if (keyNames[e.keyCode]) return keyNames[e.keyCode];
    var map = { 13: "Enter", 37: "ArrowLeft", 38: "ArrowUp", 39: "ArrowRight", 40: "ArrowDown", 10009: "Back", 8: "Back", 27: "Back" };
    return map[e.keyCode] || e.key || String(e.keyCode);
  }

  document.addEventListener("keydown", function (e) {
    var k = keyName(e);

    if (textEditing) return; // klawiatura ekranowa obsługuje się sama

    if (learning) {
      e.preventDefault();
      if (k === "Back") { learning = null; toast("Anulowano", "", "mdi:remote", 2); return; }
      if (["Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(k) >= 0) {
        toast("Ten przycisk obsługuje menu", "Wybierz inny (np. kolorowy)", "mdi:remote", 3); return;
      }
      setValue("keys", learning + "_key", k);
      toast("Zapisano przycisk", keyLabel(k), "mdi:check-circle", 3);
      learning = null;
      if (menuOpen) renderRowsKeepFocus();
      return;
    }

    if (menuOpen) { e.preventDefault(); menuKey(k); return; }

    // zwykłe oglądanie
    if (k === "Enter") { e.preventDefault(); openMenu(); return; }
    if (k === "Back") {
      e.preventDefault();
      if (camerasActive() && cfg("general").back_closes) { stopCameras(); return; }
      if (Object.keys(demandShown).length) { demandShown = {}; refreshAll(); return; }
      try { tizen.application.getCurrentApplication().exit(); } catch (err) {}
      return;
    }
    var keys = cfg("keys");
    for (var i = 1; i <= 6; i++) {
      if (keys["k" + i + "_key"] === k && keys["k" + i + "_action"] !== "none") {
        e.preventDefault(); runAction(keys["k" + i + "_action"]); return;
      }
    }
    if (k === "ChannelUp") { channel(true); return; }
    if (k === "ChannelDown") { channel(false); return; }
  });

  // ======================= menu ustawień (pilot) =======================

  var menuOpen = false;
  var section = "clock";
  var focusArea = "sections"; // "sections" | "rows"
  var sectionIdx = 0, rowIdx = 0;
  var rowDefs = [];
  var textEditing = false;

  var SECTIONS = [
    ["clock", "Zegar"], ["e1", "Encja 1"], ["e2", "Encja 2"], ["e3", "Encja 3"], ["e4", "Encja 4"], ["e5", "Encja 5"],
    ["group", "Przesuń wszystko"], ["source", "Obraz w tle"], ["camera", "Kamery"], ["keys", "Pilot"],
    ["ha", "Home Assistant"], ["other", "Inne"]
  ];

  function openMenu() {
    menuOpen = true; editMode = true;
    $("menu").classList.remove("hidden");
    focusArea = "sections";
    renderSections(); renderRows();
    refreshAll();
  }
  function closeMenu() {
    menuOpen = false; editMode = false;
    $("menu").classList.add("hidden");
    refreshAll();
  }

  function renderSections() {
    var box = $("sections");
    box.innerHTML = "";
    SECTIONS.forEach(function (s, i) {
      var d = el("div", "section" + (s[0] === section ? " active" : "") + (focusArea === "sections" && i === sectionIdx ? " focus" : ""), esc(s[1]));
      box.appendChild(d);
    });
  }

  // definicje wierszy: {type, label, sec, key, ...}
  function num(label, sec, key, min, max, step, big) { return { type: "num", label: label, sec: sec, key: key, min: min, max: max, step: step, big: big || step * 5 }; }
  function choice(label, sec, key, opts) { return { type: "choice", label: label, sec: sec, key: key, opts: opts }; }
  function toggle(label, sec, key) { return { type: "toggle", label: label, sec: sec, key: key }; }
  function text(label, sec, key, secret) { return { type: "text", label: label, sec: sec, key: key, secret: secret }; }
  function action(label, value, fn) { return { type: "action", label: label, value: value, fn: fn }; }
  function note(label) { return { type: "note", label: label }; }

  function buildRows() {
    var r = [];
    var s = section;
    if (s === "clock" || SLOTS.indexOf(s) >= 0) {
      r.push(toggle("Widoczny", s, "visible"),
        num("Poziomo (0 = lewo, 100 = prawo)", s, "x", 0, 100, 1, 5),
        num("Pionowo (0 = góra, 100 = dół)", s, "y", 0, 100, 1, 5),
        num("Wielkość czcionki", s, "size", 10, 160, 1, 5),
        choice("Krój czcionki", s, "font", FONTS),
        toggle("Pogrubienie", s, "bold"),
        choice("Kolor tekstu", s, "color", COLORS),
        num("Krycie tekstu %", s, "text_opacity", 5, 100, 5, 20),
        toggle("Cień pod tekstem", s, "shadow"),
        choice("Styl tła", s, "style", STYLES),
        choice("Kolor tła", s, "background", BACKGROUNDS),
        num("Krycie tła % (0 = bez tła)", s, "opacity", 0, 100, 5, 20),
        toggle("Przesuwaj razem z innymi", s, "in_group"));
      if (s === "clock") {
        r.push(choice("Format", s, "format", FORMATS.map(function (f) { return [f, f]; })));
      } else {
        r.push(note("Encja z Home Assistanta"),
          text("Encja", s, "entity"), text("Własna nazwa (puste = z HA)", s, "label"), text("Ikona (np. mdi:thermometer)", s, "icon"),
          choice("Co pokazać", s, "mode", MODES),
          num("Miejsca po przecinku (-1 = bez zmian)", s, "decimals", -1, 3, 1, 1),
          toggle("Pokaż jednostkę", s, "unit"),
          choice("Kiedy pokazywać", s, "show_when", SHOW_WHEN),
          num("Próg", s, "threshold", -1000, 100000, 1, 10),
          text("Stan tekstowy (np. on)", s, "match"),
          toggle("Tylko na żądanie (przycisk pilota)", s, "on_demand"),
          num("Na żądanie – czas (s, 0 = do ponownego naciśnięcia)", s, "demand_seconds", 0, 300, 1, 10),
          note("Kolejne encje w tym polu (zmiana z animacją)"),
          text("Encja 2", s, "entity2"), text("Encja 3", s, "entity3"), text("Encja 4", s, "entity4"),
          num("Zmiana co (s)", s, "cycle_seconds", 1, 120, 1, 5),
          choice("Animacja", s, "transition", TRANSITIONS),
          num("Czas animacji (ms)", s, "transition_ms", 100, 3000, 100, 500),
          note("Stan: " + (slotStatus[s] || haStatus)));
      }
    } else if (s === "group") {
      r.push(note("Przesuwa zegar i encje razem – ich układ względem siebie się nie zmienia."),
        num("W lewo (−) / w prawo (+) %", "general", "group_dx", -100, 100, 1, 5),
        num("W górę (−) / w dół (+) %", "general", "group_dy", -100, 100, 1, 5));
      ELEMENTS.forEach(function (n) { r.push(toggle("Przesuwaj: " + NAMES[n], n, "in_group")); });
      r.push(action("Zapisz położenie na stałe", "Zapisz", applyGroupOffset),
        action("Wyzeruj przesunięcie", "Wyzeruj", function () { setValue("general", "group_dx", 0); setValue("general", "group_dy", 0); }));
    } else if (s === "source") {
      r.push(toggle("Pokazuj obraz w tle", "source", "show"),
        choice("Źródło", "source", "type", [["TV", "Telewizja (tuner)"], ["HDMI", "HDMI"]]),
        num("Numer wejścia HDMI", "source", "number", 1, 4, 1, 1),
        note("Kanały przełączasz przyciskami P+ / P− (tylko dla źródła TV)."));
    } else if (s === "camera") {
      r.push(num("Szerokość okienka", "camera", "width", 200, 1200, 10, 50),
        num("Odstęp", "camera", "gap", 0, 80, 2, 10),
        choice("Wyrównanie na dole", "camera", "align", [["start", "Do lewej"], ["center", "Na środku"], ["end", "Do prawej"]]),
        num("Odległość od dołu", "camera", "bottom", 0, 400, 4, 20),
        num("Maksymalny czas (s)", "camera", "max_seconds", 5, 120, 1, 5),
        toggle("Wstecz zamyka kamery", "general", "back_closes"),
        note("Adresy: MJPEG lub HLS z go2rtc, np. http://IP_HA:1984/api/stream.mjpeg?src=brama"));
      for (var i = 1; i <= 6; i++) {
        (function (i) {
          r.push(text("Kamera " + i + " – nazwa", "cams", "c" + i + "_name"),
            text("Kamera " + i + " – adres", "cams", "c" + i + "_url"),
            action("Kamera " + i + " – pokaż", "Pokaż", function () { closeMenu(); runAction("cam:c" + i); }));
        })(i);
      }
    } else if (s === "keys") {
      var acts = keyActions();
      for (var k = 1; k <= 6; k++) {
        (function (k) {
          var name = cfg("keys")["k" + k + "_key"];
          r.push(action("Przycisk " + k + ": " + keyLabel(name), "Naucz", function () {
            learning = "k" + k;
            toast("Naciśnij przycisk na pilocie", "np. kolorowy · WSTECZ = anuluj", "mdi:remote", 5);
          }));
          r.push(choice("   akcja", "keys", "k" + k + "_action", acts));
        })(k);
      }
      r.push(note("Przyciski działają, gdy aplikacja jest otwarta. Ponowne naciśnięcie zamyka kamerę lub pole."));
    } else if (s === "ha") {
      r.push(text("Adres HA (np. http://192.168.1.10:8123)", "ha", "url"),
        text("Token (długoterminowy)", "ha", "token", true),
        num("Odświeżanie co (s)", "ha", "interval", 1, 300, 1, 10),
        note("Stan: " + haStatus),
        note("Adres i token wygodniej wpisać w pliku config.json przed instalacją (README)."));
    } else if (s === "other") {
      r.push(num("Margines od krawędzi ekranu", "general", "margin", 0, 120, 2, 10),
        action("Ustawienia domyślne – wszystko", "Przywróć", function () {
          stored = {}; try { localStorage.removeItem(STORAGE); } catch (e) {}
          refreshAll(); applySource(); renderRows();
        }),
        action("Zamknij aplikację", "Zamknij", function () { try { tizen.application.getCurrentApplication().exit(); } catch (e) {} }));
    }
    if (s === "clock" || SLOTS.indexOf(s) >= 0 || s === "camera") {
      r.push(action("Domyślne – ta sekcja", "Przywróć", function () { resetSection(s); renderRows(); }));
    }
    return r;
  }

  function optLabel(opts, v) {
    for (var i = 0; i < opts.length; i++) if (String(opts[i][0]).toLowerCase() === String(v).toLowerCase()) return opts[i][1];
    return v;
  }

  function rowValue(d) {
    if (d.type === "note") return "";
    if (d.type === "action") return d.value;
    var v = cfg(d.sec)[d.key];
    if (d.type === "toggle") return v ? "Tak" : "Nie";
    if (d.type === "choice") return optLabel(d.opts, v);
    if (d.type === "text") return v ? (d.secret ? "••••••" + String(v).slice(-4) : v) : "(puste)";
    return v;
  }

  function renderRows() {
    rowDefs = buildRows();
    var info = { clock: "Wygląd i położenie zegara.", group: "", source: "Co ma być widać pod nakładką.",
      camera: "Kamery pokazują się na dole ekranu.", keys: "Przypisz przyciski pilota do kamer i pól.",
      ha: "Połączenie z Home Assistantem.", other: "" };
    $("section-title").textContent = optLabel(SECTIONS, section);
    $("section-info").textContent = SLOTS.indexOf(section) >= 0 ? "Wygląd, położenie i encja z Home Assistanta." : (info[section] || "");
    var box = $("rows");
    box.innerHTML = "";
    rowDefs.forEach(function (d, i) {
      var cls = "row" + (d.type === "note" ? " note" : "") + (d.type === "action" ? " action" : "") +
        (focusArea === "rows" && i === rowIdx ? " focus" : "");
      var arrows = (d.type === "num" || d.type === "choice") ? '<span class="arrows">◀ ▶</span>' : "";
      box.appendChild(el("div", cls, "<span>" + esc(d.label) + "</span><span><span class='val'>" + esc(rowValue(d)) + "</span>" + arrows + "</span>"));
    });
    scrollToFocus();
  }

  function renderRowsKeepFocus() { var keep = rowIdx; renderRows(); rowIdx = Math.min(keep, rowDefs.length - 1); scrollToFocus(); }

  function scrollToFocus() {
    var box = $("rows");
    var f = box.children[rowIdx];
    if (!f || focusArea !== "rows") { box.scrollTop = 0; return; }
    var top = f.offsetTop, bottom = top + f.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = top - 10;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight + 10;
  }

  function moveRow(dir) {
    var i = rowIdx;
    do { i += dir; } while (i >= 0 && i < rowDefs.length && rowDefs[i].type === "note");
    if (i >= 0 && i < rowDefs.length) rowIdx = i;
    renderRows();
  }

  function changeValue(d, dir, big) {
    var c = cfg(d.sec);
    if (d.type === "num") {
      var v = Number(c[d.key]) + dir * (big ? d.big : d.step);
      v = Math.max(d.min, Math.min(d.max, Math.round(v * 100) / 100));
      setValue(d.sec, d.key, v);
    } else if (d.type === "choice") {
      var idx = 0;
      for (var i = 0; i < d.opts.length; i++) if (String(d.opts[i][0]).toLowerCase() === String(c[d.key]).toLowerCase()) idx = i;
      idx = (idx + dir + d.opts.length) % d.opts.length;
      setValue(d.sec, d.key, d.opts[idx][0]);
    } else if (d.type === "toggle") {
      setValue(d.sec, d.key, !c[d.key]);
    }
    renderRowsKeepFocus();
  }

  function editText(d) {
    var input = $("textinput");
    textEditing = true;
    input.value = cfg(d.sec)[d.key] || "";
    input.className = "show";
    input.focus();
    function finish(save) {
      input.onkeydown = null; input.onblur = null;
      input.className = "";
      input.blur();
      textEditing = false;
      if (save) setValue(d.sec, d.key, input.value.trim());
      renderRowsKeepFocus();
    }
    input.onkeydown = function (e) {
      var k = keyName(e);
      if (k === "Enter" || e.keyCode === 65376) { e.preventDefault(); finish(true); }       // Gotowe
      else if (k === "Back" || e.keyCode === 65385) { e.preventDefault(); finish(false); }  // Anuluj
    };
    input.onblur = function () { if (textEditing) finish(true); };
  }

  function menuKey(k) {
    if (focusArea === "sections") {
      if (k === "ArrowUp") sectionIdx = Math.max(0, sectionIdx - 1);
      else if (k === "ArrowDown") sectionIdx = Math.min(SECTIONS.length - 1, sectionIdx + 1);
      else if (k === "ArrowRight" || k === "Enter") {
        focusArea = "rows"; rowIdx = -1; moveRow(1);
      } else if (k === "Back") { closeMenu(); return; }
      section = SECTIONS[sectionIdx][0];
      renderSections(); if (focusArea === "sections") renderRows();
      return;
    }
    var d = rowDefs[rowIdx];
    if (k === "ArrowUp") moveRow(-1);
    else if (k === "ArrowDown") moveRow(1);
    else if (k === "Back") { focusArea = "sections"; renderSections(); renderRows(); }
    else if (!d) return;
    else if (k === "ArrowLeft" || k === "ArrowRight") {
      if (d.type === "num" || d.type === "choice" || d.type === "toggle") changeValue(d, k === "ArrowRight" ? 1 : -1, false);
      else if (k === "ArrowLeft") { focusArea = "sections"; renderSections(); renderRows(); }
    } else if (k === "MediaFastForward" || k === "MediaRewind") {
      if (d.type === "num") changeValue(d, k === "MediaFastForward" ? 1 : -1, true);
    } else if (k === "Enter") {
      if (d.type === "toggle") changeValue(d, 1);
      else if (d.type === "choice") changeValue(d, 1);
      else if (d.type === "text") editText(d);
      else if (d.type === "action") { d.fn(); if (menuOpen) renderRowsKeepFocus(); }
    }
  }

  function applyGroupOffset() {
    var g = cfg("general"), m = Number(g.margin) * SCALE;
    ELEMENTS.forEach(function (n) {
      var c = cfg(n);
      if (!c.in_group) return;
      var p = nodes[n].pill;
      var freeW = Math.max(1, 1920 - 2 * m - p.offsetWidth), freeH = Math.max(1, 1080 - 2 * m - p.offsetHeight);
      stored[n] = stored[n] || {};
      if (p.style.display !== "none") {
        stored[n].x = Math.round(Math.max(0, Math.min(100, (parseFloat(p.style.left) - m) / freeW * 100)) * 10) / 10;
        stored[n].y = Math.round(Math.max(0, Math.min(100, (parseFloat(p.style.top) - m) / freeH * 100)) * 10) / 10;
      } else {
        stored[n].x = Math.max(0, Math.min(100, Number(c.x) + Number(g.group_dx)));
        stored[n].y = Math.max(0, Math.min(100, Number(c.y) + Number(g.group_dy)));
      }
    });
    setValue("general", "group_dx", 0);
    setValue("general", "group_dy", 0);
    toast("Zapisano położenie", "", "mdi:check-circle", 2);
  }

  // ======================= start =======================

  function start() {
    loadStored();
    loadBundled(function () {
      buildStage();
      registerKeys();
      refreshAll();
      applySource();
      tickClock();
      setInterval(cycleTick, 500);
      setInterval(haTick, 1000);
      $("hint").classList.remove("hidden");
      setTimeout(function () { $("hint").classList.add("hidden"); }, 6000);
      // po powrocie do aplikacji pokaż obraz ponownie
      document.addEventListener("visibilitychange", function () { if (!document.hidden) applySource(); });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  // do testów w przeglądarce
  window.TvNakladka = { cfg: cfg, setValue: setValue, runAction: runAction, toggleDemand: toggleDemand, setItems: setItems,
    openMenu: openMenu, menuKey: menuKey, contents: contents };
})();
