# SESSION_STATE - App28/App29 Development

## CRITICAL: DO NOT MODIFY THESE WORKING FEATURES

### Pulse-Seq Format (WORKING - DO NOT CHANGE)
- Format: `Pfr( [editable area] )` - UNA SOLA LÍNIA
- Markup builder: `app28MarkupBuilder` / `app29MarkupBuilder`
- Estructura: `labelSpan('Pfr(') + edit(contentEditable) + closeParen(')')`
- **IMPORTANT**: Mantenir estructura simple de 3 spans, no afegir més elements

### Funcionalitats Implementades (WORKING)
1. **Bidireccionalitat timeline ↔ pulse-seq** ✓
2. **Hot reload** - canvis a selecció s'apliquen en temps real durant playback ✓
   - `applySelectionToAudio()` crida `audio.setSelected()` amb la nova selecció
   - Es crida automàticament des de `syncTimelineFromSelection()` si `isPlaying`
3. **Sync endpoints 0 i Lg** - seleccionar un selecciona l'altre ✓
4. **Highlighting pulse-seq** - overlays (#pulseSeqHighlight) amb animació flash ✓
5. **Caret management** - moveCaretToNearestMidpoint, double-space gaps ✓
6. **Tooltips de validació** - showValidationWarning quan tokens invàlids ✓
7. **Backspace/Delete tokens sencers** - deleteTokenLeft/deleteTokenRight ✓

### CSS Overlays (WORKING - ja a styles.css)
```css
#pulseSeqHighlight, #pulseSeqHighlight2 - position: absolute, opacity: 0
@keyframes pulseSeqFlash - acaba amb opacity: 0 (s'apaga completament)
```

## ARQUITECTURA ACTUAL

```
App28/main.js:
├── app28MarkupBuilder() - genera: labelSpan + edit + closeParen
├── createPulseSeqElement() - crea wrapper i munta
├── initPulseSeqEditor() - munta controller amb highlightParent
├── getPulseSeqRectForIndex() - retorna rect per highlighting
├── handlePulseSeqKeydown() - gestiona teclat (Enter, arrows, Backspace, Delete)
├── deleteTokenLeft() - esborra token sencer a l'esquerra (adaptat d'App4)
├── deleteTokenRight() - esborra token sencer a la dreta (adaptat d'App4)
├── getMidpoints() - helper per trobar gaps entre tokens
├── setCaretPosition() - helper per posicionar caret
├── sanitizePulseSeq() - valida i sincronitza
├── syncPulseSeqFromSelection() - selecció → text
├── syncTimelineFromSelection() - selecció → timeline visual + hot reload
├── applySelectionToAudio() - actualitza àudio durant playback (hot reload)
└── getAudioSelection() - converteix selectedPulses a format d'àudio

App29/main.js:
├── Igual que App28 però amb:
├── currentNumerator editable (2-6)
├── isIntegerPulseSelectable() - només múltiples de n
└── isPulseRemainder() - per remainder pulses
```

## FITXERS MODIFICATS RECENTMENT
- `Apps/App28/main.js` - pulse-seq editor complet amb hot reload
- `Apps/App28/styles.css` - overlay animations
- `Apps/App29/main.js` - pulse-seq editor complet amb hot reload
- `Apps/App29/styles.css` - overlay animations

## RECORDATORIS
- **SEMPRE llegir el fitxer ABANS de modificar-lo**
- **MAI canviar el markup builder sense verificar que no trenca res**
- **Testejar després de cada canvi petit**
