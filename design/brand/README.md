# brand/

## Logo

| Fajl | Što je |
|---|---|
| `capturedwell.png` | original od Damira, 500 × 500, wordmark ~350 px širine |
| `capturedwell-logo.svg` | **ovo koristimo** — vektoriziran iz PNG-a |
| `capturedwell-mark.svg` | kvadratni znak za favicon: samo slovo `c` iz logotipa |

SVG je jedan `<path>` s `fill="currentColor"`, viewBox `0 0 1000 155.8`.
Boja se postavlja CSS-om (`color`), pa isti fajl radi i bijel na tamnoj pozadini
i crn na svijetloj. Nema `width`/`height` — veličinu određuje CSS.

### Kako je nastao

Ne iz fonta, nego **vektorizacijom samog PNG-a** (`mkbitmap` + `potrace`). To daje
stvarni Damirov logo, a ne slovo koje nalikuje na njega.

```sh
# 1. izreži bijeli rub, spremi kao PGM
# 2. zagladi i binariziraj (blur uklanja pixel jitter iz 350 px bitmapa)
mkbitmap -f 12 -s 4 -t 0.5 crop.pgm -o crop.pbm
# 3. vektoriziraj
potrace -s -a 1.2 -O 2.0 --flat -o logo.svg crop.pbm
```

Provjereno preklapanjem s originalom: **93.2 % IoU**, a sve odstupanje je 1 px
antialias rub — oblici su identični.

Blur (`-f 12`) je ključan. Bez njega potrace prati i šum antialiasa, pa ispadne
625 nodova i **lošija** vjernost. S blurom: 253 noda, manji fajl, veća točnost.

### Točka je postala podvlaka

Slova su Damirova, interpunkcija je naša. Vektorizirana točka je izvađena iz putanje, a na njeno mjesto nacrtana podvlaka — u debljini poteza izmjerenoj sa stabala slova `l` (24.8), spuštena u prostor ispod bazne linije koji rep slova `p` ionako zauzima. Zato se čita kao dio istog slovopisa, a ne kao nalijepljen znak.

### Favicon nije wordmark

`capturedwell-mark.svg` je samo slovo `c`. Wordmark ima omjer 6.7:1 — u kvadratnoj ikoni od 16 px bio bi tri piksela visok i čitao bi se kao mrlja. `c` je autentičan oblik iz Damirovog logotipa i preživi tu veličinu.

Varijanta „c + podvlaka" je isprobana i neupotrebljiva: njih dvoje stoje na suprotnim krajevima wordmarka, pa im zajednički okvir stisne slovo u ništa.

```sh
node scripts/rasterize.mjs public/favicon.svg public/icon 32 180
```

### Ako Damir ikad nađe originalni vektor

Zamijeni `capturedwell-logo.svg` njime. Vektorizacija je vjerna rekonstrukcija,
ali original je original.

## Font — logo NIJE Quicksand

Provjereno preklapanjem, ne na oko. Quicksand ima **zaobljene završetke poteza** —
to je potpis tog pisma i nijedna težina to ne mijenja. Logo ima **ravne, rezane**
završetke i osjetno je deblji.

Testirano 12 geometrijskih sansova iz Google Fontsa, mjereno preklapanjem s
originalom:

| Font | Preklapanje |
|---|---|
| **Jost 800** | **71.3 %** |
| Jost 700 | 70.0 % |
| Outfit 800 | 60.8 % |
| Nunito Sans 800 | 59.3 % |
| Quicksand SemiBold | ispod 45 % |

Jost je Futura revival, pa je logo vjerojatno postavljen u Futuri ili nekom
komercijalnom Futura-klonu (Gilroy, Sofia Pro, Brandon Grotesque i slično).

**Za logo to više nije važno** — imamo vektor. Važno je samo za odabir fonta
stranice; vidi `CLAUDE.md`.

## Quicksand

`fonts/Quicksand-VariableFont_wght.ttf` (OFL, slobodan za komercijalnu upotrebu
i self-hosting). Statičke težine u `fonts/static/`.

**Hrvatski:** provjereno, sadrži sve dijakritike uključujući `đ`/`Đ`
(U+0111 / U+0110). Kod subsetiranja **mora** se uključiti `latin-ext`.

**Faza 2:** subset na latin + latin-ext, konverzija u woff2, self-hosting iz
`public/fonts/`. Ne učitavamo s Google CDN-a.
