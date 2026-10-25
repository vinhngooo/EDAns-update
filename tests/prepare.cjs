// Download the public vendor code for local integration tests only.
// This does not sign in to ED or read any account data.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
(async () => {
  const directory = path.join(__dirname,'reference');
  fs.mkdirSync(directory,{recursive:true});
  const response = await fetch('https://ed22.engdis.com/appNG/LearningArea/dist/learningAreaApp.js');
  if(!response.ok) throw new Error('Cannot download ED test reference: '+response.status);
  const source = await response.text();
  if(!source.includes('t(t.s=1190)')) throw new Error('The vendor bundle changed; update the test adapter.');
  const context = {window:{}};
  vm.runInNewContext(source.replace('t(t.s=1190)','window.__req=t'),context,{timeout:5000});
  fs.writeFileSync(path.join(directory,'learningAreaApp.js'),source);
  fs.writeFileSync(path.join(directory,'module-208.js'),context.window.__req.m[208].toString());
  console.log('Prepared public Dragula reference.');
})().catch(error=>{ console.error(error.message); process.exitCode=1; });
