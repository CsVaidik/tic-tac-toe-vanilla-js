(function(){
    const boardEl = document.getElementById('board');
    const statusEl = document.getElementById('status');
    const resultMsgEl = document.getElementById('resultMsg');
    const turnBadge = document.getElementById('turnBadge');
    const newBtn = document.getElementById('newBtn');
    const resetBtn = document.getElementById('resetBtn');
    const clearBtn = document.getElementById('clearBtn');
    const modeSel = document.getElementById('mode');
    const sideSel = document.getElementById('side');
    const sideWrap = document.getElementById('sideWrap');
    const xWinsEl = document.getElementById('xWins');
    const oWinsEl = document.getElementById('oWins');
    const drawsEl = document.getElementById('draws');
    const sr = document.getElementById('sr');

    const WINS = [
      [0,1,2],[3,4,5],[6,7,8], // rows
      [0,3,6],[1,4,7],[2,5,8], // cols
      [0,4,8],[2,4,6]          // diagonals
    ];

    // State
    let state = {
      board: Array(9).fill(null),
      turn: 'X',
      over: false,
      vsCPU: false,
      humanSide: 'X',
      scores: { X:0, O:0, D:0 },
      theme: localStorage.getItem('ttt-theme') || 'dark'
    };

    // Load persisted data
    try{
      const saved = JSON.parse(localStorage.getItem('ttt-scores'));
      if(saved && typeof saved === 'object') state.scores = saved;
      const savedMode = localStorage.getItem('ttt-mode');
      if(savedMode) state.vsCPU = savedMode === 'cpu';
      const savedSide = localStorage.getItem('ttt-side');
      if(savedSide) state.humanSide = savedSide;
    }catch(e){}

    // Apply UI from saved
    modeSel.value = state.vsCPU ? 'cpu' : 'pvp';
    sideSel.value = state.humanSide;
    if(state.theme === 'light') document.body.classList.add('light');

    // Build board
    const cells = [];
    for(let i=0;i<9;i++){
      const b = document.createElement('button');
      b.className = 'cell';
      b.setAttribute('data-idx', i);
      b.setAttribute('role','gridcell');
      b.setAttribute('aria-label', `Cell ${i+1}`);
      b.addEventListener('click', () => handleMove(i));
      b.addEventListener('keydown', (e)=> handleKeyNav(e, i));
      boardEl.appendChild(b);
      cells.push(b);
    }

    function announce(text){ sr.textContent = text; }

    function resetBoard(startTurn){
      state.board = Array(9).fill(null);
      state.over = false;
      state.turn = startTurn || 'X';
      cells.forEach(c => { c.textContent=''; c.className='cell'; c.disabled=false; });
      resultMsgEl.textContent = 'Make your move.';
      updateTurnBadge();
      if(state.vsCPU && state.turn !== state.humanSide){
        setTimeout(cpuMove, 450);
      }
    }

    function updateTurnBadge(){
      turnBadge.textContent = state.turn;
      turnBadge.className = 'badge ' + state.turn;
    }

    function renderScores(){
      xWinsEl.textContent = state.scores.X;
      oWinsEl.textContent = state.scores.O;
      drawsEl.textContent = state.scores.D;
      localStorage.setItem('ttt-scores', JSON.stringify(state.scores));
    }

    function handleMove(i){
      if(state.over) return;
      if(state.board[i]) return; // occupied
      // If vsCPU, ensure human turn
      if(state.vsCPU && state.turn !== state.humanSide) return;

      place(i, state.turn);
      const outcome = evaluate();
      if(outcome) return finish(outcome);

      // next turn
      state.turn = other(state.turn);
      updateTurnBadge();

      if(state.vsCPU && state.turn !== state.humanSide && !state.over){
        setTimeout(cpuMove, 450);
      }
    }

    function place(i, mark){
      state.board[i] = mark;
      const c = cells[i];
      c.textContent = mark;
      c.classList.add(mark);
      c.disabled = true;
    }

    function evaluate(){
      for(const [a,b,c] of WINS){
        const v = state.board[a];
        if(v && v===state.board[b] && v===state.board[c]){
          cells[a].classList.add('winning');
          cells[b].classList.add('winning');
          cells[c].classList.add('winning');
          return v; // winner mark
        }
      }
      if(state.board.every(Boolean)) return 'D'; // draw
      return null;
    }

    function finish(outcome){
      state.over = true;
      if(outcome==='D'){
        resultMsgEl.textContent = "It's a draw.";
        state.scores.D++;
        announce('Draw.');
      } else {
        resultMsgEl.textContent = `${outcome} wins!`;
        state.scores[outcome]++;
        announce(`${outcome} wins`);
      }
      renderScores();
      // Disable remaining
      cells.forEach((c,i)=>{ if(!state.board[i]) c.disabled=true; });
    }

    function other(mark){ return mark==='X'?'O':'X'; }

    // Simple but strong AI: win > block > fork > center > corner > side
    function cpuMove(){
      if(state.over) return;
      const cpu = other(state.humanSide);
      if(state.turn !== cpu) return; // safety

      const move = bestMove(cpu, state.board.slice());
      if(move != null){
        place(move, cpu);
      }
      const outcome = evaluate();
      if(outcome) return finish(outcome);
      state.turn = other(state.turn);
      updateTurnBadge();
    }

    function bestMove(me, board){
      const opp = other(me);
      // 1) Can I win?
      let m = findWinningMove(board, me); if(m!=null) return m;
      // 2) Can I block?
      m = findWinningMove(board, opp); if(m!=null) return m;
      // 3) Fork (create two threats)
      m = findForkMove(board, me); if(m!=null) return m;
      // 4) Block opponent fork
      m = blockOpponentFork(board, me, opp); if(m!=null) return m;
      // 5) Center
      if(!board[4]) return 4;
      // 6) Opposite corner
      const corners = [[0,8],[2,6]];
      for(const [a,b] of corners){ if(board[a]===opp && !board[b]) return b; if(board[b]===opp && !board[a]) return a; }
      // 7) Any corner
      for(const i of [0,2,6,8]) if(!board[i]) return i;
      // 8) Any side
      for(const i of [1,3,5,7]) if(!board[i]) return i;
      return null;
    }

    function findWinningMove(board, mark){
      for(const [a,b,c] of WINS){
        const line = [board[a],board[b],board[c]];
        const empties = [a,b,c].filter((idx, j) => !line[j]);
        const marks = line.filter(v=>v===mark).length;
        if(empties.length===1 && marks===2){ return empties[0]; }
      }
      return null;
    }

    function findForkMove(board, mark){
      const empties = board.map((v,i)=> v?null:i).filter(v=>v!=null);
      for(const i of empties){
        const clone = board.slice();
        clone[i] = mark;
        let threats = 0;
        for(const [a,b,c] of WINS){
          const line = [clone[a],clone[b],clone[c]];
          if(line.filter(v=>v===mark).length===2 && line.includes(null)) threats++;
        }
        if(threats >= 2) return i;
      }
      return null;
    }

    function blockOpponentFork(board, me, opp){
      // Try to force opponent to defend by creating a line with two in a row
      const empties = board.map((v,i)=> v?null:i).filter(v=>v!=null);
      for(const i of empties){
        const clone = board.slice(); clone[i] = me;
        if(findWinningMove(clone, me)!=null) return i;
      }
      // Otherwise, if opponent can fork, take one of the forking cells to reduce options
      for(const i of empties){
        const clone = board.slice(); clone[i] = opp;
        if(findForkMove(clone, opp)!=null) return i; // occupy a fork spot
      }
      return null;
    }

    function handleKeyNav(e, idx){
      const key = e.key;
      const row = Math.floor(idx/3), col = idx%3;
      let target = null;
      if(key==='ArrowRight' && col<2) target = idx+1;
      else if(key==='ArrowLeft' && col>0) target = idx-1;
      else if(key==='ArrowDown' && row<2) target = idx+3;
      else if(key==='ArrowUp' && row>0) target = idx-3;
      else if(key==='Enter' || key===' '){ e.preventDefault(); handleMove(idx); return; }
      if(target!=null){ e.preventDefault(); cells[target].focus(); }
    }

    // Controls
    newBtn.addEventListener('click', ()=> resetBoard('X'));
    resetBtn.addEventListener('click', ()=> resetBoard(state.turn));
    clearBtn.addEventListener('click', ()=>{ state.scores={X:0,O:0,D:0}; renderScores(); announce('Scores cleared'); });
    modeSel.addEventListener('change', ()=>{
      state.vsCPU = modeSel.value==='cpu';
      localStorage.setItem('ttt-mode', state.vsCPU?'cpu':'pvp');
      sideWrap.style.display = state.vsCPU ? '' : 'none';
      resetBoard('X');
    });
    sideSel.addEventListener('change', ()=>{
      state.humanSide = sideSel.value;
      localStorage.setItem('ttt-side', state.humanSide);
      resetBoard('X');
    });

    document.getElementById('themeBtn').addEventListener('click', ()=>{
      document.body.classList.toggle('light');
      state.theme = document.body.classList.contains('light') ? 'light' : 'dark';
      localStorage.setItem('ttt-theme', state.theme);
    });

    // Init
    sideWrap.style.display = state.vsCPU ? '' : 'none';
    renderScores();
    resetBoard('X');
  })();