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
  const el = document.getElementById("sceneText");
  if(!el) return;
  const node = document.createElement("p");
  node.className = "muted";
  node.textContent = msg;
  el.appendChild(node);
  setTimeout(()=> node.remove(), 2200);
}

/* --------- State helpers --------- */
function ensurePuzzleState(puzzleId){
  state.puzzles ??= {};
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
  state.inventory ??= [];
  if(!state.inventory.includes(itemId)){
    state.inventory.push(itemId);
  }
}
function setFlag(flag){
  if(!flag) return;
  state.flags ??= {};
  state.flags[flag] = true;
}
function setSeal(sealKey){
  if(!sealKey) return;
  state.completed ??= { seal1:false, seal2:false, seal3:false, seal4:false, final:false };
  state.completed[sealKey] = true;
}
function incAttempt(puzzleId){
  state.attempts ??= {};
  state.attempts[puzzleId] = (state.attempts[puzzleId] || 0) + 1;
  return state.attempts[puzzleId];
}

function getHint(puzzle){
  const n = state.attempts?.[puzzle.id] || 0;
  const hints = puzzle.hints || [];
  if(!hints.length) return "No hay pistas en esta prueba.";
  if(n >= 6) return hints[2] || hints[hints.length-1];
  if(n >= 4) return hints[1] || hints[hints.length-1];
  if(n >= 2) return hints[0] || hints[hints.length-1];
  return "Prueba primero un par de intentos…";
}

/* --------- Progress logic --------- */
function canExitR1(){
  return !!(state.flags?.r1_p1_done && state.flags?.r1_p2_done);
}

function nextScene(){
  if(!state.completed?.seal1) return "r1_port";
  if(!state.completed?.seal2) return "cut_r1_r2";
  if(!state.completed?.seal3) return "cut_r2_r3";
  if(!state.completed?.seal4) return "cut_r3_r4";
  if(!state.completed?.final) return "cut_r4_final";
  return "game_complete";
}

/* --------- Navigation --------- */
function goTo(sceneId){
  const sc = getScene(sceneId);
  if(!sc){
    toast("⚠️ Escena no encontrada: " + sceneId);
    return;
  }

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

/* --------- Actions --------- */
function handleAction(action){
  if(action.type === "goto"){
    goTo(action.target);
    return;
  }

  if(action.type === "continue"){
    goTo(state.currentSceneId || "intro");
    return;
  }

  if(action.type === "dialog"){
    toast(action.text || "…");
    return;
  }

  if(action.type === "gotoNext"){
    goTo(nextScene());
    return;
  }

  if(action.type === "openCodeModal"){
    refreshExportBox();
    document.getElementById("modalCode")?.classList.remove("hidden");
    return;
  }
}

/* --------- Hotspots --------- */
function handleHotspot(hs){
  const act = hs.action;
  if(!act) return;

  if(act.type === "tryExitR1"){
    if(canExitR1()){
      toast("✅ La puerta cede. Entras al archivo.");
      goTo("r1_success");
     setSeal("seal1");
    }else{
      toast("🔒 La puerta no se abre. Te faltan pruebas.");
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

  if(act.type === "useItem"){
    const selected = state.selectedItem;

    if(!selected){
      toast("🧠 Te falta algo… selecciona un objeto del inventario.");
      return;
    }

    if(act.requiresItem && selected !== act.requiresItem){
      toast(act.failToast || "Eso no sirve aquí…");
      return;
    }

    if(act.requiresFlag && !state.flags?.[act.requiresFlag]){
      toast(act.failToast || "Todavía no tiene sentido hacerlo así.");
      return;
    }

    if(act.success){
      if(act.success.type === "setFlag") setFlag(act.success.flag);

      if(act.success.type === "giveItem"){
        giveItem(act.success.itemId);
        if(act.success.setFlag) setFlag(act.success.setFlag);
      }
    }

    state.selectedItem = null;
    saveState(state);
    toast(act.successToast || "✅ Hecho.");
    render();
    return;
  }

  if(act.type === "tryExitR2"){
    const ok =
      state.flags?.r2_p1_done &&
      state.flags?.r2_p2_done &&
      state.flags?.r2_p3_done &&
      state.flags?.r2_print_done;

    if(ok){
      setSeal("seal2");
      saveState(state);
      toast("✅ Sello II desbloqueado.");
      goTo("r2_success");
    }else{
      toast("🔒 Te falta demostrar ideas… y hacer funcionar la imprenta.");
    }
    return;
  }

  if(act.type === "tryExitR3"){
    const ok =
      state.flags?.r3_p1_done &&
      state.flags?.r3_p2_done &&
      state.flags?.r3_p3_done &&
      state.flags?.r3_found_perspective;

    if(ok){
      setSeal("seal3");
      saveState(state);
      toast("✅ Sello III desbloqueado.");
      goTo("r3_success");
    }else{
      toast("🔒 Te falta mirar mejor: pruebas y/o el detalle con la lupa.");
    }
    return;
  }

  if(act.type === "tryExitR4"){
    const ok =
      state.flags?.r4_map_revealed &&
      state.flags?.r4_p1_done &&
      state.flags?.r4_p2_done &&
      state.flags?.r4_p3_done &&
      state.flags?.r4_p4_done;

    if(ok){
      setSeal("seal4");
      saveState(state);
      toast("✅ Sello IV desbloqueado.");
      goTo("r4_success");
    }else{
      toast("🔒 Te falta: revelar el mapa con el astrolabio y completar las 4 pruebas.");
    }
    return;
  }

  if(act.type === "tryExitFinal"){
    const ok =
      state.flags?.f_p1_done &&
      state.flags?.f_p2_done &&
      state.flags?.f_p3_done &&
      state.flags?.f_p4_done;

    if(ok){
      setSeal("final");
      saveState(state);
      toast("🔓 El Archivo se abre…");
      goTo("game_complete");
    }else{
      toast("🔒 Aún no. Te faltan documentos por resolver.");
    }
    return;
  }
}

/* --------- Puzzles --------- */
function openPuzzle(puzzleId){
  const pz = getPuzzle(puzzleId);
  if(!pz){
    toast("⚠️ Puzzle no encontrado: " + puzzleId);
    return;
  }

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
      render();
    },
    onFail: (puzzle)=>{
      incAttempt(puzzle.id);
      saveState(state);
      render();
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

  // auto-sello 1: si están las 2 flags
  if(state.flags?.r1_p1_done && state.flags?.r1_p2_done){
    setSeal("seal1");
  }
}

/* --------- Modal wiring --------- */
function wireUI(){
  // cerrar puzzle modal
  document.getElementById("puzzleClose")?.addEventListener("click", ()=>{
    document.getElementById("modalPuzzle")?.classList.add("hidden");
  });

  // Code modal open/close
  const modalCode = document.getElementById("modalCode");
  document.getElementById("btnExport")?.addEventListener("click", ()=>{
    refreshExportBox();
    modalCode?.classList.remove("hidden");
  });
  document.getElementById("codeClose")?.addEventListener("click", ()=>{
    modalCode?.classList.add("hidden");
  });

  document.getElementById("btnCopyCode")?.addEventListener("click", async ()=>{
    const txt = document.getElementById("exportBox")?.value || "";
    try{
      await navigator.clipboard.writeText(txt);
      setCodeMsg("✅ Copiado.");
    }catch{
      setCodeMsg("⚠️ No se pudo copiar (permiso del navegador).");
    }
  });

  document.getElementById("btnRefreshCode")?.addEventListener("click", ()=>{
    refreshExportBox();
    setCodeMsg("Código actualizado.");
  });

  // Import / Teacher mode
  document.getElementById("btnImportCode")?.addEventListener("click", ()=>{
    const code = (document.getElementById("importBox")?.value || "").trim();

    if(code.toUpperCase() === "TEACHER1492"){
      setFlag("teacherMode");
      saveState(state);
      setCodeMsg("✅ Modo docente activado en este dispositivo.");
      render();
      return;
    }

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
  document.getElementById("btnSave")?.addEventListener("click", ()=>{
    saveState(state);
    toast("💾 Guardado.");
    refreshExportBox();
  });

  // Reset
  document.getElementById("btnReset")?.addEventListener("click", ()=>{
    if(!confirm("¿Reiniciar progreso? Esto borra el guardado local.")) return;
    hardReset();
    state = defaultState();
    saveState(state);
    render();
  });

  // HUD Next button
  document.getElementById("btnNext")?.addEventListener("click", ()=>{
    goTo(nextScene());
  });
}

function refreshExportBox(){
  const box = document.getElementById("exportBox");
  if(box) box.value = exportCode(state);
}
function setCodeMsg(msg){
  const el = document.getElementById("codeMsg");
  if(el) el.textContent = msg;
}

/* --------- Boot --------- */
(async function init(){
  await loadData();
  wireUI();

  // si la escena guardada no existe, vuelve a intro
  const sc = getScene(state.currentSceneId);
  if(!sc) state.currentSceneId = "intro";

  saveState(state);
  render();
})();
