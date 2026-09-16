# brand/

## Logo

`capturedwell.png` — 500 × 500 px, crno na bijelom, wordmark zauzima ~340 px širine.

**SVG ne postoji.** To je problem za web: PNG je mutan na retina ekranima i boja mu je
zaključana (ne možemo ga obojiti u bijelo preko tamne fotke). Na 340 px stvarne širine
logo je jedva dovoljan za header na 2× ekranu, a za veću upotrebu je premalen.

**Rješenje: rekonstruiramo ga iz fonta.** Logo je wordmark postavljen u Quicksandu, a
Quicksand imamo. Postavimo `capturedwell.` u Bold s odgovarajućim trackingom, pretvorimo
u krivulje i izvezemo SVG — oštro na svakoj veličini, bojivo CSS-om, par KB.
Prije upotrebe usporediti s PNG-om preklapanjem da se potvrdi da se poklapa.

## Font

Quicksand (Google Fonts, OFL licenca — slobodno za komercijalnu upotrebu i self-hosting).

- `fonts/Quicksand-VariableFont_wght.ttf` — **ovo koristimo.** Varijabilni font,
  težine 300–700 u jednom fajlu.
- `fonts/static/` — statičke težine, fallback ako varijabilni negdje zapne.
- `fonts/OFL.txt` — licenca. Ostaje uz font, ne briše se.

**Hrvatski:** provjereno, font sadrži sve dijakritike uključujući `đ`/`Đ`
(U+0111 / U+0110) — glif koji često nedostaje u geometrijskim sansovima.
Kod subsetiranja **mora** se uključiti `latin-ext`, inače `đ` nestane.

**Prije Faze 1:** postaviti `capturedwell.` u Quicksand Bold i vizualno usporediti s
logo PNG-om. Ako se ne poklapa, font iz logotipa je nešto drugo i treba ga naći.

**Faza 2:** subsetiranje na latin + latin-ext, konverzija u woff2, self-hosting iz
`public/fonts/`. Ne učitavamo s Google CDN-a — jedan round-trip manje i nema slanja
IP adresa posjetitelja trećoj strani.
