// js/puzzles.js
export function openPuzzleUI({ puzzle, state, onSolve, onFail, onHint }){
  const modal = document.getElementById("modalPuzzle");
  const title = document.getElementById("puzzleTitle");
  const body = document.getElementById("puzzleBody");
  const feedback = document.getElementById("puzzleFeedback");
  const btnClose = document.getElementById("puzzleClose");
  const btnHint = document.getElementById("btnHint");
  const btnGiveUp = document.getElementById("btnGiveUp");

  if(!modal || !title || !body || !feedback) return;

  title.textContent = puzzle.title || "Prueba";

  // intentos
  const tries = state?.attempts?.[puzzle.id] || 0;
  feedback.textContent = tries ? `Intentos: ${tries}` : " ";

  // reset body
  body.innerHTML = "";
  const prompt = document.createElement("div");
  prompt.className = "puzzle-prompt";
  prompt.innerHTML = puzzle.prompt || "";
  body.appendChild(prompt);

  function close(){
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  // wiring
  btnClose && (btnClose.onclick = close);
  btnHint && (btnHint.onclick = () => onHint?.(puzzle));

  // “Me rindo” (solo modo docente)
  if(btnGiveUp){
    btnGiveUp.onclick = () => {
      if(!state?.flags?.teacherMode){
        feedback.textContent = "🔒 Solo disponible con modo docente.";
        return;
      }
      feedback.innerHTML = `<span class="small">✅ Solución: ${puzzle.solution || "No definida."}</span>`;
    };
  }

  // Render según tipo
  const ctx = {
    puzzle,
    body,
    feedback,
    onSolve: (pz)=>{
      onSolve?.(pz);
      // ✅ clave: al resolver, se cierra para que el alumno vea el avance
      close();
    },
    onFail: (pz)=>{
      onFail?.(pz);
      // al fallar NO cerramos: permite reintentar
    },
    close
  };

  if(puzzle.type === "quiz") renderQuiz(ctx);
  else if(puzzle.type === "drag-sort") renderDragSort(ctx);
  else if(puzzle.type === "match") renderMatch(ctx);
  else if(puzzle.type === "order") renderOrder(ctx);
  else if(puzzle.type === "code") renderCode(ctx);
  else if(puzzle.type === "spot") renderSpot(ctx);
  else {
    const warn = document.createElement("p");
    warn.className = "small";
    warn.textContent = `Tipo no implementado aún: ${puzzle.type}`;
    body.appendChild(warn);
  }

  // mostrar modal
  document.body.classList.add("modal-open");
  modal.classList.remove("hidden");
}

/* ---------------- Types ---------------- */

function shuffleInPlace(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


function renderQuiz({ puzzle, body, feedback, onSolve, onFail }){
  const grid = document.createElement("div");
  grid.className = "answer-grid";

  (puzzle.answers || []).forEach(a=>{
    const b = document.createElement("button");
    b.className = "answer-btn";
    b.type = "button";
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
  const [c1, c2] = puzzle.columns || [];
  if(!c1 || !c2){
    const warn = document.createElement("p");
    warn.className = "small";
    warn.textContent = "⚠️ drag-sort mal configurado (columns).";
    body.appendChild(warn);
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "columns";

  const left = document.createElement("div");
  left.className = "dropzone";
  left.innerHTML = `<h3>${c1.title}</h3><div class="drop-target" data-col="${c1.id}"></div>`;

  const right = document.createElement("div");
  right.className = "dropzone";
  right.innerHTML = `<h3>${c2.title}</h3><div class="drop-target" data-col="${c2.id}"></div>`;

  wrap.appendChild(left);
  wrap.appendChild(right);

  const pool = document.createElement("div");
  pool.className = "dropzone";
  pool.innerHTML = `
    <h3>Tarjetas</h3>
    <div class="draggables"></div>
    <div class="row">
      <button class="btn" id="btnCheckDrag" type="button">✅ Comprobar</button>
      <button class="btn ghost" id="btnResetDrag" type="button">↩ Recolocar</button>
    </div>
  `;

  const poolInner = pool.querySelector(".draggables");
  const placements = {}; // cardId -> colId

  const cards = puzzle.cards || [];
  const isTouch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  let selectedCardId = null;

  // crear tarjetas
  cards.forEach(card=>{
    const chip = document.createElement("div");
    chip.className = "draggable";
    chip.draggable = !isTouch; // en táctil, mejor click-to-move
    chip.dataset.card = card.id;
    chip.textContent = card.text;
    chip.tabIndex = 0;

    chip.addEventListener("dragstart", (e)=>{
      e.dataTransfer?.setData("text/plain", card.id);
      chip.classList.add("dragging");
    });
    chip.addEventListener("dragend", ()=>{
      chip.classList.remove("dragging");
    });

    // Fallback táctil: click para “seleccionar”
    chip.addEventListener("click", ()=>{
      if(!isTouch) return;
      const prev = pool.querySelector(`.draggable[data-card="${selectedCardId}"]`) ||
                   body.querySelector(`.draggable[data-card="${selectedCardId}"]`);
      prev?.classList.remove("selected");

      selectedCardId = (selectedCardId === card.id) ? null : card.id;
      chip.classList.toggle("selected", selectedCardId === card.id);
      feedback.textContent = selectedCardId ? "📌 Tarjeta seleccionada. Ahora toca una columna." : " ";
    });

    poolInner.appendChild(chip);
  });

  function wireDropTarget(el){
    // drag desktop
    el.addEventListener("dragover", (e)=> e.preventDefault());
    el.addEventListener("dragenter", ()=> el.classList.add("hover"));
    el.addEventListener("dragleave", ()=> el.classList.remove("hover"));

    el.addEventListener("drop", (e)=>{
      e.preventDefault();
      el.classList.remove("hover");

      const cardId = e.dataTransfer?.getData("text/plain");
      if(!cardId) return;
      placeCard(cardId, el.dataset.col, el);
    });

    // click-to-move (táctil)
    el.addEventListener("click", ()=>{
      if(!isTouch) return;
      if(!selectedCardId){
        feedback.textContent = "📌 Primero selecciona una tarjeta.";
        return;
      }
      placeCard(selectedCardId, el.dataset.col, el);
      // limpiar selección visual
      const chip = body.querySelector(`.draggable[data-card="${selectedCardId}"]`) ||
                   pool.querySelector(`.draggable[data-card="${selectedCardId}"]`);
      chip?.classList.remove("selected");
      selectedCardId = null;
      feedback.textContent = " ";
    });
  }

  function placeCard(cardId, colId, targetEl){
    const cardEl = body.querySelector(`.draggable[data-card="${cardId}"]`) ||
                   pool.querySelector(`.draggable[data-card="${cardId}"]`);
    if(!cardEl) return;

    targetEl.appendChild(cardEl);
    placements[cardId] = colId;
    targetEl.classList.add("filled");
  }

  body.appendChild(pool);
  body.appendChild(wrap);

  body.querySelectorAll(".drop-target").forEach(wireDropTarget);

  // comprobar
  pool.querySelector("#btnCheckDrag").addEventListener("click", ()=>{
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

  // recolocar
  pool.querySelector("#btnResetDrag").addEventListener("click", ()=>{
    // mover todo al pool
    cards.forEach(c=>{
      const el = body.querySelector(`.draggable[data-card="${c.id}"]`);
      if(el) poolInner.appendChild(el);
      delete placements[c.id];
    });
    body.querySelectorAll(".drop-target").forEach(t=>{
      t.classList.remove("filled");
      t.classList.remove("hover");
    });
    feedback.textContent = "↩ Tarjetas recolocadas.";
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
  btn.type = "button";
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
  const row = document.createElement("div");
  row.className = "row";
  row.appendChild(btn);
  body.appendChild(row);
}

function renderOrder({ puzzle, body, feedback, onSolve, onFail }){
  const list = document.createElement("div");
  list.className = "dropzone";
  list.innerHTML = `<h3>Arrastra para ordenar</h3>`;

  const ul = document.createElement("div");
  ul.className = "draggables";

  const items = puzzle.items || [];
  const order = items.map(x=>x.id);

  // Para que no salga ya resuelto de inicio: barajamos salvo que el puzzle lo desactive
  if(puzzle.shuffle !== false) shuffleInPlace(order);

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
        e.dataTransfer?.setData("text/plain", id);
        chip.classList.add("dragging");
      });
      chip.addEventListener("dragend", ()=> chip.classList.remove("dragging"));

      chip.addEventListener("dragover", (e)=> e.preventDefault());
      chip.addEventListener("drop", (e)=>{
        e.preventDefault();
        const draggedId = e.dataTransfer?.getData("text/plain");
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
  btn.type = "button";
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
  const row = document.createElement("div");
  row.className = "row";
  row.appendChild(btn);
  list.appendChild(row);

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
  btn.type = "button";
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
      box.focus();
      box.select?.();
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
  imgWrap.className = "spot-wrap";

  const img = document.createElement("img");
  img.src = puzzle.image;
  img.alt = "Imagen de la prueba";
  imgWrap.appendChild(img);

  (puzzle.zones || []).forEach(z=>{
    const zone = document.createElement("button");
    zone.type = "button";
    zone.className = "spot-zone";
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

  const note = document.createElement("p");
  note.className = "small";
  note.textContent = "Consejo: busca líneas que crean profundidad (punto de fuga).";
  body.appendChild(note);
}
