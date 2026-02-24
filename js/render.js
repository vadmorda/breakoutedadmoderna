export function renderScene({ scene, state, itemsById, onAction, onHotspot, onSelectItem }){
  const titleEl = document.getElementById("sceneTitle");
  const bgEl = document.getElementById("sceneBg");
  const textEl = document.getElementById("sceneText");
  const actionsEl = document.getElementById("sceneActions");
  const hsEl = document.getElementById("hotspots");
  const invEl = document.getElementById("invItems");
  const invHint = document.getElementById("invHint");

  titleEl.textContent = scene.title || "";
  bgEl.style.backgroundImage = `url('${scene.bg}')`;

  textEl.innerHTML = (scene.text || []).map(t => `<p>${t}</p>`).join("");

  actionsEl.innerHTML = "";
  (scene.actions || []).forEach(a=>{
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = a.label;
    b.addEventListener("click", ()=> onAction(a));
    actionsEl.appendChild(b);
  });

  // hotspots
  hsEl.innerHTML = "";
  (scene.hotspots || []).forEach(h=>{
    // No renderizar hotspots de 'giveItem' si el objeto ya está en el inventario
    if(h?.action?.type === 'giveItem' && state.inventory?.includes(h.action.itemId)) return;
    const d = document.createElement("div");
    d.className = "hotspot";
    d.style.left = h.x + "%";
    d.style.top  = h.y + "%";
    d.style.width = h.w + "%";
    d.style.height = h.h + "%";
    d.dataset.id = h.id;
// Imagen opcional dentro del hotspot
if(h.img){
  const im = document.createElement("img");
  im.className = "hs-img";
  im.src = h.img;
  im.alt = h.label || "";
  im.loading = "lazy";
  d.appendChild(im);
  im.onerror = () => console.warn("❌ No carga hotspot img:", h.img);
}

    const tag = document.createElement("div");
    tag.className = "tag";
    tag.textContent = h.label;
    d.appendChild(tag);

    d.addEventListener("click", ()=> onHotspot(h));
    hsEl.appendChild(d);
  });

  // inventory
  invEl.innerHTML = "";
  state.inventory.forEach(itemId=>{
    const it = itemsById[itemId];
    const b = document.createElement("button");
    b.className = "inv-item" + (state.selectedItem === itemId ? " selected" : "");
    b.textContent = it ? it.name : itemId;
    b.title = it ? it.desc : "";
   // Click: seleccionar
b.addEventListener("click", ()=> onSelectItem(itemId));

// Doble clic: inspeccionar (abrir)
b.addEventListener("dblclick", (e)=>{
  e.preventDefault();
  onSelectItem(itemId, { inspect:true });
});

// Móvil/tablet: mantener pulsado para inspeccionar (450ms)
let pressTimer = null;
b.addEventListener("pointerdown", ()=>{
  pressTimer = window.setTimeout(()=>{
    onSelectItem(itemId, { inspect:true });
  }, 450);
});
b.addEventListener("pointerup", ()=>{ if(pressTimer) clearTimeout(pressTimer); pressTimer=null; });
b.addEventListener("pointerleave", ()=>{ if(pressTimer) clearTimeout(pressTimer); pressTimer=null; });
b.addEventListener("pointercancel", ()=>{ if(pressTimer) clearTimeout(pressTimer); pressTimer=null; });

    invEl.appendChild(b);
  });

  if(!state.inventory.length){
    invHint.textContent = "Todavía no tienes objetos. Explora la escena.";
  }else if(state.selectedItem){
    const it = itemsById[state.selectedItem];
    invHint.textContent = `Seleccionado: ${it?.name || state.selectedItem}. Ahora pulsa un objeto/puerta para usarlo.`;
  }else{
    invHint.textContent = "Haz clic en un objeto para “seleccionarlo”.";
  }
    // HUD seals
  const setOn = (id, on) => {
    const el = document.getElementById(id);
    if(!el) return;
    el.classList.toggle("on", !!on);
  };

  setOn("seal1", state.completed?.seal1);
  setOn("seal2", state.completed?.seal2);
  setOn("seal3", state.completed?.seal3);
  setOn("seal4", state.completed?.seal4);
  setOn("sealF", state.completed?.final || state.currentSceneId === "game_complete");;

  const hudMsg = document.getElementById("hudMsg");
  if(hudMsg){
    const next =
      !state.completed?.seal1 ? "Objetivo: conseguir Sello I" :
      !state.completed?.seal2 ? "Objetivo: conseguir Sello II" :
      !state.completed?.seal3 ? "Objetivo: conseguir Sello III" :
      !state.completed?.seal4 ? "Objetivo: conseguir Sello IV" :
      (!state.completed?.final && state.currentSceneId !== "game_complete") ? "Objetivo: abrir el Archivo final" :
      "✅ Misión completada";
    hudMsg.textContent = next;
  }

}
