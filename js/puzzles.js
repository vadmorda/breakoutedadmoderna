export function openPuzzleUI({ puzzle, state, onSolve, onFail, onHint }){
  const modal = document.getElementById("modalPuzzle");
  const title = document.getElementById("puzzleTitle");
  const body = document.getElementById("puzzleBody");
  const feedback = document.getElementById("puzzleFeedback");
  const btnClose = document.getElementById("puzzleClose");
  const btnHint = document.getElementById("btnHint");

  title.textContent = puzzle.title || "Prueba";
  feedback.textContent = " ";

  body.innerHTML = "";
  const p = document.createElement("div");
  p.className = "puzzle-prompt";
  p.innerHTML = puzzle.prompt || "";
  body.appendChild(p);

  btnClose.onclick = () => close();
  btnHint.onclick = () => onHint(puzzle);

  function close(){
    modal.classList.add("hidden");
  }

  if(puzzle.type === "quiz"){
    renderQuiz({ puzzle, body, feedback, onSolve, onFail });
  } else if(puzzle.type === "drag-sort"){
    renderDragSort({ puzzle, body, feedback, onSolve, onFail });
  } else {
    body.innerHTML += `<p class="small">Tipo no implementado aún: ${puzzle.type}</p>`;
  }

  modal.classList.remove("hidden");
}

function renderQuiz({ puzzle, body, feedback, onSolve, onFail }){
  const grid = document.createElement("div");
  grid.className = "answer-grid";

  puzzle.answers.forEach(a=>{
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

  const [c1, c2] = puzzle.columns;

  left.innerHTML = `<h3>${c1.title}</h3><div class="drop-target" data-col="${c1.id}"></div>`;
  right.innerHTML = `<h3>${c2.title}</h3><div class="drop-target" data-col="${c2.id}"></div>`;

  wrap.appendChild(left);
  wrap.appendChild(right);

  const pool = document.createElement("div");
  pool.className = "dropzone";
  pool.innerHTML = `<h3>Tarjetas</h3><div class="draggables"></div><div class="row"><button class="btn" id="btnCheckDrag">✅ Comprobar</button></div>`;
  const poolInner = pool.querySelector(".draggables");

  const placements = {}; // cardId -> colId

  puzzle.cards.forEach(card=>{
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

  const targets = body.querySelectorAll(".drop-target");
  targets.forEach(wireDropTarget);

  body.querySelector("#btnCheckDrag").addEventListener("click", ()=>{
    const allPlaced = puzzle.cards.every(c => placements[c.id]);
    if(!allPlaced){
      feedback.textContent = "⚠️ Aún faltan tarjetas por colocar.";
      return;
    }
    const ok = puzzle.cards.every(c => placements[c.id] === c.correctColumn);
    if(ok){
      feedback.innerHTML = puzzle.successText || "✅ Perfecto.";
      onSolve(puzzle);
    }else{
      feedback.innerHTML = puzzle.failText || "❌ Revisa.";
      onFail(puzzle);
    }
  });
}
