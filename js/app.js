import { defaultState, loadState, saveState, hardReset, exportCode, importCode } from "./state.js";
import { canEnter } from "./router.js";
import { renderScene } from "./render.js";
import { openPuzzleUI } from "./puzzles.js";

let story = null;
let puzzles = null;
let items = null;

let state = loadState();

const itemsById = {};

async function loadData(){
  const [s, p, i] = await Promise.all([
    fetch("./data/story.json").then(r=>r.json()),
    fetch("./data/puzzles.json").then(r=>r.json()),
    fetch("./data/items.json").then(r=>r.json())
  ]);
  story = s;
  puzzles = p;
  items = i;

  (items.items || []).forEach(it => itemsById[it.id] = it);
}

function getScene(id){
  return (story.scenes || []).find(sc => sc.id === id);
}
function getPuzzle(id){
  return (puzzles.puzzles || []).find(pz => pz.id === id);
}

function toast(msg){
  // minimal: reuse scene panel feedback by temporary line
  const el = document.getElementById("sceneText");
  const node = document.createElement("p");
  node.className = "muted";
  node.textContent = msg;
  el.appendChild(node);
  setTimeout(()=> node.remove(), 2200);
}

function ensurePuzzleState(puzzleId){
  if(!state.puzzles[puzzleId]){
    state.puzzles[puzzleId] = { status: "locked", score: 0 };
  }
}

function markPuzzleDone(puzzleId){
  ensurePuzzleState(puzzleId);
  state.puzzles[puzzleId].status = "done";
}

function giveItem(itemId){
  if(!itemId) return;
  if(!state.inventory.includes(itemId)){
    state.inventory.push(itemId);
  }
}

function setFlag(flag){
  if(!flag) return;
  state.flags[flag] = true;
}

function setSeal(sealKey){
  if(!sealKey) return;
  state.completed[sealKey] = true;
}

function incAttempt(puzzleId){
  state.attempts[puzzleId] = (state.attempts[puzzleId] || 0) + 1;
  return state.attempts[puzzleId];
}

function getHint(puzzle){
  const n = state.attempts[puzzle.id] || 0;
  const hints = puzzle.hints || [];
  if(!hints.length) return "No hay pistas en esta prueba.";
  if(n >= 6) return hints[2] || hints[hints.length-1];
  if(n >= 4) return hints[1] || hints[hints.length-1];
  if(n >= 2) return hints[0] || hints[hints.length-1];
  return "Prueba primero un par de intentos…";
}

function canExitR1(){
  return state.flags.r1_p1_done && state.flags.r1_p2_done && state.completed.seal1;
}

/* --------- Navigation --------- */
function goTo(sceneId){
  const sc = getScene(sceneId);
  if(!sc) return;

  if(!canEnter(sc, state)){
    toast("🔒 Aún no puedes entrar ahí.");
    return;
  }

  state.currentSceneId = sceneId;
  saveState(state);
  render();
}

function render(){
  const sc = getScene(state.currentSceneId) || getScene("intro");
  renderScene({
    scene: sc,
    state,
    itemsById,
    onAction: handleAction,
    onHotspot: handleHotspot,
    onSelectItem: (itemId)=>{
      state.selectedItem = (state.selectedItem === itemId) ? null : itemId;
      saveState(state);
      render();
    }
  });
}

function handleAction(action){
  if(action.type === "goto"){
    goTo(action.target);
    return;
  }
  if(action.type === "continue"){
    // si hay estado, ya está; solo ir a currentScene
    goTo(state.currentSceneId || "intro");
    return;
  }
  if(action.type === "dialog"){
    toast(action.text || "…");
    return;
  }
}

function handleHotspot(hs){
  const act = hs.action;
  if(!act) return;

  // aventura gráfica: usar objeto seleccionado (si procede)
  if(act.type === "tryExitR1"){
    if(canExitR1()){
      toast("✅ La puerta cede. Entras al archivo.");
      goTo("r1_success");
    }else{
      toast("🔒 La puerta no se abre. Te faltan pruebas.");
    }
    return;
  }
  if(act.type === "useItem"){
    const selected = state.selectedItem;

    // si no hay objeto seleccionado
    if(!selected){
      toast("🧠 Te falta algo… selecciona un objeto del inventario.");
      return;
    }

    // requiere un objeto concreto
    if(act.requiresItem && selected !== act.requiresItem){
      toast(act.failToast || "Eso no sirve aquí…");
      return;
    }

    // requiere un flag previo (p.ej. tipos puestos antes de tinta)
    if(act.requiresFlag && !state.flags[act.requiresFlag]){
      toast(act.failToast || "Todavía no tiene sentido hacerlo así.");
      return;
    }

    // éxito: aplica acción declarada
    if(act.success){
      if(act.success.type === "setFlag") setFlag(act.success.flag);
      if(act.success.type === "giveItem"){
        giveItem(act.success.itemId);
        if(act.success.setFlag) setFlag(act.success.setFlag);
      }
    }

    // opcional: deseleccionar tras usar
    state.selectedItem = null;

    saveState(state);
    toast(act.successToast || "✅ Hecho.");
    render();
    return;
  }

  if(act.type === "tryExitR2"){
    const ok = state.flags.r2_p1_done && state.flags.r2_p2_done && state.flags.r2_p3_done && state.flags.r2_print_done;
    if(ok){
      state.completed.seal2 = true;
      saveState(state);
      toast("✅ Sello II desbloqueado.");
      goTo("r2_success");
    }else{
      toast("🔒 Te falta demostrar ideas… y hacer funcionar la imprenta.");
    }
    return;
  }
  if(act.type === "tryExitR3"){
    const ok = state.flags.r3_p1_done && state.flags.r3_p2_done && state.flags.r3_p3_done && state.flags.r3_found_perspective;
    if(ok){
      state.completed.seal3 = true;
      saveState(state);
      toast("✅ Sello III desbloqueado.");
      goTo("r3_success");
    }else{
      toast("🔒 Te falta mirar mejor: pruebas y/o el detalle con la lupa.");
    }
    return;
  }

  if(act.type === "giveItem"){
    giveItem(act.itemId);
    saveState(state);
    toast(act.toast || "Objeto conseguido.");
    render();
    return;
  }

  if(act.type === "openPuzzle"){
    openPuzzle(act.puzzleId);
    return;
  }
}
  if(act.type === "tryExitR4"){
    const ok =
      state.flags.r4_map_revealed &&
      state.flags.r4_p1_done &&
      state.flags.r4_p2_done &&
      state.flags.r4_p3_done &&
      state.flags.r4_p4_done;

    if(ok){
      state.completed.seal4 = true;
      saveState(state);
      toast("✅ Sello IV desbloqueado.");
      goTo("r4_success");
    }else{
      toast("🔒 Te falta: rutas, América… y revelar el mapa con el astrolabio.");
    }
    return;
  }

/* --------- Puzzle handling --------- */
function openPuzzle(puzzleId){
  const pz = getPuzzle(puzzleId);
  if(!pz) return;

  ensurePuzzleState(pz.id);
  state.puzzles[pz.id].status = "in_progress";
  saveState(state);

  openPuzzleUI({
    puzzle: pz,
    state,
    onSolve: (puzzle)=>{
      applyReward(puzzle.reward);
      markPuzzleDone(puzzle.id);
      saveState(state);
      // auto-check: if seal got, keep
      render();
    },
    onFail: (puzzle)=>{
      incAttempt(puzzle.id);
      saveState(state);
    },
    onHint: (puzzle)=>{
      const hint = getHint(puzzle);
      toast("💡 " + hint);
    }
  });
}

function applyReward(reward){
  if(!reward) return;
  if(reward.setFlag) setFlag(reward.setFlag);
  if(reward.giveItem) giveItem(reward.giveItem);
  if(reward.setSeal) setSeal(reward.setSeal);

  // si ya están ambas flags, asegura sello (por si ajustas luego)
  if(state.flags.r1_p1_done && state.flags.r1_p2_done){
    state.completed.seal1 = true;
  }
}

/* --------- Modal wiring --------- */
function wireUI(){
  // puzzle modal close
  document.getElementById("puzzleClose").addEventListener("click", ()=>{
    document.getElementById("modalPuzzle").classList.add("hidden");
  });

  // Code modal open/close
  const modalCode = document.getElementById("modalCode");
  document.getElementById("btnExport").addEventListener("click", ()=>{
    refreshExportBox();
    modalCode.classList.remove("hidden");
  });
  document.getElementById("codeClose").addEventListener("click", ()=>{
    modalCode.classList.add("hidden");
  });

  document.getElementById("btnCopyCode").addEventListener("click", async ()=>{
    const txt = document.getElementById("exportBox").value;
    try{
      await navigator.clipboard.writeText(txt);
      setCodeMsg("✅ Copiado.");
    }catch{
      setCodeMsg("⚠️ No se pudo copiar (permiso del navegador).");
    }
  });

  document.getElementById("btnRefreshCode").addEventListener("click", ()=>{
    refreshExportBox();
    setCodeMsg("Código actualizado.");
  });

  document.getElementById("btnImportCode").addEventListener("click", ()=>{
    const code = document.getElementById("importBox").value;
    try{
      const newState = importCode(code);
      state = newState;
      saveState(state);
      setCodeMsg("✅ Progreso restaurado.");
      render();
    }catch(e){
      setCodeMsg("❌ " + (e?.message || "Error al restaurar."));
    }
  });

  // Save button
  document.getElementById("btnSave").addEventListener("click", ()=>{
    saveState(state);
    toast("💾 Guardado.");
    refreshExportBox();
  });

  // Reset
  document.getElementById("btnReset").addEventListener("click", ()=>{
    if(!confirm("¿Reiniciar progreso? Esto borra el guardado local.")) return;
    hardReset();
    state = defaultState();
    saveState(state);
    render();
  });
}

function refreshExportBox(){
  const box = document.getElementById("exportBox");
  box.value = exportCode(state);
}
function setCodeMsg(msg){
  document.getElementById("codeMsg").textContent = msg;
}

/* --------- Boot --------- */
(async function init(){
  await loadData();
  wireUI();

  // si el scene guardado no existe, vuelve a intro
  const sc = getScene(state.currentSceneId);
  if(!sc) state.currentSceneId = "intro";

  saveState(state);
  render();
})();
