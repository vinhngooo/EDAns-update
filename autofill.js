// Runs in the extension's isolated world. Let the site's drag handlers update
// its answer model; moving DOM nodes directly would only change the display.
(() => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const tiles = zone => [...zone.querySelectorAll('ed-la-dnditem > [ans_id]')];
  const identity = answer => answer?.id == null ? null : String(answer.id);
  const answers = list => (list?.a || []).filter(a => identity(a) && identity(a) !== '0');

  function expectedAnswers(questions, kind) {
    if (kind === 'sequence') {
      const lists = questions.flatMap(q => q.al || []);
      if (lists.some(list => !Number.isFinite(Number(list.id)) || answers(list).length !== 1)) return [];
      if (new Set(lists.map(list => Number(list.id))).size !== lists.length) return [];
      return [...lists].sort((a,b) => Number(a.id)-Number(b.id)).map(list => answers(list)[0]);
    }
    const expected = [];
    for (const q of questions) {
      const blanks = [...String(q.qt || '').matchAll(/<BLANK\b[^>]*\bNUM\s*=\s*["']?(\d+)["']?[^>]*\/?\s*>/gi)];
      if (!blanks.length) return [];
      for (const blank of blanks) {
        const list = (q.al || []).find(list => Number(list.id) === Number(blank[1]));
        const options = answers(list);
        if (options.length !== 1) return [];
        expected.push(options[0]);
      }
    }
    return expected;
  }

  function mouse(node, type, x, y) {
    const release = type === 'mouseup';
    const event = new MouseEvent(type, {
      view:window, bubbles:true, cancelable:true,
      clientX:x, clientY:y, button:0, buttons:release ? 0 : 1,
    });
    // Dragula reads `which` in browsers that expose this legacy property.
    Object.defineProperty(event, 'which', {value:1});
    node.dispatchEvent(event);
  }

  async function drag(tile, target, active) {
    let x = 0, y = 0, held = false;
    try {
      if (!active() || !tile.classList.contains('draggable')) return false;
      tile.scrollIntoView({block:'center', inline:'nearest', behavior:'instant'});
      await sleep(35);
      const start = tile.getBoundingClientRect();
      if (!start.width || !start.height) return false;
      x = start.left + start.width / 2;
      y = start.top + start.height / 2;
      mouse(tile, 'mousedown', x, y);
      held = true;
      mouse(document.documentElement, 'mousemove', x + 8, y + 8);
      await sleep(45);
      if (!active()) return false;
      target.scrollIntoView({block:'center', inline:'nearest', behavior:'instant'});
      await sleep(45);
      const end = target.getBoundingClientRect();
      if (!end.width || !end.height) return false;
      const tx = Math.max(1, Math.min(innerWidth - 2, end.left + end.width / 2));
      const ty = Math.max(1, Math.min(innerHeight - 2, end.top + end.height / 2));
      if (tx < end.left || tx > end.right || ty < end.top || ty > end.bottom) return false;
      const sx=x, sy=y;
      for (let i=1; i<=12; i++) {
        if (!active()) return false;
        x=sx+(tx-sx)*i/12;
        y=sy+(ty-sy)*i/12;
        mouse(document.documentElement, 'mousemove', x, y);
        await sleep(16);
      }
      mouse(document.elementFromPoint(x,y) || target, 'mouseup', x, y);
      held=false;
      await sleep(160);
      return active();
    } finally {
      if (held) mouse(document.documentElement, 'mouseup', x, y);
    }
  }

  async function fill(questions, isCurrent = () => true) {
    const root = document.querySelector('ed-la-sequence-image, ed-la-dndcloze, ed-la-dndclassification');
    if (!root) return {supported:false};
    const classification = root.matches('ed-la-dndclassification');
    const kind = root.matches('ed-la-sequence-image') ? 'sequence' : 'cloze';
    const allZones = [...root.querySelectorAll('.dndZone')];
    const isBank = zone => zone.getAttribute('dg_name') === 'TTpTablePlaceHolder' ||
      !!zone.closest('.dndBank, .bankContainer, #bankContainer, .prCl__container--bank') || /^bank_/i.test(zone.id);
    const bank = allZones.find(isBank);
    const zones = allZones.filter(zone => !isBank(zone));
    // Classification uses the API list order for its columns. List IDs are
    // sorted only for sequence exercises; id=0 entries are column headings.
    const lists = classification ? questions.flatMap(q => q.al || []) : [];
    const groups = classification ? lists.map(answers) : expectedAnswers(questions, kind).map(answer => [answer]);
    const placements = groups.flatMap((group,i) => group.map(answer => ({answer, zone:zones[i]})));
    const active = () => isCurrent() && root.isConnected;
    const complete = (zone, id) => !!zone && (classification || tiles(zone).length === 1) &&
      tiles(zone).some(tile => tile.getAttribute('ans_id') === id);
    const displayAnswers = classification ? lists.flatMap(list => [
      (list.a || []).find(answer => identity(answer) === '0')?.txt || '',
      ...answers(list).map(answer => answer.txt || ''),
    ]) : placements.map(({answer}) => answer.txt || '');
    const result = message => ({supported:true, filled:placements.filter(({answer,zone}) => complete(zone,identity(answer))).length,
      total:placements.length || zones.length, message, displayAnswers});
    const ids = placements.map(({answer}) => identity(answer));
    if (!zones.length || groups.length !== zones.length || groups.some(group => !group.length) || new Set(ids).size !== ids.length) {
      return result('Chưa đủ dữ liệu để xác định đáp án của từng ô.');
    }
    // Validate the whole exercise before making any changes. IDs distinguish
    // identical words and prevent applying a previous exercise's answers.
    const available = tiles(root).map(el => el.getAttribute('ans_id'));
    if (ids.some(id => available.filter(value => value === id).length !== 1)) {
      return result('Đáp án chưa khớp bài đang mở. Hãy lấy lại đáp án.');
    }
    if (classification) {
      if (!bank) return result('Chưa tìm thấy ngân hàng câu để phân loại.');
      // Free places before filling: the site's column capacity rejects a drop
      // into a full column. Return misplaced statements through normal drags.
      for (let i=0; i<zones.length; i++) {
        const desired = new Set(groups[i].map(identity));
        const misplaced = tiles(zones[i]).filter(tile => !desired.has(tile.getAttribute('ans_id')))
          .map(tile => tile.getAttribute('ans_id'));
        for (const id of misplaced) {
          if (!active()) return result('Đã dừng vì bài học đã thay đổi.');
          for (let attempt=0; attempt<2 && tiles(zones[i]).some(tile => tile.getAttribute('ans_id') === id); attempt++) {
            const tile = tiles(zones[i]).find(tile => tile.getAttribute('ans_id') === id);
            if (!tile || !active()) break;
            await drag(tile,bank,active);
          }
          if (!active()) return result('Đã dừng vì bài học đã thay đổi.');
          if (!tiles(bank).some(tile => tile.getAttribute('ans_id') === id)) {
            return result('Trang chưa nhận thao tác trả câu về ngân hàng. Hãy thử lại.');
          }
        }
      }
    }
    for (const {answer,zone} of placements) {
      const id = identity(answer);
      if (!active()) return result('Đã dừng vì bài học đã thay đổi.');
      if (complete(zone, id)) continue;
      for (let attempt=0; attempt<2 && !complete(zone, id); attempt++) {
        const tile = tiles(root).find(el => el.getAttribute('ans_id') === id);
        if (!tile || !active()) break;
        await drag(tile, zone, active);
      }
      if (!active()) return result('Đã dừng vì bài học đã thay đổi.');
      if (!complete(zone, id)) return result('Trang chưa nhận thao tác kéo thả. Bạn có thể bấm lấy lại đáp án để thử lại.');
    }
    if (classification && zones.some((zone,i) => tiles(zone).length !== groups[i].length)) {
      return result('Số câu trong cột chưa khớp đáp án. Hãy thử lại.');
    }
    return result('');
  }

  globalThis.EDAnsAutoFill = {fill};
})();
