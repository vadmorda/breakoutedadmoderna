export function canEnter(scene, state){
  const req = scene.requires || [];
  for(const r of req){
    if(r.startsWith("seal:")){
      const seal = r.split(":")[1];
      if(!state.completed?.[seal]) return false;
    }
    if(r.startsWith("flag:")){
      const flag = r.split(":")[1];
      if(!state.flags?.[flag]) return false;
    }
  }
  return true;
}
export function canEnter(scene, state){
  // reglas mínimas: puedes ajustar luego
  if(scene.id === "r1_port" || scene.id === "r1_success") return true;
  if(scene.id === "cut_r1_r2" || scene.id === "r2_printshop" || scene.id === "r2_success"){
    return !!state.completed.seal1; // Reto 2 solo si Sello 1
  }
  return true;
}
export function canEnter(scene, state){
  if(scene.id === "cut_r1_r2" || scene.id === "r2_printshop" || scene.id === "r2_success"){
    return !!state.completed.seal1;
  }
  if(scene.id === "cut_r2_r3" || scene.id === "r3_gallery" || scene.id === "r3_success"){
    return !!state.completed.seal2;
  }
  return true;
}
export function canEnter(scene, state){
  if(scene.id === "cut_r1_r2" || scene.id === "r2_printshop" || scene.id === "r2_success"){
    return !!state.completed.seal1;
  }
  if(scene.id === "cut_r2_r3" || scene.id === "r3_gallery" || scene.id === "r3_success"){
    return !!state.completed.seal2;
  }
  if(scene.id === "cut_r3_r4" || scene.id === "r4_maproom" || scene.id === "r4_success"){
    return !!state.completed.seal3;
  }
  return true;
}
if(scene.id === "cut_r3_r4" || scene.id === "r4_maproom" || scene.id === "r4_success"){
  return !!state.completed.seal3;
}


