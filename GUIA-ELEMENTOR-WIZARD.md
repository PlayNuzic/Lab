# Guia: Muntar el Wizard Pas a Pas a Elementor

## Què tens?

Un fitxer `nuz-wizard-elementor.html` que conté **tot** (CSS + HTML + JS) en un sol bloc. Només cal enganxar-lo dins d'Elementor.

---

## Pas 1: Crear la pàgina

1. WordPress → **Pàgines → Afegeix nova**
2. Dona-li un títol (p.ex. "Curs Pas a Pas")
3. Clica **"Edita amb Elementor"**

## Pas 2: Inserir el widget HTML

1. Al panell d'Elementor (esquerra), busca el widget **"HTML"**
   - Si no el trobes com "HTML", busca **"Code Snippet"** o **"Custom HTML"**
   - És un widget que accepta codi HTML cru
2. Arrossega'l a la pàgina
3. Obre el fitxer `nuz-wizard-elementor.html` amb un editor de text
4. **Copia TOT** el contingut
5. **Enganxa-ho** dins del widget HTML a Elementor

## Pas 3: Personalitzar els passos

Dins del codi enganxat, cada pas té aquesta estructura:

```html
<div class="nuz-step" data-step="1">
  <h2>Pas 1: Títol</h2>
  <div class="nuz-text">
    <p>Text explicatiu.</p>
  </div>
  <div class="nuz-iframe-wrap nuz-iframe-fixed">
    <iframe src="URL_DE_LA_APP" loading="lazy" allow="autoplay"></iframe>
  </div>
</div>
```

**Per afegir un pas nou:** copia un bloc `nuz-step` i canvia:
- `data-step="N"` → número del pas
- El `<h2>` → títol
- El `<p>` dins `.nuz-text` → contingut
- La URL del `src` de l'iframe → la teva app

**Si un pas no necessita iframe:** simplement no posis el `div.nuz-iframe-wrap`.

## Pas 4: Guardar i publicar

1. Clica **"Publicar"** o **"Actualizar"**
2. Si funciona → ja ho tens!
3. Si dóna error → anota el missatge i m'ho dius

---

## Funcionalitats incloses

- **Barra de progrés** visual (porpra, animada)
- **Botons Anterior / Següent** amb estils
- **Navegació amb teclat** (fletxes ← →)
- **URL amb pas actiu** (?nuz-step=3) — es pot compartir un pas concret
- **Responsive** — funciona bé al mòbil
- **Scroll automàtic** al canviar de pas
- **Lazy loading** dels iframes
- **Animació** suau en les transicions

---

## Ajustos opcionals

### Canviar colors
Busca `#6c5ce7` i `#a29bfe` al CSS i canvia'ls pels teus colors.

### Canviar alçada dels iframes
Busca `height: 500px` dins `.nuz-iframe-fixed` i ajusta.

### Desactivar scroll automàtic
Canvia `SCROLL_ON_NAV = true` a `false` al JS.

### Iframe full-width (sense max-width)
Afegeix al CSS del wizard:
```css
.nuz-wizard { max-width: 100%; padding: 20px 0; }
```
