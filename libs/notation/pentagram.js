import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, StaveConnector, GhostNote } from '../vendor/vexflow/entry/vexflow.js';
// Import helpers directly to avoid circular dependency with index.js
import { midiToParts, midiToPartsByKeySig, midiSequenceToChromaticParts, applyKeySignature, parseKeySignatureArray, letterToPc } from './helpers.js';
import { getKeySignature } from '../../shared/scales.js';

export function drawIntervalEllipse(svg, p1, p2, color){
  const yTop = Math.min(p1.y, p2.y);
  const yBot = Math.max(p1.y, p2.y);
  const xLeft = Math.min(p1.x, p2.x);
  const dx = Math.abs(p1.x - p2.x);
  const width = dx + Math.max(p1.w, p2.w);
  const ell = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
  const cx = xLeft + width / 2;
  const cy = (yTop + yBot) / 2;
  const rx = (width + 6) / 2;
  const ry = (yBot - yTop) / 2 + 3;
  ell.setAttribute('cx', cx);
  ell.setAttribute('cy', cy);
  ell.setAttribute('rx', rx);
  ell.setAttribute('ry', ry);
  ell.setAttribute('fill', color);
  ell.setAttribute('stroke', color);
  ell.setAttribute('pointer-events', 'none');
  ell.style.zIndex = -1;
  svg.prepend(ell);
  return ell;
}

export function needsAccidental(parts, ksMap){
  if(!parts.accidental) return false;
  const basePc = letterToPc[parts.key[0]];
  const expected = ksMap ? ksMap[basePc] : undefined;
  return parts.accidental !== expected;
}

export function drawPentagram(container, midis = [], options = {}) {
  container.innerHTML = '';
  const { chord = false, paired = false, duration = 'q', noteColors = [], highlightInterval = null, highlightIntervals = [], highlightChordIdx = null, highlightChordColor = null, useKeySig = true, singleClef = null, width = 550 } = options;
  const scaleId = options.scaleId ? String(options.scaleId) : '';
  const ksArray = getKeySignature(scaleId, options.root);
  const ksMap = parseKeySignatureArray(ksArray);
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  if(singleClef){
    renderer.resize(width, 240);
  }else{
    renderer.resize(625, 340);
  }
  const context = renderer.getContext();

  if(singleClef){
    const stave = new Stave(10, 80, width - 20);
    stave.addClef(singleClef);
    if(useKeySig){
      applyKeySignature(stave, ksArray, singleClef, options.root);
    }
    stave.setContext(context).draw();

    if(midis.length){
      const normScaleId = scaleId.toUpperCase();
      const noKsIds = ['CROM','OCT','HEX','TON'];
      const useKs = useKeySig && !noKsIds.includes(normScaleId);
      const ksSpellingIds = ['DIAT','ACUS','ARMMA','ARMME'];
      const keepSpelling = !useKs && ksSpellingIds.includes(normScaleId);

      if(chord && Array.isArray(midis[0])){
        const voice = new Voice({ numBeats: midis.length, beatValue: 4 });
        voice.setStrict(false);
        const noteObjs = [];
        midis.forEach((chordNotes, idx) => {
          let partsSeq;
          if(useKs || keepSpelling){
            partsSeq = chordNotes.map(m => midiToPartsByKeySig(m, ksMap));
          }else{
            const sorted = chordNotes.map((m,i)=>({m,i})).sort((a,b)=>a.m-b.m);
            const chromParts = midiSequenceToChromaticParts(sorted.map(s=>s.m), ksMap);
            partsSeq = new Array(chordNotes.length);
            sorted.forEach((obj, i)=>{ partsSeq[obj.i] = chromParts[i]; });
          }
          const keys = partsSeq.map(p => p.key);
          const note = new StaveNote({ keys, duration, clef: singleClef });
          partsSeq.forEach((p, i) => {
            const need = useKs ? needsAccidental(p, ksMap) : !!p.accidental;
            if(need){
              const acc = new Accidental(p.accidental);
              if(p.cautionary) acc.setAsCautionary();
              note.addModifier(acc, i);
            }
          });
          voice.addTickable(note);
          noteObjs.push({ note });
        });
        new Formatter().joinVoices([voice]).format([voice], width - 145);
        voice.draw(context, stave);
        noteObjs.forEach((o,i)=>{
          let el = o.note && o.note.attrs && o.note.attrs.el;
          if(!el && o.note && typeof o.note.getSVGElement === 'function'){ el = o.note.getSVGElement(); }
          if(el){ el.dataset.idx = i; el.dataset.clef = singleClef; }
        });
        const svg = container.querySelector('svg');
        if(svg && highlightChordIdx!==null){
          const obj = noteObjs[highlightChordIdx];
          if(obj && obj.note){
            const getPos = idx => ({ y: obj.note.getYs()[idx], x: obj.note.getAbsoluteX(), w: obj.note.getWidth() });
            highlightIntervals.forEach(([i1,i2,color])=>{
              const p1 = getPos(i1);
              const p2 = getPos(i2);
              if(!p1 || !p2) return;
              drawIntervalEllipse(svg,p1,p2,color);
            });
            if(highlightChordColor){
              let el = obj.note && obj.note.attrs && obj.note.attrs.el;
              if(!el && obj.note && typeof obj.note.getSVGElement === 'function'){ el = obj.note.getSVGElement(); }
              if(el){
                const bb = el.getBBox();
                const pad = 4;
                const paddedWidth = bb.width + pad * 2;
                const paddedHeight = bb.height + pad * 2;
                const rectHeight = paddedHeight / 2;
                const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
                rect.setAttribute('x', bb.x - pad);
                rect.setAttribute('y', bb.y - pad + paddedHeight / 4);
                rect.setAttribute('width', paddedWidth);
                rect.setAttribute('height', rectHeight);
                rect.setAttribute('fill', 'none');
                rect.setAttribute('stroke', highlightChordColor);
                rect.setAttribute('stroke-width', 2);
                rect.setAttribute('rx', 4);
                rect.setAttribute('pointer-events','none');
                svg.appendChild(rect);
              }
            }
          }
        }
        return;
      }

      const voice = new Voice({ numBeats: midis.length, beatValue: 4 });
      voice.setStrict(false);
      let noteObjs = [];
      if(chord){
        let partsSeq;
        if(useKs || keepSpelling){
          partsSeq = midis.map(m => midiToPartsByKeySig(m, ksMap));
        }else{
          const sorted = midis.map((m,i)=>({m,i})).sort((a,b)=>a.m-b.m);
          const chromParts = midiSequenceToChromaticParts(sorted.map(s=>s.m), ksMap);
          partsSeq = new Array(midis.length);
          sorted.forEach((obj, idx)=>{ partsSeq[obj.i] = chromParts[idx]; });
        }
        const keys = partsSeq.map(p => p.key);
        const note = new StaveNote({ keys, duration, clef: singleClef });
        partsSeq.forEach((p,i)=>{
          const need = useKs ? needsAccidental(p, ksMap) : !!p.accidental;
          if(need){
            const acc = new Accidental(p.accidental);
            if(p.cautionary) acc.setAsCautionary();
            note.addModifier(acc, i);
          }
          const color = noteColors[i];
          if(color) note.setKeyStyle(i, { fillStyle: color, strokeStyle: '#000' });
          noteObjs[i] = { note, keyIndex: i };
        });
        voice.addTickable(note);
      }else{
        let partsSeq = null;
        if(!useKs && !keepSpelling){
          partsSeq = midiSequenceToChromaticParts(midis, ksMap);
        }
        midis.forEach((m, idx) => {
          const parts = (useKs || keepSpelling) ? midiToPartsByKeySig(m, ksMap) : partsSeq[idx];
          const note = new StaveNote({ keys: [parts.key], duration, clef: singleClef });
          const need = useKs ? needsAccidental(parts, ksMap) : !!parts.accidental;
          if (need){
            const acc = new Accidental(parts.accidental);
            if(parts.cautionary) acc.setAsCautionary();
            note.addModifier(acc, 0);
          }
          const color = noteColors[idx];
          if (color) note.setStyle({ fillStyle: color, strokeStyle: '#000' });
          noteObjs[idx] = { note, keyIndex: 0 };
          voice.addTickable(note);
        });
      }

      new Formatter().joinVoices([voice]).format([voice], width - 145);
      voice.draw(context, stave);

      const svg = container.querySelector('svg');
      const getPos = idx => {
        const obj = noteObjs[idx];
        if(obj && obj.note){
          return { y: obj.note.getYs()[obj.keyIndex], x: obj.note.getAbsoluteX(), w: obj.note.getWidth() };
        }
        return null;
      };
      if(svg){
        const list = [];
        if(highlightInterval) list.push(highlightInterval);
        list.push(...highlightIntervals);
        list.forEach(([i1,i2,color]) => {
          const p1 = getPos(i1);
          const p2 = getPos(i2);
          if(!p1 || !p2) return;
          drawIntervalEllipse(svg, p1, p2, color);
        });
      }
    }
    return;
  }

  const treble = new Stave(20, 40, 550);
  treble.addClef('treble');
  // Sólo aplicamos la armadura si useKeySig es true.
  if(useKeySig){
    applyKeySignature(treble, ksArray, 'treble', options.root);
  }
  const bass = new Stave(20, 160, 550);
  bass.addClef('bass');
  if(useKeySig){
    applyKeySignature(bass, ksArray, 'bass', options.root);
  }
  treble.setContext(context).draw();
  bass.setContext(context).draw();

  const brace = new StaveConnector(treble,bass);
  brace.setType(StaveConnector.type.BRACE);
  brace.setContext(context).draw();
  const line = new StaveConnector(treble,bass);
  line.setType(StaveConnector.type.SINGLE_LEFT);
  line.setContext(context).draw();

  if (midis.length) {
    const trebleVoice = new Voice({ numBeats: midis.length, beatValue: 4 });
    const bassVoice = new Voice({ numBeats: midis.length, beatValue: 4 });
    trebleVoice.setStrict(false);
    bassVoice.setStrict(false);

  const normScaleId = scaleId.toUpperCase();
  const noKsIds = ['CROM','OCT','HEX','TON'];
  const useKs = useKeySig && !noKsIds.includes(normScaleId);
  const ksSpellingIds = ['DIAT','ACUS','ARMMA','ARMME'];
  const keepSpelling = !useKs && ksSpellingIds.includes(normScaleId);
  let byClef = { treble: [], bass: [] };
  if (chord) {
    let partsSeq;
    if(useKs || keepSpelling){
      partsSeq = midis.map(m => midiToPartsByKeySig(m, ksMap));
    }else{
      const sorted = midis.map((m,i)=>({m,i})).sort((a,b)=>a.m-b.m);
      const chromParts = midiSequenceToChromaticParts(sorted.map(s=>s.m), ksMap);
      partsSeq = new Array(midis.length);
      sorted.forEach((obj, idx)=>{ partsSeq[obj.i] = chromParts[idx]; });
    }
    midis.forEach((m, idx) => {
      const parts = partsSeq[idx];
      const clef = m < 60 ? 'bass' : 'treble';
      byClef[clef].push({ parts, idx });
    });
    ['treble', 'bass'].forEach(clef => {
      if (!byClef[clef].length) return;
      const keys = byClef[clef].map(obj => obj.parts.key);
      const note = new StaveNote({ keys, duration, clef });
      byClef[clef].forEach((obj, i) => {
        const p = obj.parts;
        const need = useKs ? needsAccidental(p, ksMap) : !!p.accidental;
        if (need){
          const acc = new Accidental(p.accidental);
          if(p.cautionary) acc.setAsCautionary();
          note.addModifier(acc, i);
        }
        const color = noteColors[obj.idx];
        if (color) note.setKeyStyle(i, { fillStyle: color, strokeStyle: '#000' });
        obj.note = note;
        obj.keyIndex = i;
      });
      if(clef === 'treble'){ trebleVoice.addTickable(note); }
      else { bassVoice.addTickable(note); }
    });
  } else if (paired) {
    let trebleSeq = null;
    let bassSeq = null;
    if(!useKs && !keepSpelling){
      trebleSeq = midiSequenceToChromaticParts(midis.map(p => p[0]), ksMap);
      bassSeq = midiSequenceToChromaticParts(midis.map(p => p[1]), ksMap);
    }
    midis.forEach(([t,b], idx) => {
      const tParts = (useKs || keepSpelling) ? midiToPartsByKeySig(t, ksMap) : trebleSeq[idx];
      const bParts = (useKs || keepSpelling) ? midiToPartsByKeySig(b, ksMap) : bassSeq[idx];
      const tNote = new StaveNote({ keys: [tParts.key], duration, clef: 'treble' });
      const bNote = new StaveNote({ keys: [bParts.key], duration, clef: 'bass' });
      const needT = useKs ? needsAccidental(tParts, ksMap) : !!tParts.accidental;
      if (needT){
        const acc = new Accidental(tParts.accidental);
        if(tParts.cautionary) acc.setAsCautionary();
        tNote.addModifier(acc, 0);
      }
      const needB = useKs ? needsAccidental(bParts, ksMap) : !!bParts.accidental;
      if (needB){
        const acc = new Accidental(bParts.accidental);
        if(bParts.cautionary) acc.setAsCautionary();
        bNote.addModifier(acc, 0);
      }
      const color = noteColors[idx];
      if (color) {
        tNote.setStyle({ fillStyle: color, strokeStyle: '#000' });
        bNote.setStyle({ fillStyle: color, strokeStyle: '#000' });
      }
      byClef.treble.push({ parts:tParts, idx, note:tNote, keyIndex:0 });
      byClef.bass.push({ parts:bParts, idx, note:bNote, keyIndex:0 });
      trebleVoice.addTickable(tNote);
      bassVoice.addTickable(bNote);
    });
  } else {
    let partsSeq = null;
    if(!useKs && !keepSpelling){
      partsSeq = midiSequenceToChromaticParts(midis, ksMap);
    }
    midis.forEach((m, idx) => {
      const parts = (useKs || keepSpelling) ? midiToPartsByKeySig(m, ksMap) : partsSeq[idx];
      const clef = m < 60 ? 'bass' : 'treble';
      const note = new StaveNote({ keys: [parts.key], duration, clef });
      const need = useKs ? needsAccidental(parts, ksMap) : !!parts.accidental;
      if (need){
        const acc = new Accidental(parts.accidental);
        if(parts.cautionary) acc.setAsCautionary();
        note.addModifier(acc, 0);
      }
      const color = noteColors[idx];
      if (color) note.setStyle({ fillStyle: color, strokeStyle: '#000' });
      byClef[clef].push({ parts, idx, note, keyIndex: 0 });
      const target = clef === 'treble' ? trebleVoice : bassVoice;
      const other = clef === 'treble' ? bassVoice : trebleVoice;
      target.addTickable(note);
      other.addTickable(new GhostNote(duration));
    });
  }

  const voices = [];
  if(trebleVoice.getTickables().length){
    voices.push(trebleVoice);
  }
  if(bassVoice.getTickables().length){
    voices.push(bassVoice);
  }
  if(voices.length){
    const formatter = new Formatter();
    voices.forEach(v => formatter.joinVoices([v]));
    formatter.format(voices, 425);
    if(trebleVoice.getTickables().length) trebleVoice.draw(context, treble);
    if(bassVoice.getTickables().length) bassVoice.draw(context, bass);

    byClef.treble.forEach(o => {
      let el = o.note && o.note.attrs && o.note.attrs.el;
      if(!el && o.note && typeof o.note.getSVGElement === 'function'){
        el = o.note.getSVGElement();
      }
      if(el){
        el.dataset.idx = o.idx;
        el.dataset.clef = 'treble';
        el.dataset.keyIndex = o.keyIndex;
        el.vfNote = o.note;
      }
    });
    byClef.bass.forEach(o => {
      let el = o.note && o.note.attrs && o.note.attrs.el;
      if(!el && o.note && typeof o.note.getSVGElement === 'function'){
        el = o.note.getSVGElement();
      }
      if(el){
        el.dataset.idx = o.idx;
        el.dataset.clef = 'bass';
        el.dataset.keyIndex = o.keyIndex;
        el.vfNote = o.note;
      }
    });

    const svg = container.querySelector('svg');
    const getPos = idx => {
      let obj = byClef.treble.find(o => o.idx === idx);
      if(obj && obj.note){
        return { y: obj.note.getYs()[obj.keyIndex], x: obj.note.getAbsoluteX(), w: obj.note.getWidth() };
      }
      obj = byClef.bass.find(o => o.idx === idx);
      if(obj && obj.note){
        return { y: obj.note.getYs()[obj.keyIndex], x: obj.note.getAbsoluteX(), w: obj.note.getWidth() };
      }
      return null;
    };

    if(svg){
      const list = [];
      if(highlightInterval) list.push(highlightInterval);
      list.push(...highlightIntervals);
      list.forEach(([i1,i2,color]) => {
        const p1 = getPos(i1);
        const p2 = getPos(i2);
        if(!p1 || !p2) return;
        drawIntervalEllipse(svg, p1, p2, color);
      });
    }
  }
  }
}

export default drawPentagram;

