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
/* ---------- Minimal + LZString (EM3) ---------- */

function minimalState(state){
  return {
    v: 1,
    currentSceneId: state.currentSceneId,
    completed: state.completed,
    puzzles: state.puzzles,
    inventory: state.inventory,
    flags: state.flags
  };
}

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

const LZString = (() => {
  const f = String.fromCharCode;
  const keyStrUriSafe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
  const baseReverseDic = {};

  function getBaseValue(alphabet, character) {
    if (!baseReverseDic[alphabet]) {
      baseReverseDic[alphabet] = {};
      for (let i = 0; i < alphabet.length; i++) baseReverseDic[alphabet][alphabet.charAt(i)] = i;
    }
    return baseReverseDic[alphabet][character];
  }

  function compressToEncodedURIComponent(input) {
    if (input == null) return "";
    return _compress(input, 6, a => keyStrUriSafe.charAt(a));
  }

  function decompressFromEncodedURIComponent(input) {
    if (input == null) return "";
    if (input === "") return null;
    input = input.replace(/ /g, "+");
    return _decompress(input.length, 32, index => getBaseValue(keyStrUriSafe, input.charAt(index)));
  }

  function _compress(uncompressed, bitsPerChar, getCharFromInt) {
    if (uncompressed == null) return "";
    let i, value;
    const context_dictionary = {};
    const context_dictionaryToCreate = {};
    let context_c = "";
    let context_wc = "";
    let context_w = "";
    let context_enlargeIn = 2;
    let context_dictSize = 3;
    let context_numBits = 2;
    const context_data = [];
    let context_data_val = 0;
    let context_data_position = 0;

    for (i = 0; i < uncompressed.length; i += 1) {
      context_c = uncompressed.charAt(i);
      if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) {
        context_dictionary[context_c] = context_dictSize++;
        context_dictionaryToCreate[context_c] = true;
      }

      context_wc = context_w + context_c;
      if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)) {
        context_w = context_wc;
      } else {
        if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
          if (context_w.charCodeAt(0) < 256) {
            for (let j = 0; j < context_numBits; j++) {
              context_data_val = (context_data_val << 1);
              if (context_data_position === bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else context_data_position++;
            }
            value = context_w.charCodeAt(0);
            for (let j = 0; j < 8; j++) {
              context_data_val = (context_data_val << 1) | (value & 1);
              if (context_data_position === bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else context_data_position++;
              value = value >> 1;
            }
          } else {
            value = 1;
            for (let j = 0; j < context_numBits; j++) {
              context_data_val = (context_data_val << 1) | value;
              if (context_data_position === bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else context_data_position++;
              value = 0;
            }
            value = context_w.charCodeAt(0);
            for (let j = 0; j < 16; j++) {
              context_data_val = (context_data_val << 1) | (value & 1);
              if (context_data_position === bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else context_data_position++;
              value = value >> 1;
            }
          }
          context_enlargeIn--;
          if (context_enlargeIn === 0) {
            context_enlargeIn = Math.pow(2, context_numBits);
            context_numBits++;
          }
          delete context_dictionaryToCreate[context_w];
        } else {
          value = context_dictionary[context_w];
          for (let j = 0; j < context_numBits; j++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else context_data_position++;
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn === 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        context_dictionary[context_wc] = context_dictSize++;
        context_w = String(context_c);
      }
    }

    if (context_w !== "") {
      if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
        if (context_w.charCodeAt(0) < 256) {
          for (let j = 0; j < context_numBits; j++) {
            context_data_val = (context_data_val << 1);
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else context_data_position++;
          }
          value = context_w.charCodeAt(0);
          for (let j = 0; j < 8; j++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else context_data_position++;
            value = value >> 1;
          }
        } else {
          value = 1;
          for (let j = 0; j < context_numBits; j++) {
            context_data_val = (context_data_val << 1) | value;
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else context_data_position++;
            value = 0;
          }
          value = context_w.charCodeAt(0);
          for (let j = 0; j < 16; j++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else context_data_position++;
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn === 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        delete context_dictionaryToCreate[context_w];
      } else {
        value = context_dictionary[context_w];
        for (let j = 0; j < context_numBits; j++) {
          context_data_val = (context_data_val << 1) | (value & 1);
          if (context_data_position === bitsPerChar - 1) {
            context_data_position = 0;
            context_data.push(getCharFromInt(context_data_val));
            context_data_val = 0;
          } else context_data_position++;
          value = value >> 1;
        }
      }
      context_enlargeIn--;
      if (context_enlargeIn === 0) {
        context_enlargeIn = Math.pow(2, context_numBits);
        context_numBits++;
      }
    }

    value = 2;
    for (let j = 0; j < context_numBits; j++) {
      context_data_val = (context_data_val << 1) | (value & 1);
      if (context_data_position === bitsPerChar - 1) {
        context_data_position = 0;
        context_data.push(getCharFromInt(context_data_val));
        context_data_val = 0;
      } else context_data_position++;
      value = value >> 1;
    }

    while (true) {
      context_data_val = (context_data_val << 1);
      if (context_data_position === bitsPerChar - 1) {
        context_data.push(getCharFromInt(context_data_val));
        break;
      } else context_data_position++;
    }

    return context_data.join("");
  }

  function _decompress(length, resetValue, getNextValue) {
    const dictionary = [];
    let next, enlargeIn = 4, dictSize = 4, numBits = 3;
    let entry = "", result = [], i, w, bits, resb, maxpower, power;
    let data = { val: getNextValue(0), position: resetValue, index: 1 };

    for (i = 0; i < 3; i += 1) dictionary[i] = i;

    bits = 0; maxpower = Math.pow(2, 2); power = 1;
    while (power !== maxpower) {
      resb = data.val & data.position;
      data.position >>= 1;
      if (data.position === 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
      bits |= (resb > 0 ? 1 : 0) * power;
      power <<= 1;
    }

    switch (next = bits) {
      case 0:
        bits = 0; maxpower = Math.pow(2, 8); power = 1;
        while (power !== maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position === 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        w = f(bits);
        break;
      case 1:
        bits = 0; maxpower = Math.pow(2, 16); power = 1;
        while (power !== maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position === 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        w = f(bits);
        break;
      case 2:
        return "";
    }

    dictionary[3] = w;
    result.push(w);

    while (true) {
      if (data.index > length) return "";

      bits = 0; maxpower = Math.pow(2, numBits); power = 1;
      while (power !== maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position === 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }

      switch (next = bits) {
        case 0:
          bits = 0; maxpower = Math.pow(2, 8); power = 1;
          while (power !== maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position === 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          dictionary[dictSize++] = f(bits);
          next = dictSize - 1;
          enlargeIn--;
          break;
        case 1:
          bits = 0; maxpower = Math.pow(2, 16); power = 1;
          while (power !== maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position === 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          dictionary[dictSize++] = f(bits);
          next = dictSize - 1;
          enlargeIn--;
          break;
        case 2:
          return result.join("");
      }

      if (enlargeIn === 0) { enlargeIn = Math.pow(2, numBits); numBits++; }

      if (dictionary[next]) entry = dictionary[next];
      else if (next === dictSize) entry = w + w.charAt(0);
      else return null;

      result.push(entry);
      dictionary[dictSize++] = w + entry.charAt(0);
      enlargeIn--;
      w = entry;

      if (enlargeIn === 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
    }
  }

  return { compressToEncodedURIComponent, decompressFromEncodedURIComponent };
})();

export function exportCode(state){
  const minimal = minimalState(state);
  const json = JSON.stringify(minimal);
  const payload = LZString.compressToEncodedURIComponent(json);
  const sum = checksum6(payload);
  return `EM3.${payload}.${sum}`;
}

export function importCode(code){
  const trimmed = (code || "").trim();
  const parts = trimmed.split(".");
  if(parts.length !== 3) throw new Error("Formato inválido.");

  const ver = parts[0];
  const payload = parts[1];
  const sum = parts[2];

  if(checksum6(payload) !== sum) throw new Error("Checksum inválido (código corrupto).");

  if(ver === "EM1"){
    const json = base64UrlDecode(payload);
    const state = JSON.parse(json);
    if(!state || typeof state !== "object" || state.v !== 1) throw new Error("Estado inválido.");
    return hydrateState(state);
  }

  if(ver === "EM3"){
    const json = LZString.decompressFromEncodedURIComponent(payload);
    if(!json) throw new Error("Código inválido o incompleto.");
    const state = JSON.parse(json);
    if(!state || typeof state !== "object" || state.v !== 1) throw new Error("Estado inválido.");
    return hydrateState(state);
  }

  throw new Error("Versión de código no compatible.");
}
