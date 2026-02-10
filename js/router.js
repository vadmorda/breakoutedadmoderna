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
