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
    // rellena campos mínimos por si viene de una versión anterior
    parsed.completed ??= { seal1:false, seal2:false, seal3:false, seal4:false, final:false };
    parsed.puzzles ??= {};
    parsed.inventory ??= [];
    parsed.flags ??= {};
    parsed.attempts ??= {};
    parsed.selectedItem ??= null;
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
/* ---------- Compact Export helpers (EM2) ---------- */

// estado mínimo (lo imprescindible para continuar)
function minimalState(state){
  return {
    v: 1,
    currentSceneId: state.currentSceneId,
    completed: state.completed,
    puzzles: state.puzzles,
    inventory: state.inventory,
    flags: state.flags
    // attempts: state.attempts, // si quieres conservar intentos, descomenta
  };
}

// rellena lo que falte para que el juego no se rompa al importar
function hydrateState(s){
  const now = Date.now();
  s.v = 1;
  s.currentSceneId ??= "intro";
  s.completed ??= { seal1:false, seal2:false, seal3:false, seal4:false, final:false };
  s.puzzles ??= {};
  s.inventory ??= [];
  s.flags ??= {};
  s.attempts ??= {};
  s.selectedItem = null;
  s.createdAt ??= now;
  s.updatedAt ??= now;
  return s;
}

// Base64URL para bytes (Uint8Array)
function base64UrlEncodeBytes(bytes){
  let bin = "";
  for(let i=0;i<bytes.length;i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}
function base64UrlDecodeBytes(str){
  const pad = str.length % 4 ? "=".repeat(4 - (str.length % 4)) : "";
  const b64 = str.replaceAll("-","+").replaceAll("_","/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* LZW simple (sync, sin librerías) + empaquetado a bytes */
function lzwCompressToBytes(input){
  const dict = new Map();
  for(let i=0;i<256;i++) dict.set(String.fromCharCode(i), i);
  let nextCode = 256;

  let w = "";
  const codes = [];

  for(let i=0;i<input.length;i++){
    const c = input.charAt(i);
    const wc = w + c;
    if(dict.has(wc)){
      w = wc;
    }else{
      codes.push(dict.get(w));
      if(nextCode < 65535){
        dict.set(wc, nextCode++);
      }else{
        dict.clear();
        for(let j=0;j<256;j++) dict.set(String.fromCharCode(j), j);
        nextCode = 256;
      }
      w = c;
    }
  }
  if(w) codes.push(dict.get(w));

  const out = new Uint8Array(codes.length * 2);
  for(let i=0;i<codes.length;i++){
    const code = codes[i] & 0xffff;
    out[i*2] = (code >> 8) & 0xff;
    out[i*2 + 1] = code & 0xff;
  }
  return out;
}

function lzwDecompressFromBytes(bytes){
  const codes = [];
  for(let i=0;i<bytes.length;i+=2){
    codes.push((bytes[i] << 8) | bytes[i+1]);
  }
  if(codes.length === 0) return "";

  const dict = [];
  for(let i=0;i<256;i++) dict[i] = String.fromCharCode(i);
  let nextCode = 256;

  let w = dict[codes[0]];
  if(w == null) throw new Error("Código corrupto (LZW).");
  let result = w;

  for(let i=1;i<codes.length;i++){
    const k = codes[i];
    let entry;

    if(dict[k] != null){
      entry = dict[k];
    }else if(k === nextCode){
      entry = w + w.charAt(0);
    }else{
      throw new Error("Código corrupto (LZW).");
    }

    result += entry;

    if(nextCode < 65535){
      dict[nextCode++] = w + entry.charAt(0);
    }else{
      dict.length = 0;
      for(let j=0;j<256;j++) dict[j] = String.fromCharCode(j);
      nextCode = 256;
    }

    w = entry;
  }

  return result;
}
export function exportCode(state){
  // NUEVO: export mínimo + compresión -> EM2
  const minimal = minimalState(state);
  const json = JSON.stringify(minimal);
  const compressed = lzwCompressToBytes(json);
  const payload = base64UrlEncodeBytes(compressed);
  const sum = checksum6(payload);
  return `EM2.${payload}.${sum}`;
}

export function importCode(code){
  const trimmed = (code || "").trim();
  const parts = trimmed.split(".");
  if(parts.length !== 3) throw new Error("Formato inválido.");

  const ver = parts[0];
  const payload = parts[1];
  const sum = parts[2];

  if(checksum6(payload) !== sum) throw new Error("Checksum inválido (código corrupto).");

  // Compatibilidad: EM1 (antiguo) y EM2 (nuevo comprimido)
  if(ver === "EM1"){
    const json = base64UrlDecode(payload);
    const state = JSON.parse(json);
    if(!state || typeof state !== "object" || state.v !== 1) throw new Error("Estado inválido.");
    return hydrateState(state);
  }

  if(ver === "EM2"){
    const bytes = base64UrlDecodeBytes(payload);
    const json = lzwDecompressFromBytes(bytes);
    const state = JSON.parse(json);
    if(!state || typeof state !== "object" || state.v !== 1) throw new Error("Estado inválido.");
    return hydrateState(state);
  }

  throw new Error("Versión de código no compatible.");
}
