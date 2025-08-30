import { generateComponents, ensureDuplicateComponents, transposeNotes,
  eAToNotes, rotateLeft, rotateRight, shiftOct, moveCards as moveCardsLib,
  duplicateCards, omitCards, addCard } from '../../shared/cards.js';
import { pitchColor as noteColor } from '../vendor/chromatone-theory/index.js';

function pastelColor(color){
  const m = color.match(/hsla?\((\d+),(\d+)%?,(\d+)%?,?(\d+(?:\.\d+)?)?\)/);
  if(!m) return color;
  const h = Number(m[1]);
  const a = m[4] || 1;
  return `hsla(${h},60%,85%,${a})`;
}

function contrastColor(color){
  const m = color.match(/hsla?\((\d+),(\d+)%?,(\d+)%?,?(\d+(?:\.\d+)?)?\)/);
  if(!m) return '#000';
  const l = Number(m[3]);
  return l > 60 ? '#000' : '#fff';
}

export function init(container, {
  notes = [],
  scaleLen = 12,
  orientation = 'row',
  help = false,
  showIntervals = false,
  onChange = null,
  draggable = true,
  showShift = true,
  components = null
} = {}){
  const state = {
    notes: notes.slice(),
    octShifts: Array(notes.length).fill(0),
    components: components ? components.slice() : generateComponents(notes)
  };
  let selected = new Set();
  const undoStack = [];
  const redoStack = [];

  const area = document.createElement('div');
  area.className = 'cards-area';
  const row = document.createElement('div');
  row.className = 'components-row';
  const wrap = document.createElement('div');
  wrap.className = 'components-wrap';
  row.appendChild(wrap);
  area.appendChild(row);
  container.appendChild(area);
  if(orientation==='column') area.classList.add('vertical');

  // expose controls via API only; DOM buttons are created by the host app
  const rotLeftBtn = document.createElement('button');
  const rotRightBtn = document.createElement('button');
  const upBtn = document.createElement('button');
  const downBtn = document.createElement('button');
  const dupBtn = document.createElement('button');
  const undoBtn = document.createElement('button');
  const redoBtn = document.createElement('button');

  let infoToggle, infoCard;
  if(help){
    infoToggle = document.createElement('button');
    infoToggle.id = 'infoToggle';
    infoToggle.textContent = 'Mostra informació';
    infoCard = document.createElement('div');
    infoCard.id = 'infoCard';
    infoCard.className = 'card info';
    infoCard.setAttribute('hidden','');
    area.appendChild(infoToggle);
    area.appendChild(infoCard);
    infoToggle.onclick = () => {
      const hidden = infoCard.hasAttribute('hidden');
      if(hidden){
        infoCard.removeAttribute('hidden');
        infoToggle.textContent = 'Amaga informació';
      }else{
        infoCard.setAttribute('hidden','');
        infoToggle.textContent = 'Mostra informació';
      }
    };
  }

  function pushUndo(){
    undoStack.push({
      notes: state.notes.slice(),
      octShifts: state.octShifts.slice(),
      components: state.components.slice()
    });
    if(undoStack.length>5) undoStack.shift();
    redoStack.length = 0;
  }

  function undo(){
    if(!undoStack.length) return;
    redoStack.push({notes:state.notes.slice(),octShifts:state.octShifts.slice(),components:state.components.slice()});
    const snap=undoStack.pop();
    state.notes=snap.notes.slice();
    state.octShifts=snap.octShifts.slice();
    state.components=snap.components.slice();
    render();
  }

  function redo(){
    if(!redoStack.length) return;
    undoStack.push({notes:state.notes.slice(),octShifts:state.octShifts.slice(),components:state.components.slice()});
    if(undoStack.length>5) undoStack.shift();
    const snap=redoStack.pop();
    state.notes=snap.notes.slice();
    state.octShifts=snap.octShifts.slice();
    state.components=snap.components.slice();
    render();
  }

  function transpose(delta){
    pushUndo();
    state.notes = transposeNotes(state.notes, scaleLen, delta);
    render();
  }

  function getIntervals(){
    return state.notes.slice(1).map((n,i)=>((n-state.notes[i]+scaleLen)%scaleLen));
  }

  function moveCards(indices, target){
    pushUndo();
    const newIdx = moveCardsLib(state, indices, target);
    selected = new Set(newIdx);
    render();
  }

  function render(){
    wrap.innerHTML='';
    ensureDuplicateComponents(state.notes, state.components);
    const intervals = showIntervals ? getIntervals() : null;
    state.notes.forEach((n,i)=>{
      const card = document.createElement('div');
      card.className='component-card';
      if(selected.has(i)) card.classList.add('selected');
      if(draggable) card.draggable=true;
      let pressTimer;
      card.onmousedown=e=>{
        if(e.shiftKey){
          if(selected.has(i)) selected.delete(i); else selected.add(i);
          render();
        }else{
          pressTimer=setTimeout(()=>{ if(selected.has(i)) selected.delete(i); else selected.add(i); render(); },1000);
        }
      };
      card.onmouseup=card.onmouseleave=()=>clearTimeout(pressTimer);
      if(draggable){
        card.ondragstart=e=>{ clearTimeout(pressTimer); const grp=selected.has(i)?Array.from(selected).sort((a,b)=>a-b):[i]; e.dataTransfer.setData('text/plain',JSON.stringify(grp)); };
        card.ondragover=e=>e.preventDefault();
        card.ondrop=e=>{ e.preventDefault(); e.stopPropagation(); const grp=JSON.parse(e.dataTransfer.getData('text/plain')); const min=Math.min(...grp); const target=min<i?i+1:i; moveCards(grp,target); };
      }
      let up, down;
      if(showShift){
        up=document.createElement('button');
        up.className='up';
        up.textContent='\u25B2';
        up.onclick=()=>{pushUndo();shiftOct(state.octShifts,i,1);render();};
        down=document.createElement('button');
        down.className='down';
        down.textContent='\u25BC';
        down.onclick=()=>{pushUndo();shiftOct(state.octShifts,i,-1);render();};
      }
      const close=document.createElement('div'); close.className='close'; close.textContent='x'; close.onclick=()=>{pushUndo();omitCards(state,[i]);render();};
      const note=document.createElement('div');
      note.className='note';
      note.textContent=n;
      const baseCol = noteColor((Number(n)+3)%12);
      const bgCol = pastelColor(baseCol);
      const fgCol = contrastColor(bgCol);
      card.style.backgroundColor = bgCol;
      card.style.color = fgCol;
      note.style.color = fgCol;
      const label=document.createElement('div'); label.className='label'; label.textContent=state.components[i];
      if(showShift){
        card.appendChild(up);
        card.appendChild(down);
      }
      card.appendChild(close); card.appendChild(note); card.appendChild(label);
      wrap.appendChild(card);
      if(showIntervals && i<state.notes.length-1){
        const ia=document.createElement('input');
        ia.className='ia-field';
        ia.value=intervals[i];
        ia.onchange=()=>{
          pushUndo();
          const ints=getIntervals();
          const val=parseInt(ia.value,10);
          if(!isNaN(val)) ints[i]=((val%scaleLen)+scaleLen)%scaleLen;
          const base=state.notes[0];
          const rel=eAToNotes(ints,scaleLen);
          state.notes=transposeNotes(rel,scaleLen,base);
          ensureDuplicateComponents(state.notes, state.components);
          render();
        };
        wrap.appendChild(ia);
      }
    });
    if(draggable){
      wrap.ondragover=e=>e.preventDefault();
      wrap.ondrop=e=>{ e.preventDefault(); const grp=JSON.parse(e.dataTransfer.getData('text/plain')); moveCards(grp, state.notes.length); };
    }
    if(typeof onChange==='function') onChange({ ...state });
  }

  rotLeftBtn.onclick=()=>{pushUndo();rotateLeft(state.notes, state.octShifts, state.components);render();};
  rotRightBtn.onclick=()=>{pushUndo();rotateRight(state.notes, state.octShifts, state.components);render();};
  upBtn.onclick=()=>{transpose(1);};
  downBtn.onclick=()=>{transpose(-1);};
  dupBtn.onclick=()=>{if(!selected.size) return; pushUndo(); const idx=Array.from(selected).sort((a,b)=>a-b); const newIdx=duplicateCards(state, idx); selected=new Set(newIdx); render();};
  undoBtn.onclick=undo;
  redoBtn.onclick=redo;
  document.body.addEventListener('click',e=>{
    if(!e.target.closest('.component-card') && !(showIntervals && e.target.classList.contains('ia-field'))){
      if(selected.size){ selected.clear(); render(); }
    }
  });

  render();
  if(typeof onChange==='function') onChange({ ...state });

  return { getState:()=>({...state}), rotateLeft:()=>rotLeftBtn.onclick(), rotateRight:()=>rotRightBtn.onclick(), transpose, undo, redo };
}
