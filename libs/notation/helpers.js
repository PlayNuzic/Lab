import { KeySignature } from '../vendor/vexflow/entry/vexflow.js';

// Single reference array for diatonic letter cycle
const NOTE_CYCLE = ['c','d','e','f','g','a','b'];

export const letterToPc = { c:0, d:2, e:4, f:5, g:7, a:9, b:11 };

export function midiToLetterPart(midi, letter){
  const pc = ((midi % 12) + 12) % 12;
  let base = letterToPc[letter];
  let diff = (pc - base + 12) % 12;
  if(diff > 6) diff -= 12;
  if(diff === 2){
    letter = NOTE_CYCLE[(NOTE_CYCLE.indexOf(letter)+1)%7];
    base = letterToPc[letter];
    diff = (pc - base + 12) % 12;
    if(diff > 6) diff -= 12;
  }else if(diff === -2){
    letter = NOTE_CYCLE[(NOTE_CYCLE.indexOf(letter)+6)%7];
    base = letterToPc[letter];
    diff = (pc - base + 12) % 12;
    if(diff > 6) diff -= 12;
  }
  let acc = '';
  if(diff === -1) acc = 'b';
  else if(diff === 1) acc = '#';
  const octave = Math.floor((midi - diff) / 12) - 1;
  return { key:`${letter}/${octave}`, accidental: acc, pc, letter };
}

export function parseKeySignatureArray(arr){
  const map = {};
  if(!Array.isArray(arr)) return map;
  for(const item of arr){
    const letter = item.replace(/[#b\u266E]/g, '').toLowerCase();
    let acc = '';
    if(item.includes('#')) acc = '#';
    else if(item.includes('b')) acc = 'b';
    else if(item.includes('\u266E') || item.includes('♮')) acc = 'n';
    const pc = letterToPc[letter];
    if(pc !== undefined) map[pc] = acc;
  }
  return map;
}

const SHARP_ORDER = ['F','C','G','D','A','E','B'];
const FLAT_ORDER  = ['B','E','A','D','G','C','F'];
const SHARP_LINES = [0,1.5,-0.5,1,2.5,0.5,2];
const FLAT_LINES  = [2,0.5,2.5,1,3,1.5,3.5];

export function midiToParts(midi, preferSharp = true) {
  const sharpLetters = ['c','c','d','d','e','f','f','g','g','a','a','b'];
  const flatLetters  = ['c','d','d','e','e','f','g','g','a','a','b','b'];
  const sharps = ['', '#', '', '#', '', '', '#', '', '#', '', '#', ''];
  const flats  = ['', 'b', '', 'b', '', '', 'b', '', 'b', '', 'b', ''];
  const pc = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  const letters = preferSharp ? sharpLetters : flatLetters;
  return {
    key: `${letters[pc]}/${octave}`,
    accidental: preferSharp ? sharps[pc] : flats[pc]
  };
}

export function midiToPartsByKeySig(midi, ksMap) {
  if(!ksMap) return midiToParts(midi, true);
  const pc = ((midi % 12) + 12) % 12;
  for(const [letter, basePc] of Object.entries(letterToPc)){
    const acc = ksMap[basePc] || '';
    const adj = acc === '#' ? 1 : acc === 'b' ? -1 : 0;
    if(((basePc + adj + 12) % 12) === pc){
      const octave = Math.floor((midi - basePc - adj) / 12) - 1;
      return { key: `${letter}/${octave}`, accidental: acc };
    }
  }
  return midiToParts(midi, true);
}

export function midiToChromaticPart(midi, prev, prefer, forced){
  const sharpLetters = ['c','c','d','d','e','f','f','g','g','a','a','b'];
  const flatLetters  = ['c','d','d','e','e','f','g','g','a','a','b','b'];
  const sharps = ['', '#', '', '#', '', '', '#', '', '#', '', '#', ''];
  const flats  = ['', 'b', '', 'b', '', '', 'b', '', 'b', '', 'b', ''];
  const pc = ((midi % 12) + 12) % 12;

  let cand = prefer === '#'
    ? { letter: sharpLetters[pc], accidental: sharps[pc] }
    : { letter: flatLetters[pc], accidental: flats[pc] };

  if(forced === '#') cand = { letter: sharpLetters[pc], accidental: sharps[pc] };
  else if(forced === 'b') cand = { letter: flatLetters[pc], accidental: flats[pc] };
  else if(forced === 'n') cand = midiToLetterPart(midi, cand.letter);

  if(prev){
    const delta = (pc - prev.pc + 12) % 12;
    const diff = delta <= 6 ? delta : 12 - delta;
    const stepDir = delta <= 6 ? 1 : -1;
    const prevIdx = NOTE_CYCLE.indexOf(prev.letter);
    if(!prefer && diff === 1){
      const target = stepDir === 1 ? prev.letter : NOTE_CYCLE[(prevIdx + 6) % 7];
      cand = midiToLetterPart(midi, target);
    }else if(diff === 1 || diff === 2){
      const candIdx = NOTE_CYCLE.indexOf(cand.letter);
      let ldiff = candIdx - prevIdx;
      if(ldiff > 3) ldiff -= 7;
      if(ldiff < -3) ldiff += 7;
      if(ldiff !== 0 && ldiff !== stepDir){
        const target = NOTE_CYCLE[(prevIdx + stepDir + 7) % 7];
        cand = midiToLetterPart(midi, target);
      }
    }
  }

  let acc = cand.accidental;
  if(prev && prev.letter === cand.letter && prev.accidental && acc === ''){
    acc = '\u266E';
  }
  if(forced === 'n') acc = '\u266E';

  const base = letterToPc[cand.letter];
  let diff = (pc - base + 12) % 12;
  if(diff > 6) diff -= 12;
  const octave = Math.floor((midi - diff) / 12) - 1;

  return { key: `${cand.letter}/${octave}`, accidental: acc, pc, letter: cand.letter };
}

export function midiSequenceToChromaticParts(midis, prefMap = null){
  function build(pref){
    const out = [];
    midis.forEach((m,i)=>{
      const forced = prefMap ? prefMap[((m % 12)+12)%12] : null;
      const prev = out[i-1];
      out.push(midiToChromaticPart(m, prev, pref, forced));
    });
    return out;
  }

  const diffs = [];
  for(let i=1;i<midis.length;i++){
    const d = midis[i] - midis[i-1];
    if(d !== 0) diffs.push(d);
  }
  const allUpChrom = midis.length > 2 && diffs.length === midis.length -1 && diffs.every(d => d === 1);
  const allDownChrom = midis.length > 2 && diffs.length === midis.length -1 && diffs.every(d => d === -1);
  let prefer = null;
  let directPref = false;
  if(allUpChrom){ prefer = '#'; directPref = true; }
  else if(allDownChrom){ prefer = 'b'; directPref = true; }

  const initial = build(prefer);
  if(!prefer){
    for(const p of initial){
      if(p.accidental && p.accidental !== '\u266E'){
        if(p.accidental.includes('b')) prefer = 'b';
        else if(p.accidental.includes('#')) prefer = '#';
        if(prefer) break;
      }
    }
  }

  let full = initial;
  if(prefer && !directPref){
    const prefSeq = build(prefer);
    const altSeq = build(prefer === '#' ? 'b' : '#');
    const leaps = seq => seq.slice(1).reduce((acc,curr,i)=>{
      const prev = seq[i];
      const ldiff = Math.abs(NOTE_CYCLE.indexOf(curr.letter) - NOTE_CYCLE.indexOf(prev.letter));
      const sdiff = Math.abs(curr.pc - prev.pc) % 12;
      if(ldiff > 1 && (sdiff === 1 || sdiff === 2)) return acc+1;
      return acc;
    },0);
    const prefLeaps = leaps(prefSeq);
    const altLeaps = leaps(altSeq);
    full = prefLeaps <= altLeaps ? prefSeq : altSeq;
    prefer = prefLeaps <= altLeaps ? prefer : (prefer === '#' ? 'b' : '#');
  }

  for(let i=0;i<full.length-1;i++){
    const curr = full[i];
    const next = full[i+1];
    const forcedNext = prefMap ? prefMap[((midis[i+1] % 12)+12)%12] : null;
    if(!directPref && curr.letter === next.letter && !forcedNext){
      const alt = midiToChromaticPart(midis[i+1], curr, prefer === 'b' ? '#' : 'b', null);
      if(alt.letter !== curr.letter){
        full[i+1] = alt;
      }else if(curr.accidental && next.accidental === ''){
        full[i+1] = { ...next, accidental: '\u266E' };
      }
    }
  }

  if(midis.length === 2 && Math.abs(midis[1] - midis[0]) === 12){
    const acc1 = full[0].accidental || '';
    const acc2 = full[1].accidental || '';
    const mixSharpFlat = (acc1.includes('#') && acc2.includes('b')) ||
                         (acc1.includes('b') && acc2.includes('#'));
    if(mixSharpFlat){
      const orient = acc1.includes('#') || acc2.includes('#') ? '#' : 'b';
      full = build(orient);
    }
  }

  return full.map(({key, accidental}) => ({key, accidental}));
}

export function spellMidiSequence(seq, keySig = [], bar = null){
  const ksMap = parseKeySignatureArray(keySig);
  const prefMap = {};
  for(const [pc, acc] of Object.entries(ksMap)){
    const adj = acc === '#' ? 1 : acc === 'b' ? -1 : 0;
    prefMap[(parseInt(pc,10) + adj + 12) % 12] = acc;
  }
  const midis = seq.filter(n => n !== bar);
  const raw = midiSequenceToChromaticParts(midis, prefMap);
  let idx = 0;
  const result = [];
  let active = {};
  let prevMeasure = {};
  const reset = () => { active = {}; };
  reset();
  for(const n of seq){
    if(n === bar){
      prevMeasure = active;
      reset();
      result.push(bar);
      continue;
    }
    const part = raw[idx++];
    const [letter, octave] = part.key.split('/');
    const pc = letterToPc[letter];
    const key = `${letter}/${octave}`;
    const actual = part.accidental === '\u266E' ? '' : part.accidental;
    const prev = active[key] !== undefined ? active[key] : (ksMap[pc] || '');
    let acc = '';
    let cautionary = false;
    if(actual !== prev){
      acc = actual === '' ? '\\u266E' : part.accidental;
      if(actual === '' && prevMeasure[key] && prevMeasure[key] !== ''){
        cautionary = true;
      }
    }else if(actual === '' && prevMeasure[key] && prevMeasure[key] !== ''){
      acc = '\\u266E';
      cautionary = true;
    }
    active[key] = actual;
    const obj = { key: part.key, accidental: acc };
    if(cautionary) obj.cautionary = true;
    result.push(obj);
  }
  return result;
}

export function needsDoubleStaff(n1, n2) {
  return n1 < 60 || n2 < 60 || n1 > 81 || n2 > 81;
}

export function createNote(midi, duration, asc, clef, Accidental, StaveNote, keyMap) {
  const parts = midiToParts(midi, asc);
  const note = new StaveNote({ keys: [parts.key], duration, clef });
  const letter = parts.key[0];
  const sig = keyMap && keyMap.get(letter);
  if (parts.accidental && parts.accidental !== sig) {
    note.addModifier(new Accidental(parts.accidental), 0);
  }
  return note;
}

export function createChord(m1, m2, duration, asc, clef, Accidental, StaveNote, keyMap) {
  let p1 = midiToParts(m1, asc);
  let p2 = midiToParts(m2, asc);
  if (p1.key[0] === p2.key[0]) {
    p2 = midiToParts(m2, !asc);
  }
  const chord = new StaveNote({ keys: [p1.key, p2.key], duration, clef });
  if (p1.accidental && (!keyMap || keyMap.get(p1.key[0]) !== p1.accidental)) chord.addModifier(new Accidental(p1.accidental), 0);
  if (p2.accidental && (!keyMap || keyMap.get(p2.key[0]) !== p2.accidental)) chord.addModifier(new Accidental(p2.accidental), 1);
  return chord;
}

export function keySignatureMap(accArr){
  const map = new Map();
  accArr.forEach(a=>{
    const m = a.match(/^([A-Ga-g])(.+)?$/);
    if(!m) return;
    const letter = m[1].toLowerCase();
    let acc = m[2] || '';
    acc = acc.replace('\u266E','n').replace('♮','n').replace('\uD834\uDD2A','##').replace('\uD834\uDD2B','bb');
    map.set(letter, acc);
  });
  return map;
}

export function keySignatureFrom(options){
  if(!options || options.scaleId !== 'DIAT') return null;
  const names = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  const root = typeof options.root === 'number' ? options.root : 0;
  const idx = ((root % 12) + 12) % 12;
  return names[idx];
}

import { getKeySignature } from '../../shared/scales.js';

const DOUBLE_SHARP = '\uD834\uDD2A';
const DOUBLE_FLAT = '\uD834\uDD2B';
const BECUADRO = '\u266E';
const EXTRA_ACC_SPACE = 1; // Additional horizontal spacing between accidentals

export function baseKeyHadSharp(note, root){
  const ks = getKeySignature('DIAT', root);
  return ks.some(a => a.startsWith(note) && a.includes('#'));
}

export function baseKeyHadFlat(note, root){
  const ks = getKeySignature('DIAT', root);
  return ks.some(a => a.startsWith(note) && a.includes('b'));
}

export function applyKeySignature(stave, accArr, clef='treble', root=null){
  const ks = new KeySignature('C');
  if (!accArr || accArr.length === 0) {
    ks.addToStave(stave);
    return ks;
  }

  const hasSharps = accArr.some(acc => acc.includes('#') || acc.includes(DOUBLE_SHARP));
  const hasFlats  = accArr.some(acc => acc.includes('b') || acc.includes(DOUBLE_FLAT));
  const offset = clef === 'bass' ? 1 : 0;

  let orientation;
  const first = accArr[0] || '';
  if(first.includes('\u266E') || first.includes('♮')){
    const note = first[0].toUpperCase();
    orientation = note === 'B' ? 'flat' : note === 'F' ? 'sharp' : undefined;
  }
  if(!orientation){
    if(hasSharps && !hasFlats) orientation = 'sharp';
    else if(hasFlats && !hasSharps) orientation = 'flat';
    else orientation = 'sharp';
  }

  const list = [];
  accArr.forEach(a => {
    const m = a.match(/^([A-Ga-g])(.+)?$/);
    if(!m) return;
    const note = m[1].toUpperCase();
    let sign = m[2] || '';
    sign = sign.replace(BECUADRO, 'n')
               .replace('♮', 'n')
               .replace(DOUBLE_SHARP, '##')
               .replace(DOUBLE_FLAT, 'bb');
    let line;
    if(sign.startsWith('b')){
      line = FLAT_LINES[FLAT_ORDER.indexOf(note)];
    }else if(sign.startsWith('#')){
      line = SHARP_LINES[SHARP_ORDER.indexOf(note)];
    }else{
      if(root !== null){
        if(baseKeyHadSharp(note, root)){
          line = SHARP_LINES[SHARP_ORDER.indexOf(note)];
        }else if(baseKeyHadFlat(note, root)){
          line = FLAT_LINES[FLAT_ORDER.indexOf(note)];
        }else{
          line = orientation === 'flat'
               ? FLAT_LINES[FLAT_ORDER.indexOf(note)]
               : SHARP_LINES[SHARP_ORDER.indexOf(note)];
        }
      }else{
        line = orientation === 'flat'
             ? FLAT_LINES[FLAT_ORDER.indexOf(note)]
             : SHARP_LINES[SHARP_ORDER.indexOf(note)];
      }
      sign = 'n';
    }
    list.push({ type: sign || 'n', line: line + offset });
  });

  ks.customList = list;
  ks.format = function(){
    this.width = 0;
    this.children = [];
    this.accList = this.customList;
    for(let i=0;i<this.accList.length;i++){
      this.convertToGlyph(this.accList[i], this.accList[i+1], stave);
      if(i>0){
        const glyph = this.children[this.children.length - 1];
        if(glyph && typeof glyph.getXShift === 'function' && typeof glyph.setXShift === 'function'){
          glyph.setXShift(glyph.getXShift() + EXTRA_ACC_SPACE);
        }
        this.width += EXTRA_ACC_SPACE;
      }
    }
    if(typeof this.calculateDimensions === 'function') {
      this.calculateDimensions();
    }
    this.formatted = true;
  };
  ks.addToStave(stave);
  ks.format();
  return ks;
}
