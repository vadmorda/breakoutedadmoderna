const STORAGE_KEY = "escape_em_state_v1";

export function defaultState(){
  const now = Date.now();
  return {
    v: 1,
    currentSceneId: "intro",
    completed: { seal1:false, seal2:false, seal3:false, seal4:false, final:false },
    puzzles: {},
    inventory: [],
    selectedItem: null,
    flags: {},
    attempts: {},
    createdAt: now,
    updatedAt: now
  };
}

export function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // very light migration safety
    if(!parsed || typeof parsed !== "object" || parsed.v !== 1) return defaultState();
    return parsed;
  }catch{
    return defaultState();
  }
}

export function saveState(state){
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function hardReset(){
  localStorage.removeItem(STORAGE_KEY);
}

/* ---------- Export / Import code ---------- */
function base64UrlEncode(str){
  return btoa(unescape(encodeURIComponent(str)))
    .replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}
function base64UrlDecode(str){
  const pad = str.length % 4 ? "=".repeat(4 - (str.length % 4)) : "";
  const b64 = str.replaceAll("-","+").replaceAll("_","/") + pad;
  return decodeURIComponent(escape(atob(b64)));
}

// hash corto (djb2)
function checksum6(input){
  let hash = 5381;
  for(let i=0;i<input.length;i++){
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash = hash >>> 0;
  }
  return (hash.toString(36)).slice(0,6).padEnd(6,"0");
}

export function exportCode(state){
  const payload = base64UrlEncode(JSON.stringify(state));
  const sum = checksum6(payload);
  return `EM1.${payload}.${sum}`;
}

export function importCode(code){
  const trimmed = (code || "").trim();
  const parts = trimmed.split(".");
  if(parts.length !== 3) throw new Error("Formato inválido.");
  if(parts[0] !== "EM1") throw new Error("Versión de código no compatible.");
  const payload = parts[1];
  const sum = parts[2];
  if(checksum6(payload) !== sum) throw new Error("Checksum inválido (código corrupto).");
  const json = base64UrlDecode(payload);
  const state = JSON.parse(json);
  if(!state || typeof state !== "object" || state.v !== 1) throw new Error("Estado inválido.");
  return state;
}
