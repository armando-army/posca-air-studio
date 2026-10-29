import { GestureController, widthFromGap } from './gestures.mjs';
const $=s=>document.querySelector(s);
const colors={rosa:{ink:'#f44e9d',bg:'#f8cee2',name:'Rosa chicle'},naranja:{ink:'#ff881f',bg:'#ffe0bd',name:'Naranja'},verde:{ink:'#3cae71',bg:'#cce8d6',name:'Verde'},violeta:{ink:'#9253ca',bg:'#e5d8f5',name:'Violeta'}};
let selected='rosa', strokes=[],current=null,strokeWidth=38, stream=null,detector=null,starting=false,raf=0,lastVideo=-1,prevHand=null,pinching=false;
const canvas=$('#paper'),ctx=canvas.getContext('2d'),video=$('#video'),cursor=$('#cursor');
const gestures=new GestureController();
let gestureDrawing=false,focusedControl=null,draftWidth=38,sizeMode=false,sizeFreeze=null,previousFocus=null;
let vw=innerWidth,vh=innerHeight,dpr=Math.min(devicePixelRatio||1,2);
const stamp=document.createElement('canvas');stamp.width=stamp.height=96;const sc=stamp.getContext('2d');
function makeStamp(color){sc.clearRect(0,0,96,96);sc.fillStyle=color;sc.beginPath();sc.ellipse(48,48,46,43,-.2,0,Math.PI*2);sc.fill();let seed=31;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};sc.globalCompositeOperation='destination-out';for(let i=0;i<1600;i++){sc.globalAlpha=.04+rand()*.13;sc.beginPath();sc.ellipse(rand()*96,rand()*96,.2+rand()*.65,.3+rand(),0,0,7);sc.fill()}sc.globalCompositeOperation='source-over';sc.globalAlpha=1}
function segment(a,b,s){const ax=a.x*vw,ay=a.y*vh,bx=b.x*vw,by=b.y*vh;const length=Math.hypot(bx-ax,by-ay),steps=Math.max(1,Math.ceil(length/Math.max(1,s.width*.13)));for(let i=0;i<=steps;i++){const t=i/steps;ctx.drawImage(stamp,ax+(bx-ax)*t-s.width/2,ay+(by-ay)*t-s.width/2,s.width,s.width)}}
function render(){ctx.clearRect(0,0,vw,vh);for(const s of strokes){makeStamp(s.color);for(let i=0;i<s.points.length;i++)segment(s.points[Math.max(0,i-1)],s.points[i],s)}}
function resize(){vw=innerWidth;vh=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=vw*dpr;canvas.height=vh*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);render()}addEventListener('resize',resize);resize();
function begin(x,y){end();current={color:colors[selected].ink,width:strokeWidth,points:[{x:x/vw,y:y/vh}]};strokes.push(current);makeStamp(current.color);segment(current.points[0],current.points[0],current);updateTools()}
function move(x,y){if(!current)return;const p={x:x/vw,y:y/vh},prev=current.points.at(-1);if(Math.hypot((p.x-prev.x)*vw,(p.y-prev.y)*vh)<1)return;current.points.push(p);segment(prev,p,current)}
function end(){current=null}
function updateTools(){$('#undo').disabled=$('#clear').disabled=strokes.length===0}
function notify(t){$('#toast').textContent=t;$('#toast').classList.add('visible');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').classList.remove('visible'),2600)}
async function choose(key,activate=true){end();selected=key;const c=colors[key];document.documentElement.style.setProperty('--bg',c.bg);document.documentElement.style.setProperty('--accent',c.ink);$('#colorName').textContent=c.name;$('#marker').src=`assets/${key}.png`;$('#marker').alt=`Marcador POSCA ${c.name}`;document.querySelector('meta[name="theme-color"]').content=c.bg;document.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===key)));if(activate&&!stream&&!starting)await startCamera()}
document.querySelectorAll('[data-color]').forEach(b=>{b.dataset.gesture='color-'+b.dataset.color;b.dataset.kind='dwell';b.dataset.hint=colors[b.dataset.color].name;b.addEventListener('click',()=>choose(b.dataset.color));});
$('#width').addEventListener('input',e=>setDraftWidth(Number(e.target.value)));
$('#size').onclick=openSize;$('#sizeConfirm').onclick=()=>closeSize(true);$('#sizeCancel').onclick=()=>closeSize(false);
$('#undo').onclick=()=>{end();strokes.pop();render();updateTools()};$('#clear').onclick=()=>openDialog($('#clearDialog'));
$('#clearConfirm').onclick=()=>{clearDrawing();$('#clearDialog').close()};$('#clearCancel').onclick=()=>$('#clearDialog').close();
$('#download').onclick=()=>{const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;const c=out.getContext('2d');c.fillStyle=colors[selected].bg;c.fillRect(0,0,out.width,out.height);c.drawImage(canvas,0,0);out.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`posca-${selected}-${Date.now()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);notify('Tu dibujo está listo para descargar.')},'image/png')};
let pointer=null;canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer=e.pointerId;canvas.setPointerCapture(pointer);begin(e.clientX,e.clientY)});canvas.addEventListener('pointermove',e=>{if(pointer===e.pointerId)move(e.clientX,e.clientY)});function release(){pointer=null;end()}canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();$('#undo').click()}if(e.key==='Escape'&&!document.querySelector('dialog[open]'))stopCamera()});
const status=t=>$('#status').textContent=t;
async function startCamera(){if(starting||stream)return;starting=true;$('#cameraLabel').textContent='Preparando…';$('#camera').disabled=true;let acquired=null;try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('unsupported');status('Permití el acceso a la cámara para empezar.');acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});video.srcObject=acquired;await video.play();status('Cargando el seguimiento de mano…');if(!detector){const {HandLandmarker,FilesetResolver}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs');const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');detector=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.6,minTrackingConfidence:.6});}stream=acquired;resetGestures();document.body.classList.add('hand-active');lastVideo=-1;$('#cameraPreview').classList.add('live');$('#camera').classList.add('active');$('#cameraLabel').textContent='Apagar cámara';status('Mostrá tu mano frente a la cámara.');raf=requestAnimationFrame(track)}catch(e){acquired?.getTracks().forEach(t=>t.stop());video.srcObject=null;$('#cameraLabel').textContent='Reintentar cámara';const messages={NotAllowedError:'Acceso denegado. Habilitá la cámara en tu navegador y reintentá.',NotFoundError:'No encontramos una cámara. Podés dibujar con mouse o dedo.',NotReadableError:'La cámara está ocupada. Cerrá la otra app y reintentá.'};status(messages[e.name]||(e.message==='unsupported'?'Abrí esta web en un navegador con cámara y conexión segura.':'No se pudo iniciar el seguimiento. Revisá tu conexión y reintentá.'));}finally{starting=false;$('#camera').disabled=false}}
function stopCamera(){cancelAnimationFrame(raf);stream?.getTracks().forEach(t=>t.stop());stream=null;document.body.classList.remove('hand-active');video.srcObject=null;end();prevHand=null;pinching=false;cursor.hidden=true;resetGestures();$('#cameraPreview').classList.remove('live');$('#camera').classList.remove('active');$('#cameraLabel').textContent='Activar cámara';$('#cameraTag').textContent='TU MANO, TU PINCEL';status('Cámara apagada. Podés seguir con mouse o dedo.')}
$('#camera').onclick=()=>stream?stopCamera():startCamera();addEventListener('pagehide',stopCamera);
function setDraftWidth(value){
 draftWidth=Math.max(12,Math.min(90,Math.round(value)));
 $('#width').value=draftWidth;$('#draftWidthValue').textContent=draftWidth+' px';
 $('#sizeSample').style.width=draftWidth+'px';$('#sizeSample').style.height=draftWidth+'px';
}
function updateWidth(){
 $('#widthValue').textContent=strokeWidth;
 $('#widthDot').style.width=$('#widthDot').style.height=(8+strokeWidth/5)+'px';
}
function openDialog(dialog){
 end();pointer=null;gestureDrawing=false;resetGestures();previousFocus=document.activeElement;
 dialog.showModal();dialog.append(cursor);
}
function openSize(){
 setDraftWidth(strokeWidth);sizeMode=true;sizeFreeze=null;openDialog($('#sizeDialog'));
 $('#sizeHint').textContent=stream?'Ajustá con los dedos. El tamaño se congela al apuntar a Listo.':'También podés mover el deslizador con mouse o dedo.';
}
function closeSize(commit){
 if(commit){strokeWidth=draftWidth;updateWidth();notify('Grosor: '+strokeWidth+' px')}
 $('#sizeDialog').close();
}
for(const dialog of document.querySelectorAll('dialog')){
 dialog.addEventListener('close',()=>{document.body.append(cursor);sizeMode=false;sizeFreeze=null;resetGestures();previousFocus?.focus()});
}
function clearDrawing(){end();strokes=[];render();updateTools();notify('Lienzo nuevo. ¡A crear!')}
function resetGestures(){
 gestures.reset();gestureDrawing=false;pinching=false;prevHand=null;
 focusedControl?.classList.remove('hand-focus');focusedControl=null;
 cursor.classList.remove('painting','selecting');cursor.style.setProperty('--progress',0);$('#cursorHint').textContent='';
}
function findHandTarget(x,y){
 const modal=document.querySelector('dialog[open]');
 // Use the real, enlarged button bounds; no hidden activation zones overlap.
 const controls=[...(modal||document).querySelectorAll('[data-gesture]')];
 const target=controls.find(el=>{if(el.disabled||!el.getClientRects().length)return false;const r=el.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom});
 const under=document.elementFromPoint(x,y);
 return {element:target,blocked:!!modal||!!under?.closest('header,footer')};
}
function activateControl(id){
 end();gestureDrawing=false;
 if(id==='clear'){clearDrawing();return}
 const el=document.querySelector('[data-gesture="'+id+'"]');
 if(el&&!el.disabled){el.click();if(id.startsWith('color-'))notify(colors[selected].name)}
}
function handleHand(hand,now){
 const clamp=v=>Math.max(0,Math.min(1,v));
 const raw={x:clamp((1-hand[8].x-.06)/.88)*(vw-16)+8,y:clamp((hand[8].y-.06)/.88)*(vh-16)+8};
 const p=prevHand?{x:prevHand.x+(raw.x-prevHand.x)*.48,y:prevHand.y+(raw.y-prevHand.y)*.48}:raw;
 prevHand=p;cursor.hidden=false;cursor.style.left=p.x+'px';cursor.style.top=p.y+'px';
 cursor.classList.toggle('hint-left',p.x>vw/2);cursor.classList.toggle('hint-below',p.y<75);
 const palm=Math.hypot(hand[0].x-hand[9].x,hand[0].y-hand[9].y);
 const ratio=Math.hypot(hand[4].x-hand[8].x,hand[4].y-hand[8].y)/Math.max(.01,palm);
 const {element,blocked}=findHandTarget(p.x,p.y);
 const target=element?{id:element.dataset.gesture,kind:element.dataset.kind,delay:1000}:null;
 const state=gestures.step({ratio,now,target,allowPaint:!blocked&&!sizeMode&&pointer===null});
 pinching=state.pinched;
 if(focusedControl!==element){focusedControl?.classList.remove('hand-focus');focusedControl=element;focusedControl?.classList.add('hand-focus')}
 cursor.classList.toggle('selecting',!!element);cursor.style.setProperty('--progress',state.progress);
 let hint='';
 if(element){
  hint=element.dataset.hint;
  if(target.kind==='hold'&&state.progress>0)hint='Borrar en '+Math.max(1,Math.ceil(2-state.progress*2))+'…';
  else if(state.progress>=1)hint='✓';
  $('#cameraTag').textContent='ELIGIENDO';
  status(target.kind==='hold'?'Juntá los dedos y mantenelos 2 segundos. Soltá para cancelar.':'Esperá a que se complete el aro o hacé un clic con los dedos.');
 }else if(sizeMode){
  const next=widthFromGap(ratio);sizeFreeze=sizeFreeze===null?next:sizeFreeze+(next-sizeFreeze)*.25;
  setDraftWidth(sizeFreeze);hint=draftWidth+' px';$('#cameraTag').textContent='AJUSTANDO GROSOR';
  status('Abrí o cerrá los dedos y después apuntá a Listo.');
 }else if(blocked){
  $('#cameraTag').textContent='CONTROLES';status('Apuntá a un botón. El dibujo está en pausa.');
 }else if(state.drawing&&pointer===null){
  if(!gestureDrawing)begin(p.x,p.y);else move(p.x,p.y);
  gestureDrawing=true;$('#cameraTag').textContent='● PINTANDO';hint='Pintando';status('Separá pulgar e índice para levantar el trazo.');
 }else{
  $('#cameraTag').textContent='MANO DETECTADA';hint=state.pinched?'Separá los dedos':'Listo para pintar';status('Juntá pulgar e índice para dibujar.');
 }
 if(!state.drawing&&gestureDrawing){if(pointer===null)end();gestureDrawing=false}
 cursor.classList.toggle('painting',state.drawing);$('#cursorHint').textContent=hint;
 if(state.activate)activateControl(state.activate);
}
function track(now){
 if(!stream)return;
 try{
  if(video.readyState>=2&&video.currentTime!==lastVideo){
   lastVideo=video.currentTime;const result=detector.detectForVideo(video,now);const hand=result.landmarks?.[0];
   if(hand)handleHand(hand,now);
   else{
    if(pointer===null)end();cursor.hidden=true;resetGestures();
    $('#cameraTag').textContent='BUSCANDO TU MANO';status('Mostrá tu mano completa, con buena luz.');
   }
  }
  if(stream)raf=requestAnimationFrame(track);
 }catch{stopCamera();status('Se interrumpió el seguimiento. Activá la cámara para reintentar.')}
}
updateWidth();updateTools();
