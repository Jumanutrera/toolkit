// Configuración de bookmarklets
const BOOKMARKLETS = [
  {
    key: "check-code",
    title: "CHECK",
    emoji: "✅",
    path: "./scripts/check-code.js",
    tag: "Utilidad"
  },
  {
    key: "copy-code",
    title: "COPY",
    emoji: "📋",
    path: "./scripts/copy-code.js",
    tag: "Clipboard"
  },
  {
    key: "board-assistant",
    title: "BASSIST",
    emoji: "🧭",
    path: "./scripts/board-assistant.js",
    tag: "Board"
  }
];

// Minificación muy básica
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
      <span class="tag">${item.tag}</span>
      <div class="row">
        <a class="btn btn-primary" id="drag-${item.key}" href="#">${item.emoji} ${item.title}</a>
        <button class="btn" data-copy="${item.key}">Copiar</button>
        <button class="btn" data-refresh="${item.key}">Refrescar</button>
        <span class="ok" id="ok-${item.key}"></span>
      </div>
    </section>
  `;
}

function render(){
  $grid.innerHTML = BOOKMARKLETS.map(cardTemplate).join("");
  document.querySelectorAll("[data-copy]").forEach(btn=>{
    btn.addEventListener("click", ()=> copyBookmarklet(btn.getAttribute("data-copy")));
  });
  document.querySelectorAll("[data-refresh]").forEach(btn=>{
    btn.addEventListener("click", ()=> refreshCode(btn.getAttribute("data-refresh")));
  });
}

async function loadAndBuild(item){
  const ok = document.getElementById(`ok-${item.key}`);
  const drag = document.getElementById(`drag-${item.key}`);

  try{
    const res = await fetch(item.path, {cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();

    const href = asBookmarklet(MINIFY(raw));
    drag.setAttribute("href", href);
    drag.setAttribute("title", "Arrástrame a tu barra de marcadores");
    if(ok) ok.textContent = "✓ listo";
    return href;
  }catch(err){
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
    if(ok){ ok.textContent = "✓ copiado"; }
  }catch(e){
    alert("No se pudo copiar. Copia manualmente desde el botón.");
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

