import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, StaveConnector } from '../vendor/vexflow/entry/vexflow.js';
import { midiToParts, midiSequenceToChromaticParts, needsDoubleStaff, createNote, createChord,
         keySignatureMap, keySignatureFrom, applyKeySignature } from './helpers.js';
import { getKeySignature } from '../../shared/scales.js';

export function drawInterval(container, note1, note2, mode='iS', keySig, options={ scaleId:'CROM', root:0 }){
  container.innerHTML = '';
  const useDouble = needsDoubleStaff(note1, note2);
  const ksName = options ? keySignatureFrom(options) : null;
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(180, useDouble ? 340 : 240);
  const context = renderer.getContext();

  const ksMap = keySig ? keySignatureMap(keySig) : null;
  const useChromatic = !keySig && options && options.scaleId === 'CROM';
  const chromParts = useChromatic ? midiSequenceToChromaticParts([note1, note2]) : null;

  if(useDouble){
    const treble = new Stave(10, 40, 160);
    treble.addClef('treble');
    if(ksName) treble.addKeySignature(ksName);
    const bass = new Stave(10, 160, 160);
    bass.addClef('bass');
    if(ksName) bass.addKeySignature(ksName);
    treble.setContext(context).draw();
    bass.setContext(context).draw();

    const brace = new StaveConnector(treble, bass);
    brace.setType(StaveConnector.type.BRACE);
    brace.setContext(context).draw();
    const line = new StaveConnector(treble, bass);
    line.setType(StaveConnector.type.SINGLE_LEFT);
    line.setContext(context).draw();

    const trebleVoice = new Voice({ numBeats:2, beatValue:4 });
    const bassVoice = new Voice({ numBeats:2, beatValue:4 });

    const asc = note2 >= note1;

    if(mode === 'iS'){
      const restTreble = new StaveNote({ keys:['b/4'], duration:'qr', clef:'treble' });
      const restBass = new StaveNote({ keys:['b/4'], duration:'qr', clef:'bass' });
      const n1Clef = note1 < 60 ? 'bass' : 'treble';
      const n2Clef = note2 < 60 ? 'bass' : 'treble';
      let n1, n2;
      if(useChromatic){
        const p1 = chromParts[0];
        const p2 = chromParts[1];
        n1 = new StaveNote({ keys:[p1.key], duration:'q', clef:n1Clef });
        if(p1.accidental) n1.addModifier(new Accidental(p1.accidental),0);
        n2 = new StaveNote({ keys:[p2.key], duration:'q', clef:n2Clef });
        if(p2.accidental) n2.addModifier(new Accidental(p2.accidental),0);
      }else{
        n1 = createNote(note1, 'q', asc, n1Clef, Accidental, StaveNote, ksMap);
        n2 = createNote(note2, 'q', asc, n2Clef, Accidental, StaveNote, ksMap);
      }
      trebleVoice.addTickable(n1Clef === 'treble' ? n1 : restTreble);
      bassVoice.addTickable(n1Clef === 'bass' ? n1 : restBass);
      trebleVoice.addTickable(n2Clef === 'treble' ? n2 : restTreble);
      bassVoice.addTickable(n2Clef === 'bass' ? n2 : restBass);
    }else{
      const restTreble = new StaveNote({ keys:['b/4'], duration:'hr', clef:'treble' });
      const restBass = new StaveNote({ keys:['b/4'], duration:'hr', clef:'bass' });
      const clef1 = note1 < 60 ? 'bass' : 'treble';
      const clef2 = note2 < 60 ? 'bass' : 'treble';
      if(clef1 === clef2){
        let chord;
        if(useChromatic){
          const p1 = chromParts[0];
          const p2 = chromParts[1];
          chord = new StaveNote({ keys:[p1.key, p2.key], duration:'h', clef:clef1 });
          if(p1.accidental) chord.addModifier(new Accidental(p1.accidental),0);
          if(p2.accidental) chord.addModifier(new Accidental(p2.accidental),1);
        }else{
          chord = createChord(note1, note2, 'h', asc, clef1, Accidental, StaveNote, ksMap);
        }
        if(clef1 === 'treble'){
          trebleVoice.addTickable(chord);
          bassVoice.addTickable(restBass);
        }else{
          bassVoice.addTickable(chord);
          trebleVoice.addTickable(restTreble);
        }
      }else{
        let n1, n2;
        if(useChromatic){
          const p1 = chromParts[0];
          const p2 = chromParts[1];
          n1 = new StaveNote({ keys:[p1.key], duration:'h', clef:clef1 });
          if(p1.accidental) n1.addModifier(new Accidental(p1.accidental),0);
          n2 = new StaveNote({ keys:[p2.key], duration:'h', clef:clef2 });
          if(p2.accidental) n2.addModifier(new Accidental(p2.accidental),0);
        }else{
          n1 = createNote(note1, 'h', asc, clef1, Accidental, StaveNote, ksMap);
          n2 = createNote(note2, 'h', asc, clef2, Accidental, StaveNote, ksMap);
        }
        if(clef1 === 'treble') trebleVoice.addTickable(n1); else bassVoice.addTickable(n1);
        if(clef2 === 'treble') trebleVoice.addTickable(n2); else bassVoice.addTickable(n2);
        if(clef1 === 'treble' && clef2 !== 'treble') trebleVoice.addTickable(restTreble);
        if(clef1 === 'bass' && clef2 !== 'bass') bassVoice.addTickable(restBass);
      }
    }

    const formatter = new Formatter();
    formatter.joinVoices([trebleVoice]);
    formatter.joinVoices([bassVoice]);
    formatter.format([trebleVoice, bassVoice], 120);
    trebleVoice.draw(context, treble);
    bassVoice.draw(context, bass);
    return;
  }

  const stave = new Stave(10, 80, 160);
  stave.addClef('treble');
  if(ksName) stave.addKeySignature(ksName);
  stave.setContext(context).draw();

  if(mode === 'iS'){
    const asc = note2 >= note1;
    let p1, p2;
    if(useChromatic){
      [p1,p2] = chromParts;
    }else{
      p1 = midiToParts(note1, asc);
      p2 = midiToParts(note2, asc);
    }
    const n1 = new StaveNote({ keys:[p1.key], duration:'q' });
    if(p1.accidental && (!ksMap || ksMap.get(p1.key[0]) !== p1.accidental)) n1.addModifier(new Accidental(p1.accidental), 0);
    const n2 = new StaveNote({ keys:[p2.key], duration:'q' });
    if(p2.accidental && (!ksMap || ksMap.get(p2.key[0]) !== p2.accidental)) n2.addModifier(new Accidental(p2.accidental), 0);
    const notes = [n1, n2];
    const voice = new Voice({ numBeats:2, beatValue:4 });
    voice.addTickables(notes);
    new Formatter().joinVoices([voice]).format([voice], 120);
    voice.draw(context, stave);
  }else{
    const asc = note2 >= note1;
    let p1,p2;
    if(useChromatic){
      [p1,p2] = chromParts;
    }else{
      p1 = midiToParts(note1, asc);
      p2 = midiToParts(note2, asc);
    }
    const chord = new StaveNote({ keys:[p1.key, p2.key], duration:'h' });
    if(p1.accidental && (!ksMap || ksMap.get(p1.key[0]) !== p1.accidental)) chord.addModifier(new Accidental(p1.accidental), 0);
    if(p2.accidental && (!ksMap || ksMap.get(p2.key[0]) !== p2.accidental)) chord.addModifier(new Accidental(p2.accidental), 1);
    const voice = new Voice({ numBeats:2, beatValue:4 });
    voice.addTickables([chord]);
    new Formatter().joinVoices([voice]).format([voice], 120);
    voice.draw(context, stave);
  }
}

export function drawKeySignature(container, scaleId, root){
  container.innerHTML='';
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(240, 360);
  const ctx = renderer.getContext();
  const accList = getKeySignature(String(scaleId), root);

  const treble = new Stave(20, 40, 200);
  treble.addClef('treble');
  applyKeySignature(treble, accList, 'treble', root);
  const bass = new Stave(20, 200, 200);
  bass.addClef('bass');
  applyKeySignature(bass, accList, 'bass', root);
  treble.setContext(ctx).draw();
  bass.setContext(ctx).draw();

  const brace = new StaveConnector(treble, bass);
  brace.setType(StaveConnector.type.BRACE);
  brace.setContext(ctx).draw();
  const line = new StaveConnector(treble, bass);
  line.setType(StaveConnector.type.SINGLE_LEFT);
  line.setContext(ctx).draw();
}

export * from './helpers.js';
export { drawPentagram, drawIntervalEllipse } from './pentagram.js';
