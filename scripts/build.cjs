const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const modules = path.join(root, 'node_modules');
const pdfjs = path.join(modules, 'pdfjs-dist');
const read = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const encode = p => fs.readFileSync(p).toString('base64');

const parts = [];
for (const [id, filename] of [['reader', 'pdf.min.mjs'], ['worker', 'pdf.worker.min.mjs']]) {
  parts.push('<script type="application/octet-stream" id="' + id + '">' +
    encode(path.join(pdfjs, 'build', filename)) + '</script>');
}
const assets = {};
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
  const dir = path.join(pdfjs, folder);
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.startsWith('LICENSE') && fs.statSync(path.join(dir, name)).isFile())
      assets[name] = encode(path.join(dir, name));
  }
}
parts.push('<script type="application/json" id="resources">' + JSON.stringify(assets) + '</script>');
parts.push('<script>' + read(path.join(modules, 'pdf-lib/dist/pdf-lib.min.js')) + '</script>');

const notices = [read(path.join(root, 'LICENSE'))];
for (const name of ['pdf-lib', '@pdf-lib/standard-fonts', '@pdf-lib/upng', 'pako', 'tslib', 'pdfjs-dist',
  'pdfjs-dist/cmaps', 'pdfjs-dist/standard_fonts', 'pdfjs-dist/wasm']) {
  const dir = path.join(modules, name);
  for (const file of fs.readdirSync(dir).filter(n => /^(license|copyright|notice)/i.test(n)).sort()) {
    notices.push(name + '/' + file + '\n\n' + read(path.join(dir, file)));
  }
}
parts.push('<script type="text/plain" id="licenses">' + notices.join('\n\n') + '</script>');
const html = read(path.join(root, 'src/base.html'))
  .replace('<!--LIB-->', () => parts.join('\n'))
  .replace('/*APP*/', () => read(path.join(root, 'src/app.js')));
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/PaperAtelier.html'), html);
console.log('Built dist/PaperAtelier.html (' + Buffer.byteLength(html) + ' bytes)');
