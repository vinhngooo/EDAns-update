const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const extension = path.resolve(process.env.EDANS_TEST_DIR || path.join(__dirname,'..'));
const referenceDir = process.env.EDANS_REFERENCE_DIR || path.join(__dirname,'reference');
const bundle = fs.readFileSync(path.join(referenceDir,'learningAreaApp.js'), 'utf8').replace('t(t.s=1190)', 'window.__req=t');
const serviceSource = fs.readFileSync(path.join(referenceDir,'module-208.js'), 'utf8');
const seqQuestions = [{ id: 1, al: [
  { id: 4, a: [{ id: 96, txt: 'Mel gets her lines wrong again.' }] },
  { id: 6, a: [{ id: 91, txt: "The makeup artist fixes Mel's makeup." }] },
  { id: 1, a: [{ id: 16, txt: 'Mel and Ralph are shooting a scene.' }] },
  { id: 2, a: [{ id: 12, txt: 'Mel makes a mistake in her lines.' }] },
  { id: 3, a: [{ id: 17, txt: 'Ralph corrects her.' }] },
  { id: 7, a: [{ id: 98, txt: "The sound technician comes to adjust Mel's mic." }] },
  { id: 5, a: [{ id: 73, txt: 'The director shouts "cut!"' }] },
] }];
const clozeQuestions = [{ id: 2, qt: '<BLANK NUM=4/> <BLANK NUM=1/> <BLANK NUM=8/> <BLANK NUM=2/> <BLANK NUM=6/> <BLANK NUM=3/>', al: [
  { id: 1, a: [{ id: 97, txt: 'documentary' }] },
  { id: 2, a: [{ id: 76, txt: 'screenplay' }] },
  { id: 3, a: [{ id: 29, txt: 'director' }] },
  { id: 4, a: [{ id: 63, txt: 'designer' }] },
  { id: 6, a: [{ id: 19, txt: 'film set' }] },
  { id: 8, a: [{ id: 26, txt: 'special effects' }] },
] }];
const classificationQuestions = [{id:3, al:[
  {id:12,a:[{id:0,txt:'Mel...'},{id:54,txt:'is very anxious.'},{id:71,txt:'is not an experienced movie actor.'},{id:35,txt:'keeps making the same mistake.'}]},
  {id:4,a:[{id:0,txt:'Ralph...'},{id:93,txt:'is very reassuring.'},{id:3,txt:'has been acting for a long time.'},{id:82,txt:'does other things besides acting.'}]},
]}];
const matchingQuestions = [{id:4,dir:'0',al:[
  {id:77,a:[{id:0,txt:'Questions'},{id:0,txt:'Answers'}]},
  {id:11,a:[{id:41,txt:'So I hear you work in the movie industry. Are you an actor?'},{id:28,txt:'No, I work behind the scenes.'}]},
  {id:5,a:[{id:52,txt:'Really? What do you do?'},{id:87,txt:'I work as a camera operator. I prepare and operate the camera equipment.'}]},
  {id:30,a:[{id:63,txt:'Is it a very technical job?'},{id:84,txt:'You need to be technical, but you also get to be creative.'}]},
]}];

async function fixture(kind, questions) {
  const browser = await chromium.launch({ ...(process.env.EDANS_CHROME_PATH ? {executablePath:process.env.EDANS_CHROME_PATH} : {channel:'chrome'}), headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route('**/*', route => route.abort());
  const html = fs.readFileSync(path.join(__dirname, kind + '.html'), 'utf8');
  await page.setContent(`<style>
    body { font:16px sans-serif; margin:30px; }
    ed-la-dndzone, ed-la-dnditem { display:block; }
    .dndZone { min-height:42px; min-width:190px; border:1px solid #aaa; margin:8px; }
    .dnditem { padding:10px; background:#eee; cursor:move; }
    .prSeq__containerW { display:flex; align-items:center; }
    .prSeq__containerW .dndZone { width:700px; }
    .prCLZ__regContainer { display:block; }
    .classification { display:flex; gap:20px; }
    .classification > .prCl__container { width:280px; }
    .prMT_T2T__main { display:flex; gap:24px; }
    .prMT_T2T__answersWrapper { width:720px !important; }
    .prMT_T2T__answersRow { display:flex; align-items:center; }
    .prMT_T2T__answersTextW { width:360px !important; }
    .prMT_T2T__regContainer { width:310px !important; }
    .dndBank .dndZone { display:flex; flex-wrap:wrap; }
    .gu-mirror { position:fixed !important; margin:0 !important; z-index:9999 !important; opacity:.8; }
    .gu-hide { display:none !important; } .gu-transit { opacity:.2; }
    .carry { position:fixed; top:0; right:0; max-width:250px; background:white; }
  </style>${html}`);
  await page.addScriptTag({ content: bundle });
  await page.evaluate(({ kind, serviceSource, questions }) => {
    class Emitter { constructor(){ this.listeners=[]; } subscribe(fn){ this.listeners.push(fn); return { unsubscribe(){} }; } emit(value){ this.listeners.forEach(fn=>fn(value)); } }
    const angular = { Injectable: () => c => c, EventEmitter: Emitter };
    const exports = {};
    const req = id => id === 0 ? angular : window.__req(id);
    (0,eval)('(' + serviceSource + ')')({}, exports, req);
    const service = new exports.DragulaService();
    const zones = [...document.querySelectorAll('.dndZone')];
    const tileTemplates = new Map([...document.querySelectorAll('ed-la-dnditem')].map(el => [el.querySelector('[ans_id]').getAttribute('ans_id'), el.cloneNode(true)]));
    const models = zones.map(z => [...z.querySelectorAll('[ans_id]')].map(el => el.getAttribute('ans_id')));
    window.fixtureModels = models;
    const drake = window.__req(207).dragula(zones, { revertOnSpill:true, moves: el => !!el.querySelector('.draggable') });
    window.fixtureDrags=0;
    drake.on('drag',()=>window.fixtureDrags++);
    service.add('ed-bag', drake);
    drake.models = models;
    service.drop.subscribe(([, el, target, source]) => {
      drake.isCancel=false;
      const ti = zones.indexOf(target), si = zones.indexOf(source);
      const transfer = (from, to) => { if(models[from].length) { const old=models[from][0]; models[from].pop(); models[to].push(old); } };
      if (kind === 'sequence') {
        if(si>ti) for(let n=si; n>ti; n--) transfer(n-1,n);
        else for(let n=si; n<ti; n++) transfer(n+1,n);
      } else if(kind === 'classification') {
        if(ti !== zones.length-1 && ti !== si && models[ti].length === 3) {
          drake.cancel(); drake.isCancel=true;
        }
      } else if(kind === 'matching') {
        if(ti !== zones.length-1 && ti !== si && models[ti].length === 1) {
          drake.cancel(); drake.isCancel=true;
        }
      } else if(ti !== zones.length-1 && si !== ti) transfer(ti,zones.length-1);
    });
    service.handleModels('ed-bag',drake);
    drake.on('drop', () => queueMicrotask(() => {
      zones.forEach((zone,i) => zone.replaceChildren(...models[i].map(id=>tileTemplates.get(id).cloneNode(true))));
    }));
    window.chrome = { runtime: { sendMessage: (_message, callback) => callback({ aRequest:'https://fixture.invalid/item', autho:'test-fixture' }) } };
    window.fetch = async () => ({ ok:true, json:async () => ({ i:{ q:questions } }) });
  }, { kind, serviceSource, questions });
  const extra = path.join(extension, 'autofill.js');
  if (fs.existsSync(extra)) await page.addScriptTag({ path: extra });
  await page.addScriptTag({ path: path.join(extension, 'content.js') });
  await page.addStyleTag({path:path.join(extension,'content.css')});
  return { browser, page };
}

test('one click sorts sequence using list IDs and updates the drag model', async () => {
  const { browser, page } = await fixture('sequence', seqQuestions);
  try {
    await page.getByRole('button',{name:'Lấy lại đáp án',exact:true}).click();
    await page.waitForFunction(() => JSON.stringify(window.fixtureModels) === '[["16"],["12"],["17"],["96"],["73"],["91"],["98"]]', null, {timeout:12000}).catch(()=>{});
    await page.waitForFunction(() => !document.querySelector('.buttonX').disabled);
    assert.deepEqual(await page.evaluate(()=>window.fixtureModels), [['16'],['12'],['17'],['96'],['73'],['91'],['98']]);
    assert.equal(await page.locator('.ansShow > div').first().innerText(), 'Mel and Ralph are shooting a scene.');
    await page.getByRole('button',{name:'Lấy lại đáp án',exact:true}).click();
    await page.waitForTimeout(500);
    assert.deepEqual(await page.evaluate(()=>window.fixtureModels), [['16'],['12'],['17'],['96'],['73'],['91'],['98']]);
  } finally { await browser.close(); }
});

test('partially wrong cloze answers are replaced without losing the displaced word', async () => {
  const { browser, page } = await fixture('cloze', clozeQuestions);
  try {
    // Reproduce a user putting "director" in the documentary blank.
    await page.evaluate(() => {
      const models=window.fixtureModels;
      const zones=[...document.querySelectorAll('.dndZone')];
      const bank=models.at(-1), index=bank.indexOf('29');
      models[1].push(bank.splice(index,1)[0]);
      const wrong=zones.at(-1).querySelector('[ans_id="29"]').parentElement;
      zones[1].appendChild(wrong);
    });
    await page.getByRole('button',{name:'Lấy lại đáp án',exact:true}).click();
    await page.waitForFunction(() => JSON.stringify(window.fixtureModels.slice(0,6)) === '[["63"],["97"],["26"],["76"],["19"],["29"]]',null,{timeout:12000}).catch(()=>{});
    assert.deepEqual((await page.evaluate(()=>window.fixtureModels)).slice(0,6), [['63'],['97'],['26'],['76'],['19'],['29']]);
  } finally { await browser.close(); }
});

test('answer IDs from a different exercise do not trigger any drags', async () => {
  const questions=structuredClone(seqQuestions);
  questions[0].al[0].a[0].id=9999;
  const { browser, page } = await fixture('sequence', questions);
  try {
    const before=await page.evaluate(()=>structuredClone(window.fixtureModels));
    await page.getByRole('button',{name:'Lấy lại đáp án',exact:true}).click();
    await page.waitForTimeout(500);
    assert.deepEqual(await page.evaluate(()=>window.fixtureModels),before);
    assert.match(await page.locator('.ansStatus').innerText(),/chưa khớp/);
  } finally { await browser.close(); }
});

test('one click fills all cloze blanks in BLANK NUM order and leaves distractors', async () => {
  const { browser, page } = await fixture('cloze', clozeQuestions);
  try {
    await page.getByRole('button',{name:'Lấy lại đáp án',exact:true}).click();
    await page.waitForFunction(() => window.fixtureModels.slice(0,6).every(row=>row.length===1),null,{timeout:12000}).catch(()=>{});
    assert.deepEqual((await page.evaluate(()=>window.fixtureModels)).slice(0,6), [['63'],['97'],['26'],['76'],['19'],['29']]);
    assert.deepEqual((await page.evaluate(()=>window.fixtureModels)).at(-1).sort(), ['66','88']);
  } finally { await browser.close(); }
});

test('missing answer data leaves the exercise alone and gives a clear status', async () => {
  const { browser, page } = await fixture('sequence', []);
  try {
    const before = await page.evaluate(()=>structuredClone(window.fixtureModels));
    await page.getByRole('button',{name:'Lấy lại đáp án',exact:true}).click();
    await page.waitForTimeout(800);
    assert.deepEqual(await page.evaluate(()=>window.fixtureModels),before);
    assert.match(await page.locator('.ansStatus').innerText(),/chưa|không|thiếu/i);
  } finally { await browser.close(); }
});

test('navigating before the answer response arrives cancels the stale fill', async () => {
  const { browser, page } = await fixture('sequence', seqQuestions);
  try {
    const before=await page.evaluate(()=>structuredClone(window.fixtureModels));
    await page.evaluate(questions => {
      window.fetch=async()=>({ok:true,json:async()=>{await new Promise(r=>setTimeout(r,250));return {i:{q:questions}};}});
      const next=document.createElement('button');next.id='learning__nextItem';document.body.appendChild(next);
    },seqQuestions);
    await page.getByRole('button',{name:'Lấy lại đáp án',exact:true}).click();
    await page.evaluate(()=>document.querySelector('#learning__nextItem').click());
    await page.waitForTimeout(800);
    assert.deepEqual(await page.evaluate(()=>window.fixtureModels),before);
    assert.equal(await page.locator('.ansStatus').innerText(),'');
    assert.equal(await page.locator('.buttonX').isEnabled(),true);
  } finally { await browser.close(); }
});

test('existing multiple choice filling still selects the correct radio', async () => {
  const questions=[{id:1,al:[{id:1,a:[{id:1,txt:'Wrong',c:0},{id:2,txt:'Correct',c:1}]}]}];
  const { browser, page } = await fixture('sequence',questions);
  try {
    await page.evaluate(()=>document.querySelector('ed-la-sequence-image').outerHTML='<label class="prMCQ__answerLabel"><input type="radio" name="answer" value="1">Wrong</label><label class="prMCQ__answerLabel"><input type="radio" name="answer" value="2">Correct</label>');
    await page.getByRole('button',{name:'Lấy lại đáp án',exact:true}).click();
    assert.equal(await page.locator('input[value="2"]').isChecked(),true);
    assert.equal(await page.locator('input[value="1"]').isChecked(),false);
  } finally { await browser.close(); }
});

test('V classifies all six statements into two multi-answer columns and is repeatable', async () => {
  const {browser,page}=await fixture('classification',classificationQuestions);
  try {
    await page.keyboard.press('v');
    await page.waitForFunction(()=>!document.querySelector('.buttonX').disabled);
    assert.deepEqual(await page.evaluate(()=>window.fixtureModels.map(row=>[...row].sort())),[['35','54','71'],['3','82','93'],[]]);
    assert.match(await page.locator('.ansStatus').innerText(),/6\/6/);
    const drags=await page.evaluate(()=>window.fixtureDrags);
    await page.keyboard.press('v');
    await page.waitForFunction(()=>!document.querySelector('.buttonX').disabled);
    assert.equal(await page.evaluate(()=>window.fixtureDrags),drags);
  } finally {await browser.close();}
});

test('full classification columns with wrong statements are corrected through the bank', async () => {
  const {browser,page}=await fixture('classification',classificationQuestions);
  try {
    await page.evaluate(()=>{
      const zones=[...document.querySelectorAll('.dndZone')];
      const nodes=new Map([...document.querySelectorAll('ed-la-dnditem')].map(el=>[el.querySelector('[ans_id]').getAttribute('ans_id'),el]));
      const rows=[['93','3','82'],['54','71','35'],[]];
      rows.forEach((row,i)=>{
        window.fixtureModels[i].splice(0,window.fixtureModels[i].length,...row);
        zones[i].replaceChildren(...row.map(id=>nodes.get(id)));
      });
    });
    await page.getByRole('button',{name:'Lấy lại đáp án',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.buttonX').disabled);
    assert.deepEqual(await page.evaluate(()=>window.fixtureModels.map(row=>[...row].sort())),[['35','54','71'],['3','82','93'],[]]);
  } finally {await browser.close();}
});

test('duplicate classification IDs are rejected before any drag', async () => {
  const questions=structuredClone(classificationQuestions);
  questions[0].al[1].a[1].id=54;
  const {browser,page}=await fixture('classification',questions);
  try {
    const before=await page.evaluate(()=>structuredClone(window.fixtureModels));
    await page.keyboard.press('v');
    await page.waitForFunction(()=>!document.querySelector('.buttonX').disabled);
    assert.deepEqual(await page.evaluate(()=>window.fixtureModels),before);
    assert.equal(await page.evaluate(()=>window.fixtureDrags),0);
    assert.match(await page.locator('.ansStatus').innerText(),/chưa|không|thiếu/i);
  } finally {await browser.close();}
});

test('V matches three answers to their questions and leaves the two distractors', async () => {
  const {browser,page}=await fixture('matching',matchingQuestions);
  try {
    await page.keyboard.press('v');
    await page.waitForFunction(()=>!document.querySelector('.buttonX').disabled);
    assert.deepEqual((await page.evaluate(()=>window.fixtureModels)).slice(0,3),[['28'],['87'],['84']]);
    assert.deepEqual((await page.evaluate(()=>window.fixtureModels)).at(-1).sort(),['25','94']);
    assert.match(await page.locator('.ansStatus').innerText(),/3\/3/);
    const drags=await page.evaluate(()=>window.fixtureDrags);
    await page.keyboard.press('v');
    await page.waitForFunction(()=>!document.querySelector('.buttonX').disabled);
    assert.equal(await page.evaluate(()=>window.fixtureDrags),drags);
  } finally {await browser.close();}
});

test('matching with the reversed API column direction selects the draggable side', async () => {
  const questions=structuredClone(matchingQuestions);
  questions[0].dir='1';
  questions[0].al.forEach(list=>list.a.reverse());
  const {browser,page}=await fixture('matching',questions);
  try {
    await page.getByRole('button',{name:'Lấy lại đáp án',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.buttonX').disabled);
    assert.deepEqual((await page.evaluate(()=>window.fixtureModels)).slice(0,3),[['28'],['87'],['84']]);
    assert.deepEqual((await page.evaluate(()=>window.fixtureModels)).at(-1).sort(),['25','94']);
  } finally {await browser.close();}
});

test('matching answers already placed in the wrong full rows are corrected', async () => {
  const {browser,page}=await fixture('matching',matchingQuestions);
  try {
    await page.evaluate(()=>{
      const zones=[...document.querySelectorAll('.dndZone')];
      const nodes=new Map([...document.querySelectorAll('ed-la-dnditem')].map(el=>[el.querySelector('[ans_id]').getAttribute('ans_id'),el]));
      const rows=[['87'],['84'],['28'],['94','25']];
      rows.forEach((row,i)=>{
        window.fixtureModels[i].splice(0,window.fixtureModels[i].length,...row);
        zones[i].replaceChildren(...row.map(id=>nodes.get(id)));
      });
    });
    await page.keyboard.press('v');
    await page.waitForFunction(()=>!document.querySelector('.buttonX').disabled);
    assert.deepEqual((await page.evaluate(()=>window.fixtureModels)).slice(0,3),[['28'],['87'],['84']]);
    assert.deepEqual((await page.evaluate(()=>window.fixtureModels)).at(-1).sort(),['25','94']);
  } finally {await browser.close();}
});
