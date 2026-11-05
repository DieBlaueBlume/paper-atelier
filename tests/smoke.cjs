const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');

async function main(){
  const browser = await chromium.launch({executablePath: process.env.BROWSER_EXECUTABLE});
  try {
    const page = await browser.newPage({offline:true,viewport:{width:1200,height:860}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('dist/PaperAtelier.html')).href);
    await page.waitForFunction(()=>!document.querySelector('#save').disabled);
    const groups=page.locator('.styleGroup');
    assert.equal(await groups.count(),4);
    const seen=new Set();
    for(const group of await groups.all()){
      if(!await group.evaluate(el=>el.open))await group.locator('summary').click();
      const buttons=group.locator('[data-style]');
      assert.ok(await buttons.count()>0);
      for(const button of await buttons.all()){
        const key=await button.getAttribute('data-style');
        assert.ok(!seen.has(key),'Duplicate preset '+key);
        seen.add(key);
        const canvas=await page.locator('#paper').elementHandle();
        await button.click();
        await page.waitForFunction(old=>document.querySelector('#paper')!==old,canvas);
        await canvas.dispose();
        assert.equal(await button.getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('#currentStyle').textContent(),(await button.innerText()).trim());
      }
    }
    await page.click('#newMotif');
    await page.click('[data-shape=cherryFlower]');
    await page.fill('#motifName','测试花边');
    await page.click('#applyMotif');
    await page.reload();
    await page.waitForFunction(()=>!document.querySelector('#save').disabled);
    await page.selectOption('#library',{label:'测试花边'});
    await page.click('#editMotif');
    assert.equal(await page.locator('#itemList option').count(),2);
    await page.click('#cancelMotif');
    page.once('dialog',dialog=>dialog.accept());
    await page.click('#deleteMotif');
    await page.reload();
    await page.waitForFunction(()=>!document.querySelector('#save').disabled);
    assert.equal(await page.locator('#library option').count(),1);
    assert.deepEqual(errors,[]);
    console.log('Rendered '+seen.size+' unique presets. DIY save, edit and delete passed.');
  } finally {await browser.close()}
  execFileSync(process.execPath,[path.join(__dirname,'print.cjs')],{stdio:'inherit'});
  console.log('PDF import, selected-page export and duplex controls passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
