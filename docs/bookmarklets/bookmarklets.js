// Config de bookmarklets (archivo, título y descripción)
const BOOKMARKLETS = [
  {
    key: "check-code",
    title: "check-code",
    emoji: "✅",
    desc: "Valida/inspecciona datos en la página de carga y muestra un resumen.",
    path: "./scripts/check-code.js",
    tag: "Utilidad"
  },
  {
    key: "copy-code",
    title: "copy-code",
    emoji: "📋",
    desc: "Copia al portapapeles el texto formateado (número, origen → destino).",
    path: "./scripts/copy-code.js",
    tag: "Clipboard"
  },
  {
    key: "board-assistant",
    title: "board-assistant",
    emoji: "🧭",
    desc: "Acciones rápidas sobre el board: abrir cargas, marcar revisadas, exportar.",
    path: "./scripts/board-assistant.js",
    tag: "Board"
  }
];

// Minificado muy básico
const MINIFY = (src) => {
  try{
    return src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/.*$/gm, "")
      .replace(/\s+/g, " ")
      .replace(/\s*([{}();,:])\s*/g, "$1")
      .trim();
  }catch(e){ return src.trim(); }
};
const asBookmarklet = (code) => "javascript:(function(){" + code + "})();";

const $grid = document.getElementById("grid");

function cardTemplate(item){
  return `
    <section class="card" data-key="${item.key}">
      <span class="tag">${item.tag || "Tool"}</span>
      <h2 class="title">${item.emoji ? item.emoji + " " : ""}${item.title}</h2>
      <p class="desc">${item.desc}</p>
      <div class="row">
        <a class="btn btn-primary" id="drag-${item.key}" href="#">🔗 Arrastra: ${item.key}</a>
        <button class="btn" data-copy="${item.key}">Copiar bookmarklet</button>
        <button class="btn" data-refresh="${item.key}">Refrescar código</button>
        <span class="ok" id="ok-${item.key}"></span>
      </div>
      <div class="meta">
        <span>Archivo: <code>${item.path}</code></span>
        <a class="breadcrumb" id="open-${item.key}" href="${item.path}" target="_blank" rel="noopener">Abrir archivo</a>
      </div>
      <pre class="preview" id="preview-${item.key}">Cargando…</pre>
    </section>
  `;
}

function render(){
  $grid.innerHTML = BOOKMARKLETS.map(cardTemplate).join("");
  // Bind events
  document.querySelectorAll("[data-copy]").forEach(btn=>{
    btn.addEventListener("click", ()=> copyBookmarklet(btn.getAttribute("data-copy")));
  });
  document.querySelectorAll("[data-refresh]").forEach(btn=>{
    btn.addEventListener("click", ()=> refreshCode(btn.getAttribute("data-refresh")));
  });
}

async function loadAndBuild(item){
  const ok = document.getElementById(`ok-${item.key}`);
  const preview = document.getElementById(`preview-${item.key}`);
  const drag = document.getElementById(`drag-${item.key}`);

  try{
    const res = await fetch(item.path, {cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();

    preview.textContent = raw.length > 2000 ? raw.slice(0,2000) + "\n…(truncado)" : raw;

    const href = asBookmarklet(MINIFY(raw));
    drag.setAttribute("href", href);
    drag.setAttribute("title", "Arrástrame a tu barra de marcadores");
    if(ok) ok.textContent = "✓ listo para arrastrar";
    return href;
  }catch(err){
    preview.textContent = `Error al cargar ${item.path}\n${err.message || err}`;
    if(ok){ ok.textContent = "⚠ error"; ok.style.color = "#ff7b7b"; }
  }
}

async function copyBookmarklet(key){
  const item = BOOKMARKLETS.find(b=>b.key===key);
  if(!item) return;
  const href = await loadAndBuild(item);
  if(!href) return;
  try{
    await navigator.clipboard.writeText(href);
    const ok = document.getElementById(`ok-${key}`);
    if(ok){ ok.textContent = "✓ copiado al portapapeles"; }
  }catch(e){
    alert("No se pudo copiar. Copia manualmente desde el botón arrastrable.");
  }
}

async function refreshCode(key){
  const item = BOOKMARKLETS.find(b=>b.key===key);
  if(!item) return;
  await loadAndBuild(item);
}

(async function init(){
  render();
  for(const item of BOOKMARKLETS){
    await loadAndBuild(item);
  }
})();
