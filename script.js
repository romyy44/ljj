/* Photo Link · 原生 JavaScript，支持直接双击 index.html 离线游玩。 */
(function () {
  'use strict';

  const position = (row, col) => ({ row, col });
  const same = (a, b) => a.row === b.row && a.col === b.col;
  const shuffled = values => {
    const copy = values.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  function occupiedCells(board) {
    const cells = [];
    board.forEach((line, row) => line.forEach((value, col) => {
      if (value) cells.push(position(row, col));
    }));
    return cells;
  }

  function compactPath(points) {
    const path = [];
    points.forEach(point => {
      if (path.length && same(path[path.length - 1], point)) return;
      while (path.length > 1) {
        const a = path[path.length - 2];
        const b = path[path.length - 1];
        if ((a.row === b.row && b.row === point.row) ||
            (a.col === b.col && b.col === point.col)) path.pop();
        else break;
      }
      path.push(point);
    });
    return path;
  }

  /** Return a path of at most two turns. Coordinates may use the one-cell outer ring. */
  function findPath(board, a, b, ignoreKinds = false) {
    const rows = board.length;
    const cols = board[0] ? board[0].length : 0;
    const inside = p => p.row >= 0 && p.row < rows && p.col >= 0 && p.col < cols;
    if (!inside(a) || !inside(b) || same(a, b) || !board[a.row][a.col] ||
        !board[b.row][b.col] || (!ignoreKinds && board[a.row][a.col] !== board[b.row][b.col])) return null;
    const empty = p => !inside(p) || !board[p.row][p.col] || same(p, a) || same(p, b);
    const clear = (p, q) => {
      if (p.row !== q.row && p.col !== q.col) return false;
      const dr = Math.sign(q.row - p.row);
      const dc = Math.sign(q.col - p.col);
      let r = p.row, c = p.col;
      while (true) {
        if (!empty(position(r, c))) return false;
        if (r === q.row && c === q.col) return true;
        r += dr; c += dc;
      }
    };
    const candidates = [];
    const consider = points => {
      const path = compactPath(points);
      if (path.length < 2 || path.length > 4) return;
      if (path.every((p, i) => i === 0 || clear(path[i - 1], p))) {
        const length = path.reduce((sum, p, i) => i === 0 ? sum :
          sum + Math.abs(p.row - path[i - 1].row) + Math.abs(p.col - path[i - 1].col), 0);
        candidates.push({ path, length });
      }
    };
    if (a.row === b.row || a.col === b.col) consider([a, b]);
    consider([a, position(a.row, b.col), b]);
    consider([a, position(b.row, a.col), b]);
    for (let r = -1; r <= rows; r++) consider([a, position(r, a.col), position(r, b.col), b]);
    for (let c = -1; c <= cols; c++) consider([a, position(a.row, c), position(b.row, c), b]);
    candidates.sort((x, y) => x.path.length - y.path.length || x.length - y.length);
    return candidates.length ? candidates[0].path : null;
  }

  function findMove(board) {
    const cells = occupiedCells(board);
    for (let i = 0; i < cells.length; i++) {
      const a = cells[i];
      for (let j = i + 1; j < cells.length; j++) {
        const b = cells[j];
        if (board[a.row][a.col] !== board[b.row][b.col]) continue;
        const path = findPath(board, a, b);
        if (path) return { a, b, path };
      }
    }
    return null;
  }

  /** Assign pairs to a geometrically valid removal order; preserves holes and counts. */
  function reshuffleBoard(board) {
    const rows = board.length, cols = board[0].length;
    const counts = new Map();
    occupiedCells(board).forEach(p => {
      const value = board[p.row][p.col];
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    const pairKinds = [];
    counts.forEach((count, value) => {
      if (count % 2) throw new Error('每种照片的数量必须为偶数');
      for (let i = 0; i < count / 2; i++) pairKinds.push(value);
    });
    const kinds = shuffled(pairKinds);
    const geometry = board.map(line => line.map(value => value ? 1 : 0));
    const output = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (const kind of kinds) {
      const cells = shuffled(occupiedCells(geometry));
      let pair = null;
      // Any consecutive occupied cells in a row can connect. If every row has
      // only one tile, the top two occupied rows connect with one corner.
      for (let i = 0; i < cells.length && !pair; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          if (findPath(geometry, cells[i], cells[j], true)) {
            pair = [cells[i], cells[j]];
            break;
          }
        }
      }
      if (!pair) throw new Error('无法生成可连接的照片对');
      pair.forEach(p => { output[p.row][p.col] = kind; geometry[p.row][p.col] = 0; });
    }
    return output;
  }

  function createSolvableBoard(rows, cols, kindCount = 6) {
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 ||
        rows * cols % 2 || !Number.isInteger(kindCount) || kindCount < 1) {
      throw new Error('棋盘尺寸必须是正整数，且格数必须为偶数');
    }
    const values = [];
    for (let i = 0; i < rows * cols / 2; i++) values.push(i % kindCount + 1, i % kindCount + 1);
    return reshuffleBoard(Array.from({ length: rows }, (_, row) => values.slice(row * cols, (row + 1) * cols)));
  }

  globalThis.PhotoLinkCore = { findPath, findMove, createSolvableBoard, reshuffleBoard, occupiedCells };
  if (typeof document === 'undefined') return;

  function init() {
    const $ = id => document.getElementById(id);
    const boardEl = $('board');
    if (!boardEl) return;
    const wrap = $('board-wrap');
    const layer = $('connection-layer');
    const levels = { easy: { rows: 4, cols: 6 }, normal: { rows: 6, cols: 6 }, hard: { rows: 8, cols: 6 } };
    let difficulty = levels[$('difficulty').value] ? $('difficulty').value : 'normal';
    let board, selected = null, state = 'ready', matched = 0, score = 0;
    let hints = 3, shuffles = 3, accumulated = 0, startedAt = 0;
    let busy = false, generation = 0, activePath = null, soundEnabled = false;
    let audioContext = null, helpWasPlaying = false;
    const timeouts = new Set();
    let records = {};
    try { records = JSON.parse(localStorage.getItem('photo-link-records-v1') || '{}') || {}; } catch (_) { /* Private browsing may block storage. */ }
    const time = () => accumulated + (state === 'playing' ? performance.now() - startedAt : 0);
    const formatTime = ms => {
      const seconds = Math.floor(ms / 1000);
      return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    };
    const setText = (id, value) => { if ($(id)) $(id).textContent = value; };
    const message = text => setText('status-text', text);
    const later = (callback, delay) => {
      const current = generation;
      const handle = setTimeout(() => {
        timeouts.delete(handle);
        if (generation === current) callback();
      }, delay);
      timeouts.add(handle);
    };
    const tileAt = p => boardEl.querySelector('[data-row="' + p.row + '"][data-col="' + p.col + '"]');

    function playTone(success) {
      if (!soundEnabled) return;
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        if (!audioContext) audioContext = new Audio();
        audioContext.resume().catch(() => {});
        const start = audioContext.currentTime;
        const osc = audioContext.createOscillator(), gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(success ? 660 : 190, start);
        if (success) osc.frequency.setValueAtTime(880, start + 0.08);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.08, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
        osc.connect(gain); gain.connect(audioContext.destination);
        osc.start(start); osc.stop(start + 0.22);
      } catch (_) { /* Audio is optional. */ }
    }

    function sync() {
      const total = levels[difficulty].rows * levels[difficulty].cols / 2;
      document.body.dataset.state = state;
      setText('elapsed', formatTime(time()));
      setText('matched', matched);
      setText('total-pairs', total);
      setText('score', String(score).padStart(3, '0'));
      setText('hint-count', hints);
      setText('shuffle-count', shuffles);
      const best = records[difficulty];
      setText('best-time', typeof best === 'number' && best >= 0 ? formatTime(best) : '--:--');
      if ($('progress-fill')) $('progress-fill').style.width = (matched / total * 100) + '%';
      if ($('ready-cover')) $('ready-cover').hidden = state !== 'ready';
      if ($('pause-cover')) $('pause-cover').hidden = state !== 'paused';
      $('hint-btn').disabled = state !== 'playing' || hints < 1 || busy;
      $('shuffle-btn').disabled = state !== 'playing' || shuffles < 1 || busy;
      $('pause-btn').disabled = state === 'ready' || state === 'won';
      $('pause-btn').setAttribute('aria-label', state === 'paused' ? '继续游戏' : '暂停游戏');
      setText('pause-label', state === 'paused' ? '继续' : '暂停');
      boardEl.setAttribute('aria-label', levels[difficulty].rows + '行6列照片棋盘，已消除' + matched + '对');
      boardEl.querySelectorAll('.tile').forEach(tile => {
        tile.disabled = tile.classList.contains('is-empty') || state === 'ready' || state === 'paused' || state === 'won';
      });
    }

    function clearMarks() {
      boardEl.querySelectorAll('.is-selected,.is-hint,.is-wrong').forEach(tile => {
        tile.classList.remove('is-selected', 'is-hint', 'is-wrong');
        tile.setAttribute('aria-pressed', 'false');
      });
      selected = null;
    }

    function drawPath(path) {
      layer.replaceChildren();
      activePath = path;
      if (!path) return;
      const bounds = wrap.getBoundingClientRect();
      const gridBounds = boardEl.getBoundingClientRect();
      const { rows, cols } = levels[difficulty];
      layer.setAttribute('viewBox', '0 0 ' + bounds.width + ' ' + bounds.height);
      const center = p => {
        const safe = position(Math.max(0, Math.min(rows - 1, p.row)), Math.max(0, Math.min(cols - 1, p.col)));
        const cell = tileAt(safe).getBoundingClientRect();
        const x = p.col < 0 ? gridBounds.left - bounds.left - 10 : p.col >= cols ?
          gridBounds.right - bounds.left + 10 : cell.left - bounds.left + cell.width / 2;
        const y = p.row < 0 ? gridBounds.top - bounds.top - 10 : p.row >= rows ?
          gridBounds.bottom - bounds.top + 10 : cell.top - bounds.top + cell.height / 2;
        return { x, y };
      };
      const points = path.map(center);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      line.setAttribute('points', points.map(p => p.x + ',' + p.y).join(' '));
      line.setAttribute('class', 'connection-path');
      line.setAttribute('fill', 'none');
      layer.append(line);
      [points[0], points[points.length - 1]].forEach(p => {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.setAttribute('r', '5');
        dot.setAttribute('class', 'connection-dot'); layer.append(dot);
      });
    }

    function render() {
      boardEl.replaceChildren();
      const { rows, cols } = levels[difficulty];
      boardEl.style.setProperty('--cols', cols);
      boardEl.style.setProperty('--rows', rows);
      board.forEach((line, row) => line.forEach((kind, col) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tile' + (kind ? '' : ' is-empty');
        button.dataset.row = row; button.dataset.col = col; button.dataset.kind = kind;
        button.setAttribute('aria-label', '第' + (row + 1) + '行，第' + (col + 1) + '列，照片' + kind);
        button.setAttribute('aria-pressed', 'false');
        if (!kind) { button.tabIndex = -1; button.setAttribute('aria-hidden', 'true'); }
        if (kind) {
          const image = document.createElement('img');
          image.className = 'tile-image'; image.src = 'bin/photo-' + kind + '.jpg';
          image.alt = ''; image.draggable = false;
          const label = document.createElement('span');
          label.className = 'tile-number'; label.textContent = String(kind).padStart(2, '0');
          button.append(image, label);
        }
        boardEl.append(button);
      }));
      sync();
    }

    function newGame() {
      generation++;
      timeouts.forEach(clearTimeout); timeouts.clear();
      difficulty = levels[$('difficulty').value] ? $('difficulty').value : 'normal';
      const level = levels[difficulty];
      board = createSolvableBoard(level.rows, level.cols);
      selected = null; matched = 0; score = 0; hints = 3; shuffles = 3;
      accumulated = 0; startedAt = 0; busy = false; state = 'ready'; helpWasPlaying = false;
      drawPath(null); render();
      if ($('result-dialog').open) $('result-dialog').close();
      message('照片已经就位，准备把快乐连在一起。');
    }

    function start() {
      if (state !== 'ready') return;
      state = 'playing'; startedAt = performance.now(); sync();
      message('点击两张相同照片，用不超过两次转弯的空路径连起来。');
    }

    function togglePause() {
      if (state === 'playing') {
        accumulated = time(); state = 'paused';
        message('休息一下，照片等你回来。');
      } else if (state === 'paused') {
        state = 'playing'; startedAt = performance.now();
        message('继续寻找下一对相同照片吧。');
      }
      sync();
    }

    function win() {
      accumulated = time(); state = 'won'; busy = false;
      let isBest = false;
      if (typeof records[difficulty] !== 'number' || accumulated < records[difficulty]) {
        records[difficulty] = accumulated; isBest = true;
        try { localStorage.setItem('photo-link-records-v1', JSON.stringify(records)); } catch (_) { /* Offline storage may be unavailable. */ }
      }
      sync();
      message('全部连上了！这一局的快乐，收集完成。');
      setText('result-title', '快乐，全部连上！');
      setText('result-message', isBest ? '刷新了这个难度的最快纪录，漂亮！' : '所有照片配对成功，再来一局创造新纪录吧。');
      setText('result-time', formatTime(accumulated)); setText('result-score', score);
      $('result-dialog').showModal();
    }

    function rescueIfNeeded() {
      if (!occupiedCells(board).length) { win(); return; }
      if (!findMove(board)) {
        board = reshuffleBoard(board); clearMarks(); render();
        message('暂时没有可连照片，已免费为你重新排列。');
      }
    }

    function selectTile(tile) {
      if (state === 'ready') start();
      if (state !== 'playing' || busy || tile.classList.contains('is-empty')) return;
      boardEl.querySelectorAll('.is-hint,.is-wrong').forEach(t => t.classList.remove('is-hint', 'is-wrong'));
      const target = position(Number(tile.dataset.row), Number(tile.dataset.col));
      if (!selected) {
        selected = target; tile.classList.add('is-selected'); tile.setAttribute('aria-pressed', 'true');
        return;
      }
      const first = selected;
      if (same(first, target)) { clearMarks(); return; }
      const firstTile = tileAt(first);
      const path = findPath(board, first, target);
      if (!path) {
        clearMarks(); firstTile.classList.add('is-wrong'); tile.classList.add('is-selected');
        tile.setAttribute('aria-pressed', 'true'); selected = target;
        message(board[first.row][first.col] === board[target.row][target.col] ?
          '这条路被挡住了，试试从空位或棋盘外侧绕过去。' : '两张照片不同，再找找它的另一半。');
        playTone(false);
        later(() => firstTile.classList.remove('is-wrong'), 320);
        return;
      }
      clearMarks(); busy = true; sync();
      [firstTile, tile].forEach(t => t.classList.add('is-matching'));
      drawPath(path); playTone(true);
      later(() => {
        [first, target].forEach(p => {
          board[p.row][p.col] = 0;
          const button = tileAt(p);
          button.classList.remove('is-matching'); button.classList.add('is-empty');
          button.disabled = true; button.tabIndex = -1;
          button.setAttribute('aria-label', '已消除的照片'); button.setAttribute('aria-hidden', 'true');
        });
        matched++; score += 100; drawPath(null); busy = false;
        sync(); message('连上了！+100 分，继续收集快乐。');
        const focusTile = boardEl.querySelector('.tile:not(.is-empty)');
        if (document.activeElement === tile || document.activeElement === firstTile) focusTile?.focus({ preventScroll: true });
        rescueIfNeeded();
      }, 340);
    }

    boardEl.addEventListener('click', event => {
      const tile = event.target.closest('.tile');
      if (tile && boardEl.contains(tile)) selectTile(tile);
    });
    boardEl.addEventListener('keydown', event => {
      const steps = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
      if (!steps[event.key] || state === 'paused' || state === 'won') return;
      const tile = event.target.closest('.tile');
      if (!tile) return;
      event.preventDefault();
      const { rows, cols } = levels[difficulty];
      let row = Number(tile.dataset.row), col = Number(tile.dataset.col);
      const [dr, dc] = steps[event.key];
      for (let i = 0; i < Math.max(rows, cols); i++) {
        row = (row + dr + rows) % rows; col = (col + dc + cols) % cols;
        const next = tileAt(position(row, col));
        if (next && !next.disabled) { next.focus(); break; }
      }
    });
    $('start-btn').addEventListener('click', () => { start(); boardEl.querySelector('.tile')?.focus({ preventScroll: true }); });
    $('pause-btn').addEventListener('click', togglePause);
    $('pause-resume').addEventListener('click', togglePause);
    $('restart-btn').addEventListener('click', newGame);
    $('difficulty').addEventListener('change', newGame);
    $('hint-btn').addEventListener('click', () => {
      if (state !== 'playing' || busy || hints < 1) return;
      const move = findMove(board);
      if (!move) { rescueIfNeeded(); return; }
      clearMarks(); hints--; score = Math.max(0, score - 20); sync();
      [tileAt(move.a), tileAt(move.b)].forEach(tile => tile.classList.add('is-hint'));
      message('找到一对啦！发光的两张照片可以相连。');
      later(() => boardEl.querySelectorAll('.is-hint').forEach(tile => tile.classList.remove('is-hint')), 2500);
    });
    $('shuffle-btn').addEventListener('click', () => {
      if (state !== 'playing' || busy || shuffles < 1) return;
      board = reshuffleBoard(board); shuffles--; score = Math.max(0, score - 30);
      clearMarks(); drawPath(null); render(); message('照片换了个位置，总有新的相遇。');
    });
    $('play-again-btn').addEventListener('click', newGame);
    $('close-result-btn').addEventListener('click', () => $('result-dialog').close());
    if ($('sound-btn')) $('sound-btn').addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      $('sound-btn').setAttribute('aria-pressed', String(soundEnabled));
      $('sound-btn').setAttribute('aria-label', soundEnabled ? '关闭音效' : '开启音效');
      $('sound-btn').title = soundEnabled ? '关闭音效' : '开启音效';
      setText('sound-label', soundEnabled ? '音效开' : '音效关');
      playTone(true);
    });
    if ($('help-btn') && $('help-dialog')) {
      $('help-btn').addEventListener('click', () => {
        helpWasPlaying = state === 'playing';
        if (helpWasPlaying) togglePause();
        $('help-dialog').showModal();
      });
      $('help-dialog').addEventListener('close', () => {
        if (helpWasPlaying && state === 'paused') togglePause();
        helpWasPlaying = false;
      });
    }
    document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
    document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') togglePause(); });
    window.addEventListener('resize', () => { if (activePath) drawPath(activePath); });
    setInterval(() => { if (state === 'playing') setText('elapsed', formatTime(time())); }, 200);
    newGame();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
