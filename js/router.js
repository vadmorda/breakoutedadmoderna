export function canEnter(scene, state){
  // 1) Si la escena define "requires" en story.json, lo respetamos
  const req = scene.requires || [];
  for(const r of req){
    if(r.startsWith("seal:")){
      const seal = r.split(":")[1]; // ej: "seal1"
      if(!state.completed?.[seal]) return false;
    }
    if(r.startsWith("flag:")){
      const flag = r.split(":")[1];
      if(!state.flags?.[flag]) return false;
    }
  }

  // 2) Reglas mínimas por ID (para el flujo del juego)
  // Intro y Reto 1 siempre accesibles
  if(["intro", "r1_port", "r1_success"].includes(scene.id)) return true;

  // Reto 2 requiere Sello I
  if(["cut_r1_r2", "r2_printshop", "r2_success"].includes(scene.id)){
    return !!state.completed?.seal1;
  }

  // Reto 3 requiere Sello II
  if(["cut_r2_r3", "r3_gallery", "r3_success"].includes(scene.id)){
    return !!state.completed?.seal2;
  }

  // Reto 4 requiere Sello III
  if(["cut_r3_r4", "r4_maproom", "r4_success"].includes(scene.id)){
    return !!state.completed?.seal3;
  }

  // Final requiere Sello IV
  if(["cut_r4_final", "final_archive", "game_complete"].includes(scene.id)){
    return !!state.completed?.seal4;
  }

  // Si no está en la lista, por defecto se permite
  return true;
}
