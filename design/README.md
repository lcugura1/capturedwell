# design/

Vizualni izvori projekta. Kod ovdje ne dolazi — samo assetovi i referenca.

```
design/
  brand/        originalni logo fajlovi od Damira (SVG + PNG + font)
  references/   inspiracija koju skupljamo (screenshotovi, linkovi u LINKS.md)
  wireframes/   PNG izvozi iz Claude Designa — zamrznuta vizualna referenca
```

## Što ide u koji folder

**`brand/`** — izvorni brand assetovi. Nikad se ne mijenjaju bez Damirova odobrenja.
Potrebno: `logo.svg` (vektor), `logo.png` (raster fallback), i ime fonta iz logotipa.
Logo koji ide na stranicu (optimiziran, inline SVG) živi odvojeno u `src/`, ne ovdje.

**`references/`** — inspiracija. Screenshotovi drugih stranica, moodboard, sve što
pomaže objasniti smjer. Linkove skupljaj u `references/LINKS.md` s jednom rečenicom
zašto je nešto tu — link bez konteksta je beskoristan za mjesec dana.

**`wireframes/`** — PNG izvozi iz Claude Design canvasa. **Ovo je arhiva, ne kanal
prijenosa.** Pravi prijenos dizajna u kod ide kroz čitanje samog canvasa (vidi dolje),
jer PNG gubi točne vrijednosti. PNG-ovi postoje da za pola godine možemo vidjeti kako
je ekran izgledao u trenutku kad je dizajniran.

Imenovanje: `NN-naziv-ekrana.png`, npr. `01-naslovnica.png`, `04-galerija-kategorija.png`.

## Veličina slika — pravilo

**Sve u `references/` i `wireframes/` stisni prije commita: max 1400 px širine, JPEG
kvaliteta ~65.**

Git čuva binarne fajlove zauvijek. Screenshot s refero.design-a je stigao kao 2732 px
širok, 13 MB. Nakon stiskanja: 735 KB, 18× manje, a tekst se i dalje čita savršeno —
uključujući sitne oznake ispod fotki. Deset takvih referenci je razlika između repoa
od 7 MB i repoa od 130 MB koji svatko mora skinuti pri svakom kloniranju.

```sh
sips --resampleWidth 1400 -s format jpeg -s formatOptions 65 slika.jpg --out slika.jpg
```

Iznimka: `brand/` — tamo su izvorni assetovi i oni ostaju netaknuti.

## Kako dizajn dolazi u kod

Dva smjera, oba lossless:

**Dizajn → kod.** Claude Design canvas se objavi kao Artifact. Claude ga čita direktno
i dobiva stvarni HTML/CSS artboarda — točan hex, točan px, točan font stack. Nema
pogađanja boje s PNG-a. Iz toga se popunjava `src/styles/theme.css`.
→ Zalijepi URL canvasa u razgovor kad ga napraviš.

**Kod → design system.** Kad komponente postoje, `/design-sync` ih gura u
design-system projekt na claude.ai/design. Tako dizajn i kod ostaju ista stvar,
a ne dvije verzije istine koje se razilaze.

**Pravilo:** ako se dizajn i kod razilaze, izvor istine je `src/styles/theme.css`.
Canvas i PNG-ovi su referenca, ne autoritet.
