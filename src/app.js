const $ = id => document.getElementById(id);
const {PDFDocument,StandardFonts,rgb,pushGraphicsState,popGraphicsState,concatTransformationMatrix,rectangle,clip,endPath}=PDFLib;
const mm=72/25.4;
const settings={style:'vine',color:'#506a50',width:7,inset:8,mode:'overlay',scope:'all',range:'',gutter:false,offset:5};
let original, pageNo=0, total=0, zoom=1, sourceName='春日植物图鉴', revision=0, busy=false, timer, importId=0;
const pdfColor=hex=>rgb(...[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255));
const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const moduleUrl=id=>URL.createObjectURL(new Blob([decode($(id).textContent)],{type:'text/javascript'}));
const pdfjs=await import(moduleUrl('reader'));
pdfjs.GlobalWorkerOptions.workerSrc=moduleUrl('worker');
const resources=JSON.parse($('resources').textContent);
class LocalAssets {async fetch({filename}){return decode(resources[filename])}}

const plantStamps = new Map();
function registerStamp(key,name,layers){
  const parts=layers.map(([color,svg])=>({
    color,commands:(svg.match(/[MLQCZ][^MLQCZ]*/g)||[]).map(segment=>({
      op:segment[0],coords:(segment.slice(1).match(/-?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?/gi)||[]).map(Number)
    }))
  }));
  plantStamps.set(key,{name,parts});
}
function rotateShape(path,angle){
  return path.replace(/(-?[\d.]+) (-?[\d.]+)/g,(_,x,y)=>
    (x*Math.cos(angle)-y*Math.sin(angle)).toFixed(3)+' '+(x*Math.sin(angle)+y*Math.cos(angle)).toFixed(3));
}
const petal='M0 2 C-4 0 -11 -7 -9 -14 Q-8 -19 -3 -18 L0 -15 L3 -18 Q9 -19 9 -13 C10 -7 4 0 0 2Z';
registerStamp('cherryFlower','山樱花',[
  ...Array.from({length:5},(_,i)=>[i%2?'#e897aa':'#efafbb',rotateShape(petal,i*2*Math.PI/5)]),
  ['#b95570',Array.from({length:5},(_,i)=>rotateShape('M0 1 L-1 -8 L1 -7Z',i*2*Math.PI/5)).join('')],
  ['#e6b64c','M-3 0 Q-3 -4 0 -4 Q4 -4 4 0 Q4 4 0 4 Q-3 4 -3 0Z']
]);
registerStamp('tulipFlower','郁金香',[
  [null,'M-1 17 Q1 7 -1 -3 L1 -4 Q4 6 1 18Z M1 14 Q7 0 17 -1 Q13 11 1 16Z'],
  ['#87a07c','M0 12 Q-11 10 -14 -2 Q-4 0 0 12Z'],
  ['#b84e4c','M-13 -15 L-6 -10 L0 -19 L5 -11 L12 -17 Q15 0 2 4 Q-11 5 -13 -15Z'],
  ['#e7957b','M-13 -15 Q-1 -10 4 3 Q-9 5 -13 -15Z'],
  ['#d87168','M12 -17 Q4 -11 -1 3 Q13 4 12 -17Z']
]);
registerStamp('leafSingle','叶脉单叶',[
  [null,'M-18 13 Q-11 -14 19 -15 Q17 11 -14 13 L-18 17 L-20 16Z'],
  ['#b7ca9b','M-16 13 Q-1 0 16 -12 Q3 2 -16 14Z M-7 6 L-8 -3 L-6 5Z M0 1 L11 1 L2 0Z M5 -4 L5 -10 L7 -5Z']
]);
registerStamp('ginkgoLeaf','银杏叶',[
  [null,'M0 9 L-2 19 L0 19 L2 7Z'],
  ['#dfb555','M0 11 Q-11 7 -18 -4 Q-20 -8 -16 -9 Q-17 -13 -12 -13 Q-11 -17 -7 -15 Q-5 -19 -2 -15 L0 -6 L3 -15 Q7 -18 9 -14 Q15 -15 15 -10 Q21 -9 18 -4 Q12 5 0 11Z'],
  ['#b58b3c','M0 10 Q-8 0 -14 -8 Q-5 0 0 10Z M0 10 Q-4 -1 -7 -12 Q-1 -2 0 10Z M1 9 Q4 -3 9 -11 Q6 -2 1 9Z M1 10 Q9 0 15 -5 Q11 1 1 10Z']
]);
const twig='M-16 17 Q0 1 15 -16 L17 -17 Q3 1 -15 19Z';
const fernLayers=[[null,twig]];
for(let i=0;i<5;i++){
  const x=-12+i*5.6,y=12-i*5.6,len=11-i;
  fernLayers.push([i%2?'#87a67e':'#608568',
    'M'+x+' '+y+'Q'+(x-len*.6)+' '+(y-2)+' '+(x-len*.6)+' '+(y-len)+'Q'+(x+1)+' '+(y-len*.7)+' '+x+' '+y+'Z'+
    'M'+x+' '+y+'Q'+(x+len*.6)+' '+(y-1)+' '+(x+len)+' '+(y+2)+'Q'+(x+len*.4)+' '+(y+6)+' '+x+' '+y+'Z']);
}
registerStamp('fernSprig','蕨叶',fernLayers);
registerStamp('lavenderSprig','薰衣草',[
  [null,'M-9 19 Q-5 4 4 -17 L5 -17 Q-3 5 -7 19Z M-5 11 Q-14 5 -13 -2 Q-7 1 -5 11Z M-4 8 Q2 0 9 -2 Q5 6 -4 8Z'],
  ['#8173a2','M-2 5 Q-11 0 -8 -6 Q-2 -6 -2 5Z M0 -1 Q-8 -7 -4 -12 Q2 -9 0 -1Z M3 -8 Q-3 -13 0 -17 Q6 -15 3 -8Z'],
  ['#aa94bd','M-2 4 Q0 -4 7 -4 Q9 2 -2 4Z M1 -3 Q2 -11 9 -11 Q10 -5 1 -3Z M4 -11 Q2 -18 7 -20 Q11 -16 4 -11Z']
]);
function stampFrame(cx,cy,size=40,angle=0){
  const c=Math.cos(angle)*size/2,s=Math.sin(angle)*size/2;
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>[cx+x*c-y*s,cy+x*s+y*c]);
}
function stampPaths(type,frame,project){
  const [a,b,,d]=frame;
  return plantStamps.get(type).parts.map(({color,commands})=>{
    const path=commands.map(({op,coords})=>{
      const pairs=[];
      for(let i=0;i<coords.length;i+=2){
        const u=(coords[i]+20)/40,v=(coords[i+1]+20)/40;
        pairs.push(project(a[0]+(b[0]-a[0])*u+(d[0]-a[0])*v,a[1]+(b[1]-a[1])*u+(d[1]-a[1])*v));
      }
      return op+pairs.join(' ');
    }).join('');
    return {color,path,stroke:0,fill:true};
  });
}
const flatPoint=(x,y)=>Number(x.toFixed(3))+' '+Number(y.toFixed(3));
const gardenPresets=new Map([
  ['sakuraGarden',['春樱散花',[['leafSingle',33,57,58,.22],['cherryFlower',87,44,84,-.2],['cherryFlower',149,66,53,.42],['leafSingle',177,38,40,-.2]]]],
  ['tulipGarden',['郁金香花圃',[['tulipFlower',42,57,77,-.28],['tulipFlower',104,45,88,.1],['tulipFlower',163,59,67,.25]]]],
  ['goldGarden',['秋日银杏',[['ginkgoLeaf',42,50,84,-.46],['ginkgoLeaf',111,52,68,.36],['ginkgoLeaf',163,64,40,.95]]]],
  ['purpleGarden',['薰衣草花束',[['fernSprig',60,55,68,-.72],['lavenderSprig',90,44,83,-.6],['lavenderSprig',116,48,79,-.15],['lavenderSprig',142,59,64,.22]]]]
]);
function gardenDesign(key){
  const entries=gardenPresets.get(key)[1];
  return {types:entries.map(e=>e[0]),lines:entries.map(([,x,y,size,angle])=>stampFrame(x,y,size,angle)),gap:0,pen:2};
}

const tileSets={
  geometry:[
    ['honey','蜂巢六角',1.4,
      'M0 10L6 2L17 2L23 10L17 18L6 18Z M23 10L31 10L37 2L40 2 M31 10L37 18L40 18 M0 2L6 2 M0 18L6 18'],
    ['checker','棋盘方格',1,'',
      'M0 1L10 1L10 10L0 10Z M10 10L20 10L20 19L10 19Z M20 1L30 1L30 10L20 10Z M30 10L40 10L40 19L30 19Z'],
    ['decoFan','折扇放射',1.05,
      'M1 18L1 13L5 13L5 9L10 9L10 5L15 5L15 2L25 2L25 5L30 5L30 9L35 9L35 13L39 13L39 18Z M3 17L20 18L6 11 M11 7L20 18L16 4 M20 2L20 18L24 4 M29 7L20 18L34 11 M20 18L37 15'],
    ['peaks','叠峰三角',1.2,'M0 18L15 2L30 18Z M9 18L15 11L21 18',
      'M23 2L36 16L39 13L29 2Z'],
    ['cubes','立体方块',1.1,
      'M3 5L12 1L21 5L21 14L12 19L3 14Z M3 5L12 10L21 5 M12 10L12 19 M24 10L33 5L40 9 M24 10L24 16L33 20L33 14L40 10 M24 10L33 14',
      'M12 10L21 5L21 14L12 19Z'],
    ['octagon','八角锦窗',.95,
      'M4 6L9 1L18 1L23 6L23 14L18 19L9 19L4 14Z M7 7L10 4L17 4L20 7L20 13L17 16L10 16L7 13Z M23 6L30 6L33 3L36 6L40 6 M23 14L30 14L33 17L36 14L40 14 M0 6L4 6 M0 14L4 14',
      'M29 10L33 7L37 10L33 13Z']
  ],
  textile:[
    ['herring','人字斜纹',1,'',
      'M0 2L5 2L14 9L9 9Z M0 18L5 18L14 11L9 11Z M13 2L18 2L27 9L22 9Z M13 18L18 18L27 11L22 11Z M26 2L31 2L40 9L35 9Z M26 18L31 18L40 11L35 11Z'],
    ['braid','交错编带',1.3,
      'M0 3C8 3 12 17 20 17C28 17 32 3 40 3 M0 6C8 6 12 20 20 20C28 20 32 6 40 6 M0 17Q4 17 7 14 M13 7Q17 2 20 2Q24 2 27 6 M33 13Q37 17 40 17 M0 14Q4 14 6 12 M14 9Q18 5 20 5Q24 5 26 8 M34 11Q38 14 40 14'],
    ['crosses','十字绣',1.8,
      'M2 3L14 17 M2 17L7 11 M9 9L14 3 M22 7L28 13 M22 13L28 7 M32 7L38 13 M32 13L38 7'],
    ['blanket','锁边针脚',1.4,
      'M0 16L40 16 M1 16Q4 16 4 12L4 3 M11 16Q14 16 14 12L14 7 M21 16Q24 16 24 12L24 3 M31 16Q34 16 34 12L34 7'],
    ['chainLoop','链式绣环',1.45,
      'M0 10C5 3 16 0 20 7C23 14 10 19 1 11 M20 10C25 3 36 0 40 7C43 14 30 19 21 11'],
    ['morse','珠点细线',.8,'M0 3L40 3 M0 17L40 17 M0 10L11 10 M29 10L40 10',
      'M14 10Q14 8 16 8Q18 8 18 10Q18 12 16 12Q14 12 14 10Z M20 10Q20 6 23 6Q26 6 26 10Q26 14 23 14Q20 14 20 10Z']
  ]
};
function compileTile(path=''){
  return (path.match(/[MLQCZ][^MLQCZ]*/g)||[]).map(command=>{
    const coordinates=(command.slice(1).match(/-?[\d.]+/g)||[]).map(Number);
    return {op:command[0],coordinates};
  });
}
const tiles=new Map(Object.values(tileSets).flat().map(([key,name,weight,line,fill])=>
  [key,{name,weight,line:compileTile(line),fill:compileTile(fill)}]));
function tilePath(commands,project){
  return commands.map(({op,coordinates})=>{
    const points=[];
    for(let j=0;j<coordinates.length;j+=2)points.push(project(coordinates[j]/40,coordinates[j+1]/20));
    return op+points.join(' ');
  }).join('');
}
function tileSample(tile){
  let outline='',solid='';
  for(let i=0;i<2;i++){
    const project=(u,v)=>flatPoint(2+36*(i+u),16+18*v);
    outline+=tilePath(tile.line,project);solid+=tilePath(tile.fill,project);
  }
  return [{path:outline,stroke:tile.weight*.9},{path:solid,fill:true,stroke:0}].filter(part=>part.path);
}

const motifStyles = new Map([
  ['wave','水波纹'], ['fret','中式回纹'], ['lace','扇贝蕾丝'],
  ['stars','四芒星'], ['diamond','菱格链'], ['stitch','双针缝线'],...Array.from(tiles,([key,tile])=>[key,tile.name])
]);
function repeatBorder(w,h,d,b,style,design){
  const paths=[];
  const isDrawing=style==='custom';
  const tile=tiles.get(style);
  const gap=isDrawing ? design.gap/100 : .12;
  const pitch=b*(isDrawing ? 2*(1+gap) : 2);
  for(let side=0;side<4;side++){
    const length=(side%2?h:w)-2*(d+b);
    if(length<=0)continue;
    const count=Math.max(1, Math.min(100,Math.round(length/pitch)));
    const step=length/count;
    let outline='',solid='';
    const tileLayers=[];
    for(let i=0;i<count;i++){
      // Rotate the motif with each paper edge so its top always faces outwards.
      function p(u,v){
        const t=b+(i+u)*step, n=b*v;
        const xy=[[d+t,d+n],[w-d-n,d+t],[w-d-t,h-d-n],[d+n,h-d-t]][side];
        return xy.map(x=>Number(x.toFixed(3))).join(' ');
      }
      if(isDrawing){
        const span=Math.min(step/(1+gap),b*2)/step;
        const project=(x,y)=>p(.5+(x/200-.5)*span,.06+.88*y/100);
        design.lines.forEach((points,index)=>{
          const type=design.types?.[index];
          const pieces=plantStamps.has(type)
            ? stampPaths(type,points,project)
            : [{path:points.map(([x,y],j)=>(j?'L':'M')+project(x,y)).join(''),stroke:b*design.pen/100}];
          if(!tileLayers[index])tileLayers[index]=pieces;
          else pieces.forEach((piece,k)=>{tileLayers[index][k].path+=piece.path});
        });
      }else if(tile){
        outline+=tilePath(tile.line,p);solid+=tilePath(tile.fill,p);
      }else if(style==='wave'){
        outline+='M'+p(0,.48)+'Q'+p(.25,-.26)+' '+p(.5,.48)+'T'+p(1,.48)
          +'M'+p(0,.7)+'Q'+p(.25,-.04)+' '+p(.5,.7)+'T'+p(1,.7);
      }else if(style==='fret'){
        const points=[[0,.84],[.83,.84],[.83,.12],[.18,.12],[.18,.55],[.58,.55],[.58,.36]];
        outline+=points.map(([u,v],j)=>(j?'L':'M')+p(u,v)).join('')+'M'+p(.83,.84)+'L'+p(1,.84);
      }else if(style==='lace'){
        outline+='M'+p(0,.12)+'L'+p(1,.12)+'M'+p(0,.12)+'Q'+p(.5,1.75)+' '+p(1,.12)
          +'M'+p(.18,.12)+'Q'+p(.5,1.12)+' '+p(.82,.12);
      }else if(style==='stars'){
        const tips=[[.5,.02],[.58,.42],[.84,.5],[.58,.58],[.5,.98],[.42,.58],[.16,.5],[.42,.42]];
        solid+=tips.map(([u,v],j)=>(j?'L':'M')+p(u,v)).join('')+'Z';
        outline+='M'+p(.91,.5)+'L'+p(1.06,.5);
      }else if(style==='diamond'){
        outline+='M'+p(0,.5)+'L'+p(.5,.04)+'L'+p(1,.5)+'L'+p(.5,.96)+'Z';
        solid+='M'+p(.33,.5)+'L'+p(.5,.32)+'L'+p(.67,.5)+'L'+p(.5,.68)+'Z';
      }else{
        outline+='M'+p(.03,.27)+'L'+p(.69,.27)+'M'+p(.31,.7)+'L'+p(.97,.7);
      }
    }
    for(const parts of tileLayers)paths.push(...parts);
    if(outline)paths.push({path:outline,stroke:isDrawing?b*design.pen/100:b*(tile?tile.weight/20:style==='stitch'?.125:.07)});
    if(solid)paths.push({path:solid,stroke:0,fill:true});
  }
  return paths;
}
const storageKey='paper-atelier.motifs.v1';
function readLibrary(){
  const records=JSON.parse(localStorage.getItem(storageKey)||'[]');
  return records.filter(m=>typeof m.id==='string' && typeof m.name==='string' &&
    Number.isFinite(m.gap) && Number.isFinite(m.pen) && Array.isArray(m.lines) &&
    m.lines.length && m.lines.every(line=>Array.isArray(line)&&line.length>=2&&line.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))));
}
let saved=[];
try{saved=readLibrary()}catch{}
let draft,stroke,pointer;
function svgPaths(paths,color){
  return paths.map(o=>'<path d="'+o.path+'" stroke="'+(o.color||color)+'" stroke-width="'+o.stroke+'" fill="'+(o.fill?(o.color||color):'none')+'"/>').join('');
}
function loadLibrary(){
  const list=$('library');list.replaceChildren(Object.assign(new Option('选择已保存的花边',''),{disabled:true}));
  saved.forEach(m=>list.add(new Option(m.name,m.id)));
  $('savedRow').hidden=!saved.length;
  $('deleteMotif').disabled=settings.style!=='custom';
  list.value=settings.style==='custom'?settings.design.id:'';
  $('editMotif').hidden=settings.style!=='custom';
}
function usePreset(){
  settings.style='vine';delete settings.design;
  document.querySelector('[data-style=vine]').closest('details').open=true;
}
$('deleteMotif').onclick=()=>{
  const motif=saved.find(item=>item.id===$('library').value);
  if(!motif||!window.confirm('删除已保存的花边「'+motif.name+'」？'))return;
  try{
    const remaining=readLibrary().filter(item=>item.id!==motif.id);
    localStorage.setItem(storageKey,JSON.stringify(remaining));
    saved=saved.filter(item=>item.id!==motif.id);
  }catch{
    $('storageNote').textContent='删除失败，浏览器无法更新本地存储。';
    return;
  }
  usePreset();refresh();
  $('storageNote').textContent='已删除「'+motif.name+'」。';
};
window.addEventListener('storage',event=>{
  if(event.key!==storageKey&&event.key!==null)return;
  try{saved=readLibrary()}catch{return}
  if(settings.style==='custom'){
    const current=saved.find(item=>item.id===settings.design.id);
    if(current)settings.design=current;else usePreset();
  }
  refresh();
});
$('library').onchange=()=>{
  const motif=saved.find(m=>m.id===$('library').value);
  if(motif){settings.design=motif;settings.style='custom';refresh()}
};
const pad=$('drawPad');
const shapeLabels={line:'直线',arc:'圆弧',wave:'波浪线',rect:'矩形',circle:'圆形',triangle:'三角形',diamond:'菱形',star:'五角星',pen:'手绘'};
for(const [key,stamp] of plantStamps){
  shapeLabels[key]=stamp.name;
  const button=document.createElement('button');
  button.dataset.shape=key;
  button.innerHTML='<svg aria-hidden="true" viewBox="-22 -22 44 44">'+svgPaths(stampPaths(key,stampFrame(0,0),flatPoint),'#516e53')+'</svg>'+stamp.name;
  $('plants').append(button);
}
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
let selected=-1,tool='select',gesture=null,undoStack=[];
function sample(count,point){return Array.from({length:count+1},(_,i)=>point(i/count))}
function newShape(type){
  if(plantStamps.has(type))return stampFrame(0,0);
  switch(type){
    case 'line':return [[-32,0],[32,0]];
    case 'arc':return sample(24,t=>[48*t-24,12-24*Math.sin(t*Math.PI)]);
    case 'wave':return sample(36,t=>[64*t-32,-9*Math.sin(t*2*Math.PI)]);
    case 'rect':return [[-22,-13],[22,-13],[22,13],[-22,13],[-22,-13]];
    case 'circle':return sample(48,t=>[16*Math.cos(t*2*Math.PI),16*Math.sin(t*2*Math.PI)]);
    case 'triangle':return [[0,-17],[19,16],[-19,16],[0,-17]];
    case 'diamond':return [[0,-18],[22,0],[0,18],[-22,0],[0,-18]];
    case 'star':return sample(10,t=>{
      const angle=t*2*Math.PI-Math.PI/2,r=Math.round(t*10)%2?8:19;
      return [r*Math.cos(angle),r*Math.sin(angle)];
    });
  }
}
function bounds(points){
  const box={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
  for(const [x,y] of points){
    box.left=Math.min(box.left,x);box.right=Math.max(box.right,x);
    box.top=Math.min(box.top,y);box.bottom=Math.max(box.bottom,y);
  }
  return box;
}
function moveWithin(points,dx,dy){
  const b=bounds(points);
  dx=clamp(dx,0-b.left,200-b.right);dy=clamp(dy,0-b.top,100-b.bottom);
  return points.map(([x,y])=>[x+dx,y+dy]);
}
function checkpoint(){
  undoStack.push({lines:structuredClone(draft.lines),types:[...draft.types],selected});
  if(undoStack.length>50)undoStack.shift();
}
function undo(){
  const last=undoStack.pop();if(!last)return;
  draft.lines=last.lines;draft.types=last.types;selected=last.selected;drawEditor();
}
function selectTool(mode){tool=mode;if(mode==='pen')selected=-1;drawEditor()}
function addShape(type){
  checkpoint();
  const offset=(draft.lines.length%5-2)*5;
  draft.lines.push(moveWithin(newShape(type),100+offset,50));
  draft.types.push(type);selected=draft.lines.length-1;selectTool('select');
}
function transform(angle,scale){
  if(selected<0)return;
  const points=draft.lines[selected],b=bounds(points);
  const cx=(b.left+b.right)/2,cy=(b.top+b.bottom)/2;
  const next=points.map(([x,y])=>[
    cx+scale*((x-cx)*Math.cos(angle)-(y-cy)*Math.sin(angle)),
    cy+scale*((x-cx)*Math.sin(angle)+(y-cy)*Math.cos(angle))
  ]);
  const n=bounds(next);
  if(n.right-n.left>200||n.bottom-n.top>100||Math.max(n.right-n.left,n.bottom-n.top)<1)return;
  checkpoint();draft.lines[selected]=moveWithin(next,0,0);drawEditor();
}
function drawEditor(){
  const lines=stroke?[...draft.lines,stroke]:draft.lines;
  const markup=lines.map((points,i)=>{
    const type=draft.types[i];
    if(plantStamps.has(type))return '<g data-item="'+i+'">'+svgPaths(stampPaths(type,points,flatPoint),settings.color)+'</g>';
    const path=points.map(([x,y],j)=>(j?'L':'M')+x+' '+y).join('');
    const first=points[0],last=points.at(-1);
    const closed=points.length>2&&Math.hypot(first[0]-last[0],first[1]-last[1])<.01;
    return '<g data-item="'+i+'"><path d="'+path+'" stroke="'+settings.color+'" stroke-width="'+draft.pen+'" fill="none"/><path d="'+path+'" stroke="transparent" stroke-width="'+Math.max(6,draft.pen+2)+'" fill="'+(closed?'transparent':'none')+'"/></g>';
  }).join('');
  let guides='';
  if(selected>=0){
    const points=draft.lines[selected],b=bounds(points);
    guides='<rect x="'+(b.left-2)+'" y="'+(b.top-2)+'" width="'+(b.right-b.left+4)+'" height="'+(b.bottom-b.top+4)+'" fill="none" stroke="#bf7646" stroke-width=".5" stroke-dasharray="2 1.4" pointer-events="none"/>';
    if(draft.types[selected]==='line')guides+=points.map(([x,y],i)=>'<circle data-end="'+i+'" cx="'+x+'" cy="'+y+'" r="2.5" fill="#fff" stroke="#b4693b" stroke-width=".8"/>').join('');
  }
  pad.innerHTML=markup+guides;pad.style.cursor=tool==='pen'?'crosshair':'default';
  $('chooseTool').setAttribute('aria-pressed',tool==='select');$('penTool').setAttribute('aria-pressed',tool==='pen');
  const picker=$('itemList');
  picker.replaceChildren(new Option('选择一个元素','-1'),...draft.types.map((t,i)=>new Option((i+1)+' · '+(shapeLabels[t]||'手绘'),String(i))));
  picker.value=String(selected);
  document.querySelectorAll('[data-adjust]').forEach(b=>b.disabled=selected<0);
  $('undo').disabled=!undoStack.length;$('clear').disabled=!draft.lines.length;$('applyMotif').disabled=!draft.lines.length;
  $('repeatPreview').innerHTML=svgPaths(repeatBorder(236,100,5,10,'custom',{...draft,lines}),settings.color);
}
function openEditor(motif){
  draft=motif?structuredClone(motif):{id:crypto.randomUUID(),name:'',lines:[],gap:30,pen:4};
  draft.types=draft.lines.map((_,i)=>draft.types?.[i]||'pen');
  selected=-1;tool='select';undoStack=[];gesture=null;stroke=null;pointer=null;
  $('motifName').value=draft.name;$('gap').value=draft.gap;$('pen').value=draft.pen;
  $('studio').showModal();drawEditor();
}
$('newMotif').onclick=()=>openEditor(null);
$('editMotif').onclick=()=>openEditor(settings.design);
$('cancelMotif').onclick=()=>$('studio').close();
$('studio').onclose=()=>{stroke=null;pointer=null;gesture=null};
for(const id of ['gap','pen'])$(id).oninput=()=>{draft[id]=+$(id).value;drawEditor()};
$('undo').onclick=undo;
$('clear').onclick=()=>{checkpoint();draft.lines=[];draft.types=[];selected=-1;drawEditor()};
$('chooseTool').onclick=()=>selectTool('select');
$('penTool').onclick=()=>selectTool('pen');
$('itemList').onchange=e=>{selected=+e.target.value;selectTool('select')};
document.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>addShape(b.dataset.shape));
$('grow').onclick=()=>transform(0,1.13);$('reduce').onclick=()=>transform(0,1/1.13);
$('rotateLeft').onclick=()=>transform(-Math.PI/12,1);$('rotateRight').onclick=()=>transform(Math.PI/12,1);
$('copyItem').onclick=()=>{
  checkpoint();draft.lines.push(moveWithin(draft.lines[selected],7,5));draft.types.push(draft.types[selected]);selected=draft.lines.length-1;drawEditor();
};
$('removeItem').onclick=()=>{
  checkpoint();draft.lines.splice(selected,1);draft.types.splice(selected,1);selected=-1;drawEditor();
};
function coordinate(e){
  const pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(pad.getScreenCTM().inverse());
  return [clamp(pt.x,0,200),clamp(pt.y,0,100)];
}
function snapEnd(point){
  let nearest=point,distance=3;
  draft.lines.forEach((points,i)=>{
    if(i===selected)return;
    for(const target of points){
      const gap=Math.hypot(target[0]-point[0],target[1]-point[1]);
      if(gap<distance){nearest=target;distance=gap}
    }
  });
  return [...nearest];
}
pad.onpointerdown=e=>{
  if(pointer!==null||e.button!==0)return;
  const start=coordinate(e);
  if(tool==='pen')stroke=[start];
  else{
    const end=e.target.closest('[data-end]'),hit=e.target.closest('[data-item]');
    if(!end)selected=hit?Number(hit.dataset.item):-1;
    if(selected<0){drawEditor();return}
    gesture={start,points:structuredClone(draft.lines[selected]),end:end?Number(end.dataset.end):null,changed:false};
  }
  pointer=e.pointerId;pad.setPointerCapture(pointer);drawEditor();
};
function updatePointer(point){
  if(stroke){
    const last=stroke.at(-1);if(Math.hypot(point[0]-last[0],point[1]-last[1])>=1.2)stroke.push(point);
  }else if(gesture){
    const dx=point[0]-gesture.start[0],dy=point[1]-gesture.start[1];
    if(!gesture.changed){if(Math.hypot(dx,dy)<.4)return;checkpoint();gesture.changed=true}
    if(gesture.end!==null)draft.lines[selected][gesture.end]=snapEnd(point);
    else draft.lines[selected]=moveWithin(gesture.points,dx,dy);
  }
}
pad.onpointermove=e=>{if(e.pointerId===pointer){updatePointer(coordinate(e));drawEditor()}};
pad.onpointerup=e=>{
  if(e.pointerId!==pointer)return;updatePointer(coordinate(e));
  if(stroke){
    checkpoint();if(stroke.length===1)stroke.push([stroke[0][0]+(stroke[0][0]<199?1:-1),stroke[0][1]]);
    draft.lines.push(stroke);draft.types.push('pen');
  }
  stroke=null;pointer=null;gesture=null;drawEditor();
};
pad.onpointercancel=()=>{
  if(gesture?.changed){draft.lines[selected]=gesture.points;undoStack.pop()}
  stroke=null;pointer=null;gesture=null;drawEditor();
};
$('applyMotif').onclick=()=>{
  if(!draft.lines.length)return;
  draft.name=$('motifName').value.trim()||'组合花边 '+(saved.length+1);
  saved=[...saved.filter(m=>m.id!==draft.id),draft];
  let persisted=true;
  try{
    const updated=[...readLibrary().filter(item=>item.id!==draft.id),draft];
    localStorage.setItem(storageKey,JSON.stringify(updated));
    saved=updated;
  }catch{persisted=false}
  settings.style='custom';settings.design=draft;$('studio').close();refresh();
  $('storageNote').textContent=persisted?'':'浏览器存储不可用，本次仍可使用并导出。';
};

const orchardStyles=new Map([
  ['willow',{name:'垂柳拂枝',draw({shape,leaf}){
    for(const [x,y,length] of [[12,-3,18],[34,-3,21],[58,1,17],[78,2,15]]){
      shape(0,null,.9,false,[['M',x,y],['Q',x+5,y+4,x+2,y+length*.65]]);
      leaf(x+3,y+3,8,length*.55,2.7,'#8fa76f');
      leaf(x+3,y+7,-6,length*.60,2.4,null);
    }
  }}],
  ['eucalyptus',{name:'尤加利圆叶',draw({shape,oval}){
    for(const [x,y,r,sign] of [[16,-2,7,-1],[30,-2,9,1],[48,0,8,-1],[68,2,9,1],[86,2,6,-1]]){
      const cy=y+sign*r*.84;
      oval(1,sign>0?'#93b2a3':null,x,cy,r*.92,r,sign*.45);
      shape(2,'#d1dcc8',.7,false,[['M',x-2,y],['Q',x+2,cy,x+1,cy+sign*r*.65]]);
    }
  }}],
  ['bamboo',{name:'青竹疏影',draw({shape,leaf}){
    for(const [x,y,sign] of [[16,-2,-1],[53,1,1],[76,2,-1]]){
      shape(0,null,.8,false,[['M',x,y],['Q',x+8,y+sign*3,x+14,y+sign*8]]);
      leaf(x+5,y+sign*2,8,sign*13,2.5,null);
      leaf(x+9,y+sign*4,19,sign*4,3,'#91a47c');
      leaf(x+13,y+sign*7,13,sign*10,2.7,null);
      shape(2,'#a2ac83',2,false,[['M',x-1,y-1.8],['L',x+1,y+1.8]]);
    }
  }}],
  ['maple',{name:'秋枫染枝',draw({shape}){
    const tips=[[0,11],[-12,8],[-9,5],[-17,-1],[-12,-2],[-13,-9],[-5,-5],[-6,-12],[-3,-11],[0,-19],[4,-10],[7,-12],[5,-4],[13,-10],[12,-3],[18,-3],[11,4],[14,7],[2,10]];
    for(const [x,y,s,sign,color] of [[28,-1,.82,1,'#c56d47'],[74,2,.67,-1,'#cc914a']]){
      const pt=(a,b)=>[x+s*(a+.38*b),y+s*sign*b];
      shape(1,color,0,true,[...tips.map(([a,b],i)=>[i?'L':'M',...pt(a,b)]),['Z']]);
      shape(2,null,1.1,false,[['M',...pt(0,14)],['L',...pt(0,8)]]);
      shape(3,'#eed59d',.7,false,[['M',...pt(0,8)],['L',...pt(0,-14)],['M',...pt(0,7)],['L',...pt(-10,-4)],['M',...pt(0,7)],['L',...pt(10,-5)]]);
    }
  }}],
  ['grape',{name:'紫葡萄藤',draw({shape,leaf,oval}){
    leaf(15,-3,18,-12,8,null);leaf(25,-3,12,13,6,'#92a474');
    shape(1,null,.9,false,[['M',52,0],['Q',49,-3,47,-5],['M',68,2],['C',78,-12,89,-8,86,-2],['Q',82,2,81,-3]]);
    for(const [x,y,r,color] of [[43,1,5,'#786385'],[51,1,5.2,'#8e7397'],[59,2,4.8,'#705e82'],[47,8,5,'#8b7298'],[55,9,4.9,'#715b81'],[51,15,4.4,'#846a90']]){
      oval(3,color,x,y,r,r*1.05,0);oval(4,'#c6b0c9',x-r*.35,y-r*.39,.95,.65,-.4);
    }
  }}],
  ['acorn',{name:'橡果小枝',draw({shape,leaf,oval}){
    leaf(13,-1,19,-12,7,null);leaf(27,-2,17,13,7,'#879569');
    for(const [x,y,r] of [[52,4,1],[77,0,.76]]){
      const pt=(a,b)=>[x+a*r,y+b*r];
      shape(1,null,1.1,false,[['M',...pt(3,-8)],['Q',...pt(0,-8),...pt(0,-2)]]);
      shape(2,'#bc844e',0,true,[['M',...pt(-7,-1)],['Q',...pt(-8,10),...pt(0,14)],['Q',...pt(8,10),...pt(7,-1)],['Z']]);
      oval(3,'#79583d',x,y-1,8*r,4*r,-.08);
      shape(4,'#e7bd80',.8,false,[['M',...pt(-4,3)],['Q',...pt(-4,8),...pt(-1,10)]]);
    }
  }}],
  ['cherries',{name:'双生樱桃',draw({shape,leaf,oval}){
    leaf(45,-4,-20,-9,7,null);leaf(68,2,16,-12,6,'#93a978');
    shape(1,null,1.15,false,[['M',35,8],['Q',40,4,48,-6],['Q',49,2,56,10]]);
    for(const [x,y,r,color] of [[34,10,7.3,'#b74f56'],[57,12,7.5,'#9b3f50']]){
      oval(3,color,x,y,r,r*.94,0);
      shape(4,'#efb2a6',1.15,false,[['M',x-5,y],['Q',x-4.5,y-3.4,x-2,y-4]]);
    }
  }}],
  ['blueberries',{name:'蓝莓簇枝',draw({shape,leaf,oval}){
    leaf(11,-2,15,-12,6,null);leaf(23,-2,17,12,6,'#91a391');leaf(68,2,18,-12,7,null);
    shape(1,null,1,false,[['M',42,-1],['L',47,-6],['M',45,0],['Q',53,2,62,6]]);
    for(const [x,y,r,color] of [[48,-7,6.9,'#697f9e'],[61,6,8.1,'#596f91'],[79,10,5.5,'#8598ac']]){
      oval(3,color,x,y,r,r*.96,0);
      const a=x+r*.18,b=y-r*.12;
      shape(4,'#394c68',0,true,[['M',a-2,b-2.3],['L',a,b-1.4],['L',a+2.1,b-2.2],['L',a+1.6,b],['L',a+2.1,b+1.9],['L',a,b+1],['L',a-2,b+1.9],['L',a-1.3,b],['Z']]);
    }
  }}]
]);

const botanicalStyles=new Map([
  ['rose','蔷薇花藤'],['daisy','春日雏菊'],['citrus','金橘枝叶'],['bells','铃兰花串'],...Array.from(orchardStyles,([key,{name}])=>[key,name])
]);

// A sprig uses a 100 × 40 drawing space. Map it to each edge before exporting
// so the same curves form the thumbnail, the page preview and the PDF.
function botanicalBorder(w,h,d,b,style,thumbnail=false){
  const groups=new Map();
  function add(layer,color,width,fill,path){
    const key=[layer,color,width,fill].join('/');
    if(!groups.has(key))groups.set(key,{layer,color,stroke:width,fill,parts:[]});
    groups.get(key).parts.push(path);
  }
  const start=d+.76*b;
  for(let side=0;side<(thumbnail?1:4);side++){
    const length=thumbnail?w:(side%2?h:w)-2*start;
    const count=thumbnail?1:Math.max(1,Math.min(80,Math.round(length/(3.8*b))));
    const unit=thumbnail?w/100:Math.min(b/26,length/count/86);
    for(let i=0;i<count;i++){
      const step=length/count;
      function point(x,y){
        const t=(thumbnail?0:start)+(i+.5)*step+(x-50)*unit,n=(thumbnail?h/2:start)+y*unit;
        const coords=[[t,n],[w-n,t],[w-t,h-n],[n,h-t]][side];
        return coords.map(z=>+z.toFixed(3)).join(' ');
      }
      function shape(layer,color,width,fill,commands){
        const path=commands.map(([cmd,...args])=>{
          const pairs=[];for(let j=0;j<args.length;j+=2)pairs.push(point(args[j],args[j+1]));
          return cmd+pairs.join(' ');
        }).join('');
        add(layer,color,width*unit,fill,path);
      }
      function leaf(x,y,dx,dy,size,color){
        const len=Math.hypot(dx,dy),nx=-dy/len*size,ny=dx/len*size;
        shape(1,color,0,true,[['M',x,y],['Q',x+dx*.42+nx,y+dy*.42+ny,x+dx,y+dy],['Q',x+dx*.56-nx,y+dy*.56-ny,x,y],['Z']]);
        shape(2,'#e1e6bd',.5,false,[['M',x+dx*.12,y+dy*.12],['L',x+dx*.82,y+dy*.82]]);
      }
      function oval(layer,color,x,y,rx,ry,angle,outline=0){
        const c=Math.cos(angle),s=Math.sin(angle);
        const pt=(u,v)=>[x+u*rx*c-v*ry*s,y+u*rx*s+v*ry*c];
        const k=.552285;
        shape(layer,color,outline,!outline,[['M',...pt(1,0)],['C',...pt(1,k),...pt(k,1),...pt(0,1)],['C',...pt(-k,1),...pt(-1,k),...pt(-1,0)],['C',...pt(-1,-k),...pt(-k,-1),...pt(0,-1)],['C',...pt(k,-1),...pt(1,-k),...pt(1,0)],['Z']]);
      }
      const left=50-step/(2*unit),right=100-left;
      shape(0,null,1.25,false,[['M',left,0],['C',24,-10,70,11,right,0]]);
      if(orchardStyles.has(style)){
        orchardStyles.get(style).draw({shape,leaf,oval});
        continue;
      }
      leaf(12,-2,12,-12,5,null);leaf(29,-2,14,10,5.8,'#89a075');
      leaf(57,2,13,-10,4.8,null);leaf(81,3,12,10,5.4,'#94a579');
      if(style==='rose'){
        leaf(47,0,-9,-14,5,'#91a279');
        oval(3,'#a24859',47,-3,11.6,10.4,-.2);
        for(let j=0;j<5;j++){
          const a=j*2*Math.PI/5;
          oval(4,'#e89599',47+6*Math.cos(a),-3+6*Math.sin(a),6.4,5.3,a+.9);
        }
        shape(5,'#c66473',1.7,false,[['M',53,-6],['C',48,-13,38,-6,42,0],['C',45,5,55,0,52,-5],['C',50,-8,44,-7,44,-3],['C',44,0,49,0,49,-3]]);
        oval(3,'#d7818d',76,0,3.7,6,.5);
      }else if(style==='daisy'){
        for(let j=0;j<10;j++){
          const a=j*Math.PI/5;
          for(const [layer,color,outline] of [[3,'#fffcdf',0],[4,'#ae9759',.55]])
            oval(layer,color,47+7*Math.cos(a),-3+7*Math.sin(a),6,2.7,a,outline);
        }
        oval(5,'#d5a339',47,-3,4.2,4.2,0);
        for(const [x,y] of [[46,-4],[48,-2],[45.5,-1.7]])oval(6,'#91682c',x,y,.65,.65,0);
      }else if(style==='citrus'){
        shape(0,null,.95,false,[['M',45,0],['Q',51,2,49,8],['M',71,2],['Q',77,-2,76,-6]]);
        for(const [x,y,r] of [[48,9,8.5],[76,-7,6.3]]){
          oval(3,'#cf792e',x,y,r,r*1.1,.1);
          oval(4,'#f0ae4e',x-1,y-.7,r*.86,r*.95,.1);
          shape(5,'#ffe1a1',.95,false,[['M',x-r*.65,y],['Q',x-r*.75,y-r*.4,x-r*.4,y-r*.62]]);
          leaf(x,y-r*.93,4,-2,1.7,null);
        }
      }else{
        shape(2,null,.85,false,[['M',37,0],['Q',47,-11,62,-7],['Q',69,-8,70,-2],['M',56,-8],['Q',58,-7,57,-2],['M',47,-6],['Q',46,-6,44,0]]);
        for(const [x,y,r] of [[44,0,1],[57,-2,.86],[70,-2,.7]]){
          const p=(a,b)=>[x+a*r,y+b*r];
          const bell=[['M',...p(-2,0)],['C',...p(-7,2),...p(-4,8),...p(-8,11)],['Q',...p(-6,14),...p(-3,11)],['Q',...p(0,15),...p(3,11)],['Q',...p(6,14),...p(8,10)],['C',...p(4,7),...p(5,1),...p(1,0)],['Z']];
          shape(3,'#f6f6df',0,true,bell);shape(4,'#84966e',1,false,bell);
        }
      }
    }
  }
  return [...groups.values()].sort((a,b)=>a.layer-b.layer).map(({parts,...o})=>({...o,path:parts.join('')}));
}

// All ornament shapes use page coordinates measured from the visible top-left.
function cornerFlowerBorder(w,h,d,b,ink,thumbnail=false){
  const paths=[];
  const scale=thumbnail?.63:Math.min(b/19,(w-2*d)*.43/100,(h-2*d)*.43/89);
  function blend(base,amount){
    const channels=[1,3,5].map(i=>{
      const a=parseInt(ink.slice(i,i+2),16),z=parseInt(base.slice(i,i+2),16);
      return Math.round(a+(z-a)*amount).toString(16).padStart(2,'0');
    });
    return '#'+channels.join('');
  }
  const leafLight=blend('#f0e9ce',.50),petal='#a7ccf4',petalShade='#80aee6';
  for(let corner=0;corner<(thumbnail?1:4);corner++){
    function point(x,y){
      const u=(thumbnail?7:d)+x*scale,v=(thumbnail?2:d)+y*scale;
      return flatPoint(corner===1||corner===2?w-u:u,corner>=2?h-v:v);
    }
    function add(commands,color,lineWidth=0,place=(x,y)=>[x,y]){
      const path=commands.map(([op,...xy])=>{
        const pts=[];
        for(let i=0;i<xy.length;i+=2)pts.push(point(...place(xy[i],xy[i+1])));
        return op+pts.join(' ');
      }).join('');
      paths.push({path,color,fill:!lineWidth,stroke:lineWidth*scale});
    }
    // Two unequal stems sweep around the corner, with a shorter flowering shoot.
    add([['M',6,76],['C',7,54,11,32,25,20],['C',43,6,65,13,97,4],
         ['M',14,36],['Q',22,27,36,30],['M',37,15],['Q',45,7,53,5],
         ['M',64,11],['Q',71,18,80,18],['M',9,52],['Q',3,45,3,37]],ink,1.1);
    function leaf(x,y,dx,dy,full,color){
      const len=Math.hypot(dx,dy),nx=-dy/len*full,ny=dx/len*full;
      add([['M',x,y],['Q',x+dx*.50+nx,y+dy*.50+ny,x+dx,y+dy],
           ['Q',x+dx*.54-nx*.74,y+dy*.54-ny*.74,x,y],['Z']],color);
      if(full>=4)add([['M',x+dx*.12,y+dy*.12],['Q',x+dx*.55+nx*.12,y+dy*.55+ny*.12,x+dx*.83,y+dy*.83]],'#eee9d6',.5);
    }
    for(const args of [[9,52,10,-14,4,leafLight],[7,63,-6,-12,3,ink],[6,75,4,-11,2.4,leafLight],
      [13,38,-5,-14,4,ink],[36,15,6,-11,3,leafLight],[47,12,12,7,4,ink],
      [60,11,13,-9,3.8,leafLight],[74,10,12,3,2.7,ink],[85,7,10,-6,2.4,leafLight]])leaf(...args);
    function blossom(cx,cy,size,tilt){
      const lobes=[.99,.87,1.06,.95,1];
      lobes.forEach((r,i)=>{
        const a=tilt+i*Math.PI*2/5;
        const place=(x,y)=>[cx+size*(x*Math.cos(a)-r*y*Math.sin(a)),cy+size*(x*Math.sin(a)+r*y*Math.cos(a))];
        const outline=[['M',-.9,.4],['C',-2.4,-1.9,-6.9,-4.9,-6.2,-8.5],['C',-5.8,-11,-2.5,-11.7,-.2,-10.2],
          ['C',2.8,-12.1,5.9,-10.2,5.7,-7.5],['C',5.4,-4.3,2.2,-1.1,.6,.5],['Z']];
        add(outline,i%2?petalShade:petal,0,place);add(outline,'#446997',.55,place);
        add([['M',-.5,-1.5],['Q',-1.8,-3.8,-2.8,-5.1]],'#5379ad',.5,place);
      });
      for(const [ox,oy,r] of [[0,0,1.4],[-1.7,.1,.75],[.4,-1.9,.8],[1.8,.7,.85],[-.6,1.8,.65]]){
        const x=cx+ox*size,y=cy+oy*size,t=r*size;
        add([['M',x-t,y],['Q',x-t,y-t*1.3,x,y-t],['Q',x+t,y-t,x+t,y],['Q',x+t,y+t,x,y+t],['Q',x-t,y+t,x-t,y],['Z']],'#b18b50');
      }
    }
    blossom(24,21,1.13,.31);blossom(36,30,.54,-.36);
    leaf(51,6,6,-4,3,petalShade);leaf(79,18,7,-2,2.7,petalShade);leaf(3,38,-1,-6,2.5,petalShade);
  }
  return paths;
}

function ornaments(w,h,d,b,style,design,ink='#536951'){
  if(style==='corners')return cornerFlowerBorder(w,h,d,b,ink);
  if(gardenPresets.has(style))return repeatBorder(w,h,d,b,'custom',gardenDesign(style));
  if(botanicalStyles.has(style))return botanicalBorder(w,h,d,b,style);
  if(motifStyles.has(style)||style==="custom")return repeatBorder(w,h,d,b,style,design);
  const paths=[];
  function add(path,stroke,fill=false){paths.push({path,stroke,fill})}
  function box(k,line){add('M '+k+' '+k+' H '+(w-k)+' V '+(h-k)+' H '+k+' Z',line)}
  const line=Math.max(.45,b*.045);
  if(style==='classic'){box(d,line*1.65);box(d+b,line);box(d+b*.76,line*.55)}
  if(style==='vine')box(d+b*.45,line*.68);
  for(let i=0;i<4;i++){
    const X=x=>i===1||i===2?w-d-x:d+x, Y=y=>i>=2?h-d-y:d+y;
    const p=(x,y)=>X(x)+' '+Y(y);
    if(style==='classic'){
      add('M '+p(0,b*1.55)+' L '+p(b*1.55,0)+' L '+p(b*.75,0)+' L '+p(0,b*.75)+' Z',line*.6,true);
      continue;
    }
    for(const swap of [false,true]){
      const pt=(a,c)=>swap?p(c*b,a*b):p(a*b,c*b);
      const length=Math.min(6.8,((swap?h:w)/2-d)/b*.94);
      add('M '+pt(.3,.3)+' Q '+pt(length*.35,1.2)+' '+pt(length,.45),line);
      for(let n=1;n<=Math.floor(length*1.3);n++){
        const a=n*.69,level=.60,tip=n%2?.05:1.22;
        add('M '+pt(a,level)+' Q '+pt(a+.15,tip)+' '+pt(a+.55,tip)+' Q '+pt(a+.47,level)+' '+pt(a,level)+' Z',0,true);
      }
    }

  }
  return paths;
}
class PrintSettingError extends Error {}
function selectedPages(s,count){
  if(s.scope==='all')return null;
  if(s.scope==='first')return new Set([1]);
  const result=new Set();
  const input=s.range.normalize('NFKC').trim().replace(/[–—－]/g,'-');
  if(!input)throw new PrintSettingError('请输入要装饰的页码。');
  for(const part of input.split(/[,、]/)){
    const match=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if(!match)throw new PrintSettingError('用逗号分隔页码或区间，例如 2-10, 12。');
    const start=Number(match[1]),end=Number(match[2]||match[1]);
    if(start<1||end<1||start>count||end>count)throw new PrintSettingError('这份 PDF 的页码范围是 1–'+count+'。');
    if(start>end)throw new PrintSettingError('区间起点应小于或等于终点。');
    for(let n=start;n<=end;n++)result.add(n);
  }
  return result;
}
let selection=null,rangeError='';
function decorate(page,s,number){
  const {x,y,width:w,height:h}=page.getCropBox();
  const unit=page.node.get(PDFLib.PDFName.of('UserUnit'))?.asNumber?.()||1;
  const d=Math.min(s.inset*mm/unit,Math.min(w,h)*.15),b=Math.min(s.width*mm/unit,Math.min(w,h)*.09);
  // Offsets are in displayed page coordinates, including the PDF's /Rotate value.
  const angle=(page.getRotation().angle%360+360)%360;
  const direction=number%2===1?1:-1;
  const offset=s.gutter?s.offset*mm/unit:0;
  const vertical=angle===90||angle===270;
  const dx=vertical?0:offset*direction*(angle===180?-1:1);
  const dy=vertical?offset*direction*(angle===270?-1:1):0;
  const trim=offset?Math.max(0,offset+Math.max(1/unit,b*.1)-d):0;
  const trimX=vertical?0:trim,trimY=vertical?trim:0;
  const frameW=w-2*trimX,frameH=h-2*trimY;
  if(offset && Math.min(frameW,frameH)<=2*(d+2.5*b))throw new PrintSettingError('第 '+number+' 页纸张过小，请减小偏移量、花边宽度或关闭装订留白。');
  if(s.mode==='shrink'){
    if(page.node.Annots()?.size())throw new PrintSettingError('页面含链接、批注或表单，请选择“叠在原页上”以保留其位置。');
    const padding=d+b*(s.style==='corners'?2.5:1.7)+3/unit;
    const scale=Math.max(.1,Math.min(1-2*(padding+Math.abs(dx)+trimX)/w,1-2*(padding+Math.abs(dy)+trimY)/h));
    const ctx=page.doc.context;
    page.node.normalize();
    const wrap=ops=>ctx.register(ctx.contentStream(ops));
    page.node.wrapContentStreams(wrap([pushGraphicsState(),concatTransformationMatrix(scale,0,0,scale,(x+w/2)*(1-scale),(y+h/2)*(1-scale)),rectangle(x,y,w,h),clip(),endPath()]),wrap([popGraphicsState()]));
  }
  const ink=pdfColor(s.color);
  for(const o of ornaments(frameW,frameH,d,b,s.style,s.design,s.color)){
    const color=o.color?pdfColor(o.color):ink;
    page.drawSvgPath(o.path,{x:x+trimX+dx,y:y+h-trimY+dy,borderWidth:o.stroke,borderColor:color,color:o.fill?color:undefined});
  }
}
async function example(){
  const doc=await PDFDocument.create(),f=await doc.embedFont(StandardFonts.TimesRoman),it=await doc.embedFont(StandardFonts.TimesRomanItalic);
  for(let n=0;n<2;n++){
    const page=doc.addPage([420,560]),ink=pdfColor('#354e3c');
    function center(t,y,size,font=f){page.drawText(t,{x:(420-font.widthOfTextAtSize(t,size))/2,y,size,font,color:ink})}
    center('H E R B A R I U M',462,10);center(n?'Field Notes':'Spring Botanica',409,37,it);
    center(n?'Observations from the meadow':'A collection of wildflower studies',386,13,it);
    const path=(s,stroke,fill=false)=>page.drawSvgPath(s,{x:209,y:315,borderColor:ink,borderWidth:stroke,color:fill?pdfColor('#b5c2a0'):undefined});
    for(const [tx,ty,bend] of [[-41,36,-20],[5,4,9],[40,24,18]]){
      path('M -7 137 Q '+bend+' 87 '+tx+' '+ty,1.25);
      for(let k=0;k<3;k++){
        const a=(k+1)/4,x=-7+(tx+7)*a,y=137+(ty-137)*a,sign=k%2?1:-1;
        path('M '+x+' '+y+' q '+(sign*19)+' -2 '+(sign*22)+' -24 q '+(-sign*18)+' 6 '+(-sign*22)+' 24 Z',.75,true);
      }
      for(let k=0;k<8;k++){
        const a=k*Math.PI/4,pt=(r,t)=>(tx+r*Math.cos(a)-t*Math.sin(a))+' '+(ty+r*Math.sin(a)+t*Math.cos(a));
        path('M '+pt(2,0)+' Q '+pt(19,-8)+' '+pt(16,0)+' Q '+pt(17,7)+' '+pt(2,0)+' Z',.75);
      }
      page.drawCircle({x:209+tx,y:315-ty,size:3,color:ink});
    }
    center('Plate '+(n?'II':'I'),121,15,it);center('F L O R A   S T U D I E S',79,8);
  }
  return doc.save();
}
const styleNames=new Map([['classic','复古双线'],['vine','植物藤蔓'],['corners','手绘角花'],...botanicalStyles,...Array.from(gardenPresets,([key,[name]])=>[key,name]),...motifStyles]);
const categories=[
  ['花卉',['rose','daisy','bells','sakuraGarden','tulipGarden','purpleGarden','corners']],
  ['枝叶与果实',['vine','goldGarden','willow','eucalyptus','bamboo','maple','citrus','grape','acorn','cherries','blueberries']],
  ['几何纹样',['fret','diamond','stars',...tileSets.geometry.map(([key])=>key)]],
  ['线条与织纹',['classic','wave','lace','stitch',...tileSets.textile.map(([key])=>key)]]
];
const classifiedKeys=categories.flatMap(([,keys])=>keys);
if(classifiedKeys.length!==styleNames.size || new Set(classifiedKeys).size!==styleNames.size ||
   classifiedKeys.some(key=>!styleNames.has(key))){
  throw new Error('花边分类与样式清单不一致。');
}
function styleCard(key){
  const name=styleNames.get(key);
  const btn=document.createElement('button');btn.className='style';btn.dataset.style=key;
  let sample;
  if(key==='corners')sample=cornerFlowerBorder(76,50,0,1,'#536951',true);
  else if(tiles.has(key))sample=tileSample(tiles.get(key));
  else if(gardenPresets.has(key)){
    const design=gardenDesign(key);
    sample=design.types.flatMap((type,i)=>stampPaths(type,design.lines[i],(x,y)=>flatPoint(2+x*.36,7+y*.36)));
  }else sample=botanicalStyles.has(key)?botanicalBorder(76,50,0,1,key,true):ornaments(76,50,4,2.8,key);
  btn.innerHTML='<svg aria-hidden="true" viewBox="0 0 76 50">'+svgPaths(sample,'#536951')+'</svg>'+name;
  btn.onclick=()=>{settings.style=key;refresh()};
  return btn;
}
for(const [title,keys] of categories){
  const group=document.createElement('details');
  group.className='styleGroup';
  group.open=keys.includes(settings.style);
  const heading=document.createElement('summary');
  const count=document.createElement('small');
  count.textContent=keys.length+' 款';
  heading.append(title,count);
  const grid=document.createElement('div');
  grid.className='styles';
  grid.append(...keys.map(styleCard));
  group.append(heading,grid);
  $('styles').append(group);
}
for(const [color,name] of [['#506a50','苔绿'],['#aa6556','陶红'],['#b28d4c','古金'],['#526e85','雾蓝'],['#3c3b3c','墨黑']]){
  const btn=document.createElement('button');btn.className='swatch';btn.dataset.hex=color;btn.style.background=color;btn.title=name;btn.setAttribute('aria-label',name);
  btn.onclick=()=>{settings.color=color;$('custom').value=color;refresh()};$('colors').insertBefore(btn,$('custom'));
}
document.querySelectorAll('.mode').forEach(b=>b.onclick=()=>{settings.mode=b.dataset.mode;refresh()});
for(const id of ['width','inset','custom','scope'])$(id).oninput=()=>{settings[id==='custom'?'color':id]=['width','inset'].includes(id)?+$(id).value:$(id).value;refresh()};
$('rangeInput').oninput=e=>{settings.range=e.target.value;refresh()};
$('gutter').onchange=e=>{settings.gutter=e.target.checked;refresh()};
$('gutterAmount').oninput=e=>{settings.offset=Number(e.target.value);refresh()};
function refresh(){
  $('rangeBox').hidden=settings.scope!=='custom';
  $('gutterBox').hidden=!settings.gutter;
  $('gutterValue').textContent=settings.offset+' mm';
  rangeError='';selection=null;
  try{selection=selectedPages(settings,total)}catch(e){rangeError=e.message}
  $('rangeInput').setAttribute('aria-invalid',String(Boolean(rangeError)));
  $('rangeNote').textContent=rangeError||(selection?'共选中 '+selection.size+' 页。当前第 '+(pageNo+1)+' 页'+(selection.has(pageNo+1)?'将加花边。':'保留原样。'):'');
  $('save').disabled=true;
  $('currentStyle').textContent=settings.style==='custom'?settings.design.name:styleNames.get(settings.style);
  $('colorLabel').textContent=(settings.style==='corners'||botanicalStyles.has(settings.style)||gardenPresets.has(settings.style))?'枝叶主色':'花边颜色';
  loadLibrary();
  document.querySelectorAll('[data-style],[data-hex],[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.style===settings.style||b.dataset.hex===settings.color||b.dataset.mode===settings.mode)));
  $('wv').textContent=settings.width+' mm';$('iv').textContent=settings.inset+' mm';
  $('pages').textContent=(pageNo+1)+' / '+total;$('prev').disabled=pageNo===0;$('next').disabled=pageNo>=total-1;
  $('zoom').textContent=Math.round(zoom*100)+'%';$('minus').disabled=zoom<=.75;$('plus').disabled=zoom>=3;
  revision++;clearTimeout(timer);timer=setTimeout(render,110);
}
async function render(){
  if(busy||!original)return;busy=true;
  const stamp=revision,index=pageNo;let pdf;
  try{
    const d=await PDFDocument.load(original);
    if(!rangeError&&(!selection||selection.has(index+1)))decorate(d.getPage(index),settings,index+1);
    pdf=await pdfjs.getDocument({data:await d.save({updateFieldAppearances:false}),useWorkerFetch:false,BinaryDataFactory:LocalAssets,isEvalSupported:false}).promise;
    const page=await pdf.getPage(index+1),v=page.getViewport({scale:1}),desk=$('desk');
    const fit=Math.min((desk.clientWidth-48)/v.width,(desk.clientHeight-44)/v.height)*zoom;
    const view=page.getViewport({scale:fit*Math.min(devicePixelRatio||1,2)*1.4});
    const c=document.createElement('canvas');c.width=Math.ceil(view.width);c.height=Math.ceil(view.height);
    await page.render({canvasContext:c.getContext('2d'),viewport:view}).promise;
    if(stamp!==revision)return;
    c.id='paper';c.setAttribute('aria-label','PDF 花边预览');c.style.width=v.width*fit+'px';c.style.height=v.height*fit+'px';$('paper').replaceWith(c);
    $('size').textContent=Math.round(v.width/mm)+' × '+Math.round(v.height/mm)+' mm';$('status').textContent='';$('save').disabled=Boolean(rangeError);
  }catch(e){if(stamp===revision){$('status').textContent=e instanceof PrintSettingError?e.message:'预览失败，请确认文件可正常打开后重新导入。';$('save').disabled=true}}
  finally{if(pdf)await pdf.destroy();busy=false;if(revision!==stamp)render()}
}
$('plus').onclick=()=>{zoom=Math.min(3,zoom+.25);refresh()};$('minus').onclick=()=>{zoom=Math.max(.75,zoom-.25);refresh()};
$('next').onclick=()=>{pageNo++;refresh()};$('prev').onclick=()=>{pageNo--;refresh()};
$('open').onclick=()=>$('file').click();$('file').onchange=()=>{loadFile($('file').files[0]);$('file').value=''};
async function loadFile(file){
  if(!file)return;const id=++importId;
  try{const bytes=new Uint8Array(await file.arrayBuffer()),d=await PDFDocument.load(bytes);if(id!==importId)return;
    if(!d.getPageCount())throw Error();original=bytes;total=d.getPageCount();pageNo=0;zoom=1;sourceName=file.name.replace(/\.pdf$/i,'');$('filename').textContent=file.name;$('status').textContent='正在生成预览…';refresh();
  }catch(e){if(id===importId)$('status').textContent=/encrypt/i.test(e.message)?'此 PDF 有密码保护，请先解锁后再导入。':'无法打开该文件，请选择完整的 PDF 文件。'}
}
window.ondragover=e=>e.preventDefault();window.ondrop=e=>{e.preventDefault();$('desk').classList.remove('over');loadFile(e.dataTransfer.files[0])};$('desk').ondragover=()=>$('desk').classList.add('over');$('desk').ondragleave=()=>$('desk').classList.remove('over');
let exporting=false;
$('save').onclick=async()=>{
  if(exporting)return;exporting=true;const s={...settings},name=sourceName;
  try{$('save').textContent='正在导出…';const d=await PDFDocument.load(original),pages=d.getPages();
    const chosen=selectedPages(s,pages.length);
    pages.forEach((p,index)=>{if(!chosen||chosen.has(index+1))decorate(p,s,index+1)});
    const url=URL.createObjectURL(new Blob([await d.save({updateFieldAppearances:false})],{type:'application/pdf'}));
    const a=document.createElement('a');a.href=url;a.download=name+'-花边.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);$('status').textContent='花边 PDF 已生成，可在浏览器下载记录中查看。';
  }catch(e){$('status').textContent=e instanceof PrintSettingError?e.message:'导出失败，请重新导入后重试。'}finally{exporting=false;$('save').textContent='↓ 导出 PDF'}
};
original=await example();total=2;new ResizeObserver(refresh).observe($('desk'));refresh();
