export function openPuzzleUI({ puzzle, state, onSolve, onFail, onHint }){
  const modal = document.getElementById("modalPuzzle");
  const title = document.getElementById("puzzleTitle");
  const body = document.getElementById("puzzleBody");
  const feedback = document.getElementById("puzzleFeedback");
  const btnClose = document.getElementById("puzzleClose");
  const btnHint = document.getElementById("btnHint");
  const btnGiveUp = document.getElementById("btnGiveUp");

  title.textContent = puzzle.title || "Prueba";

  // panel superior: intentos
  const tries = (state.attempts && state.attempts[puzzle.id]) ? state.attempts[puzzle.id] : 0;
  feedback.textContent = tries ? `Intentos: ${tries}` : " ";

  body.innerHTML = "";
  const p = document.createElement("div");
  p.className = "puzzle-prompt";
  p.innerHTML = puzzle.prompt || "";
  body.appendChild(p);

  function close(){
    modal.classList.add("hidden");
  }

  btnClose.onclick = close;
  btnHint.onclick = () => onHint(puzzle);

  // “Me rindo” (solo modo docente)
  if(btnGiveUp){
    btnGiveUp.onclick = () => {
      if(!state.flags?.teacherMode){
        feedback.textContent = "🔒 Solo disponible con modo docente.";
        return;
      }
      feedback.innerHTML = `<span class="small">✅ Solución: ${puzzle.solution || "No definida."}</span>`;
    };
  }

  // Render según tipo
  if(puzzle.type === "quiz"){
    renderQuiz({ puzzle, body, feedback, onSolve, onFail });
  } else if(puzzle.type === "drag-sort"){
    renderDragSort({ puzzle, body, feedback, onSolve, onFail });
  } else if(puzzle.type === "match"){
    renderMatch({ puzzle, body, feedback, onSolve, onFail });
  } else if(puzzle.type === "order"){
    renderOrder({ puzzle, body, feedback, onSolve, onFail });
  } else if(puzzle.type === "code"){
    renderCode({ puzzle, body, feedback, onSolve, onFail });
  } else if(puzzle.type === "spot"){
    renderSpot({ puzzle, body, feedback, onSolve, onFail });
  } else {
    body.innerHTML += `<p class="small">Tipo no implementado aún: ${puzzle.type}</p>`;
  }

  modal.classList.remove("hidden");
}

/* ---------------- Types ---------------- */

function renderQuiz({ puzzle, body, feedback, onSolve, onFail }){
  const grid = document.createElement("div");
  grid.className = "answer-grid";

  (puzzle.answers || []).forEach(a=>{
    const b = document.createElement("button");
    b.className = "answer-btn";
    b.textContent = a.text;
    b.addEventListener("click", ()=>{
      if(a.correct){
        feedback.innerHTML = puzzle.successText || "✅ Bien.";
        onSolve(puzzle);
      }else{
        feedback.innerHTML = puzzle.failText || "❌ No.";
        onFail(puzzle);
      }
    });
    grid.appendChild(b);
  });

  body.appendChild(grid);
}

function renderDragSort({ puzzle, body, feedback, onSolve, onFail }){
  const wrap = document.createElement("div");
  wrap.className = "columns";

  const left = document.createElement("div");
  left.className = "dropzone";

  const right = document.createElement("div");
  right.className = "dropzone";

  const [c1, c2] = puzzle.columns || [];
  if(!c1 || !c2){
    body.innerHTML += `<p class="small">⚠️ drag-sort mal configurado (columns).</p>`;
    return;
  }

  left.innerHTML = `<h3>${c1.title}</h3><div class="drop-target" data-col="${c1.id}"></div>`;
  right.innerHTML = `<h3>${c2.title}</h3><div class="drop-target" data-col="${c2.id}"></div>`;
  wrap.appendChild(left);
  wrap.appendChild(right);

  const pool = document.createElement("div");
  pool.className = "dropzone";
  pool.innerHTML = `
    <h3>Tarjetas</h3>
    <div class="draggables"></div>
    <div class="row"><button class="btn" id="btnCheckDrag">✅ Comprobar</button></div>
  `;
  const poolInner = pool.querySelector(".draggables");

  const placements = {}; // cardId -> colId

  (puzzle.cards || []).forEach(card=>{
    const chip = document.createElement("div");
    chip.className = "draggable";
    chip.draggable = true;
    chip.dataset.card = card.id;
    chip.textContent = card.text;

    chip.addEventListener("dragstart", (e)=>{
      e.dataTransfer.setData("text/plain", card.id);
    });

    poolInner.appendChild(chip);
  });

  function wireDropTarget(el){
    el.addEventListener("dragover", (e)=> e.preventDefault());
    el.addEventListener("drop", (e)=>{
      e.preventDefault();
      const cardId = e.dataTransfer.getData("text/plain");
      if(!cardId) return;
      const cardEl = body.querySelector(`.draggable[data-card="${cardId}"]`);
      if(!cardEl) return;

      el.appendChild(cardEl);
      placements[cardId] = el.dataset.col;
      el.classList.add("filled");
    });
  }

  body.appendChild(pool);
  body.appendChild(wrap);

  body.querySelectorAll(".drop-target").forEach(wireDropTarget);

  body.querySelector("#btnCheckDrag").addEventListener("click", ()=>{
    const cards = puzzle.cards || [];
    const allPlaced = cards.every(c => placements[c.id]);
    if(!allPlaced){
      feedback.textContent = "⚠️ Aún faltan tarjetas por colocar.";
      return;
    }
    const ok = cards.every(c => placements[c.id] === c.correctColumn);
    if(ok){
      feedback.innerHTML = puzzle.successText || "✅ Perfecto.";
      onSolve(puzzle);
    }else{
      feedback.innerHTML = puzzle.failText || "❌ Revisa.";
      onFail(puzzle);
    }
  });
}

function renderMatch({ puzzle, body, feedback, onSolve, onFail }){
  const wrap = document.createElement("div");
  wrap.className = "dropzone";
  wrap.innerHTML = `<h3>Empareja</h3>`;

  const selects = {}; // leftId -> rightId

  (puzzle.left || []).forEach(L=>{
    const row = document.createElement("div");
    row.className = "row";

    const label = document.createElement("div");
    label.textContent = L.text;
    label.style.fontWeight = "800";

    const sel = document.createElement("select");
    sel.className = "textarea";
    sel.style.padding = "8px 10px";
    sel.style.height = "42px";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— elige —";
    sel.appendChild(opt0);

    (puzzle.right || []).forEach(R=>{
      const opt = document.createElement("option");
      opt.value = R.id;
      opt.textContent = R.text;
      sel.appendChild(opt);
    });

    sel.addEventListener("change", ()=> { selects[L.id] = sel.value; });

    row.appendChild(label);
    row.appendChild(sel);
    wrap.appendChild(row);
  });

  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "✅ Comprobar";
  btn.addEventListener("click", ()=>{
    const all = (puzzle.left || []).every(L => selects[L.id]);
    if(!all){
      feedback.textContent = "⚠️ Completa todas las parejas.";
      return;
    }
    const pairs = puzzle.pairs || {};
    const ok = (puzzle.left || []).every(L => selects[L.id] === pairs[L.id]);
    if(ok){
      feedback.innerHTML = puzzle.successText || "✅ Correcto.";
      onSolve(puzzle);
    }else{
      feedback.innerHTML = puzzle.failText || "❌ Revisa.";
      onFail(puzzle);
    }
  });

  body.appendChild(wrap);
  body.appendChild(document.createElement("div")).className = "row";
  body.lastChild.appendChild(btn);
}

function renderOrder({ puzzle, body, feedback, onSolve, onFail }){
  const list = document.createElement("div");
  list.className = "dropzone";
  list.innerHTML = `<h3>Arrastra para ordenar (intercambia posiciones)</h3>`;

  const ul = document.createElement("div");
  ul.className = "draggables";

  const items = puzzle.items || [];
  const order = items.map(x=>x.id);

  function renderChips(){
    ul.innerHTML = "";
    order.forEach(id=>{
      const it = items.find(x=>x.id === id);
      const chip = document.createElement("div");
      chip.className = "draggable";
      chip.draggable = true;
      chip.dataset.id = id;
      chip.textContent = it?.text || id;

      chip.addEventListener("dragstart", (e)=>{
        e.dataTransfer.setData("text/plain", id);
      });
      chip.addEventListener("dragover", (e)=> e.preventDefault());
      chip.addEventListener("drop", (e)=>{
        e.preventDefault();
        const draggedId = e.dataTransfer.getData("text/plain");
        const targetId = chip.dataset.id;
        if(!draggedId || draggedId === targetId) return;

        const a = order.indexOf(draggedId);
        const b = order.indexOf(targetId);
        [order[a], order[b]] = [order[b], order[a]];
        renderChips();
      });

      ul.appendChild(chip);
    });
  }

  renderChips();

  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "✅ Comprobar";
  btn.addEventListener("click", ()=>{
    const correct = puzzle.correctOrder || [];
    const ok = correct.length === order.length && correct.every((id, idx)=> order[idx] === id);
    if(ok){
      feedback.innerHTML = puzzle.successText || "✅ Correcto.";
      onSolve(puzzle);
    }else{
      feedback.innerHTML = puzzle.failText || "❌ Revisa.";
      onFail(puzzle);
    }
  });

  list.appendChild(ul);
  list.appendChild(document.createElement("div")).className = "row";
  list.lastChild.appendChild(btn);

  body.appendChild(list);
}

function renderCode({ puzzle, body, feedback, onSolve, onFail }){
  const box = document.createElement("input");
  box.className = "textarea";
  box.placeholder = "Escribe la clave…";
  box.autocomplete = "off";
  box.spellcheck = false;

  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "🔓 Probar";
  btn.addEventListener("click", ()=>{
    const ans = (puzzle.answer || "").toUpperCase().trim();
    const val = (box.value || "").toUpperCase().trim();

    if(val === ans){
      feedback.innerHTML = puzzle.successText || "✅ Correcto.";
      onSolve(puzzle);
    }else{
      feedback.innerHTML = puzzle.failText || "❌ No.";
      onFail(puzzle);
    }
  });

  const row = document.createElement("div");
  row.className = "row";
  row.appendChild(btn);

  body.appendChild(box);
  body.appendChild(row);
}

function renderSpot({ puzzle, body, feedback, onSolve, onFail }){
  const wrap = document.createElement("div");
  wrap.className = "dropzone";

  const imgWrap = document.createElement("div");
  imgWrap.style.position = "relative";
  imgWrap.style.maxWidth = "100%";
  imgWrap.style.borderRadius = "16px";
  imgWrap.style.overflow = "hidden";
  imgWrap.style.border = "1px solid #243041";

  const img = document.createElement("img");
  img.src = puzzle.image;
  img.alt = "Imagen de la prueba";
  img.style.width = "100%";
  img.style.display = "block";
  imgWrap.appendChild(img);

  (puzzle.zones || []).forEach(z=>{
    const zone = document.createElement("button");
    zone.type = "button";
    zone.className = "spot-zone"; // <- importante (CSS nuevo)
    zone.style.left = z.x + "%";
    zone.style.top = z.y + "%";
    zone.style.width = z.w + "%";
    zone.style.height = z.h + "%";
    zone.title = z.label || "Zona";

    zone.addEventListener("click", ()=>{
      if(z.id === puzzle.correctZoneId){
        feedback.innerHTML = puzzle.successText || "✅ Correcto.";
        onSolve(puzzle);
      }else{
        feedback.innerHTML = puzzle.failText || "❌ No.";
        onFail(puzzle);
      }
    });

    imgWrap.appendChild(zone);
  });

  wrap.appendChild(imgWrap);
  body.appendChild(wrap);
}
