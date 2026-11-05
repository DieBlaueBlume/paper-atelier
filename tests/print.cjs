const {chromium}=require('playwright'),{PDFDocument,degrees,rgb,PDFName}=require('pdf-lib'),fs=require('fs'),assert=require('assert/strict'),path=require('path');
(async()=>{
const d=await PDFDocument.create();
for(let n=1;n<=13;n++){
 const p=d.addPage([440,590]);p.setCropBox(10,15,420,560);p.setRotation(degrees([0,90,180,270][(n-1)%4]));
 p.drawRectangle({x:160,y:210,width:50,height:70,color:rgb(0,0,1)});
}
fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/scope-source.pdf',await d.save());
const b=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true});
try{
const p=await b.newPage({offline:true,viewport:{width:1180,height:860}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(require('url').pathToFileURL(path.resolve('dist/PaperAtelier.html')).href);
await p.waitForFunction(()=>!document.querySelector('#save').disabled);await p.locator('#file').setInputFiles('test-results/scope-source.pdf');await p.waitForFunction(()=>document.querySelector('#pages').textContent.includes('/ 13'));
await p.selectOption('#scope','custom');
for(const bad of ['','3-2','0','14','1,,3','1a']){await p.fill('#rangeInput',bad);assert(await p.locator('#save').isDisabled());assert.equal(await p.locator('#rangeInput').getAttribute('aria-invalid'),'true')}
await p.fill('#rangeInput','2-10， 12, 9');assert.match(await p.locator('#rangeNote').innerText(),/10 页.*保留原样/);
await p.click('#next');assert.match(await p.locator('#rangeNote').innerText(),/将加花边/);
async function slider(id,value){await p.locator('#'+id).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input'))},value)}
await slider('custom','#ff0000');await slider('inset','18');
async function save(name){await p.waitForFunction(()=>!document.querySelector('#save').disabled);const dl=p.waitForEvent('download');await p.click('#save');await(await dl).saveAs('test-results/print-'+name+'.pdf')}
await save('baseline');await p.check('#gutter');await save('offset5');await slider('gutterAmount','10');await save('offset10');await slider('inset','1');await save('tight');await p.selectOption('#scope','first');await save('first');await p.selectOption('#scope','all');await save('all');assert.deepEqual(errors,[]);
for(const [name,expected] of [['offset10',[2,3,4,5,6,7,8,9,10,12]],['first',[1]],['all',Array.from({length:13},(_,i)=>i+1)]]){
 const out=await PDFDocument.load(fs.readFileSync('test-results/print-'+name+'.pdf'));
 const original=await PDFDocument.load(fs.readFileSync('test-results/scope-source.pdf'));
 assert.equal(out.getPageCount(),13);
 out.getPages().forEach((page,index)=>{
   const extra=page.node.Contents().size()>original.getPage(index).node.Contents().size();
   assert.equal(extra,expected.includes(index+1),'Page selection at '+(index+1));
 });
}
}finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
