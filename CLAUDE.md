# capturedwell — upute za rad na repozitoriju

> Ovaj dokument je izvor istine za sve odluke o stacku, arhitekturi, dizajnu i workflowu.
> Svaka Claude Code sesija ga čita prije rada. Ako odstupaš od njega — prvo ga ažuriraj, pa onda kodiraj.

---

## 1. Projekt

**Klijent:** Damir Sukop, fotograf
**Brand:** capturedwell (malim slovom, uvijek jedna riječ, bez razmaka)
**Domena:** `capturedwell.com`
**Cilj:** profesionalna portfolio stranica — galerija radova, predstavljanje fotografa, kontakt.

**Branding pravila**
- Primarno ime u naslovima i logotipu je **capturedwell**. Damirovo ime stoji uz njega (npr. `capturedwell — Damir Sukop` u `<title>`, potpis u footeru, About sekcija).
- Nikad `CapturedWell`, `Captured Well` ni `captured-well`.

**Jezik:** hrvatski, isključivo. Bez i18n sloja.
- Sav UI copy, alt tekstovi, error poruke, meta tagovi → hrvatski s punim dijakritičkim znakovima (č, ć, đ, š, ž).
- `<html lang="hr">`.
- Imena varijabli, funkcija, fajlova, commit poruke i komentari u kodu → **engleski**. Hrvatski je samo ono što korisnik vidi.

**Kategorije galerije** — fiksne, četiri. `CATEGORIES` je jedini izvor: hero popis, meta opis i filteri svi ga izvode iz njega, pa preimenovanje ne može ostaviti zaostali tekst negdje drugdje. Nema dodavanja kroz admin; nova kategorija znači promjenu koda.

| Naziv (UI) | `id` u kodu | URL slug |
|---|---|---|
| vjenčanja | `weddings` | `vjencanja` |
| lifestyle | `lifestyle` | `lifestyle` |
| proizvodi | `products` | `proizvodi` |
| eventi | `events` | `eventi` |

URL slugovi su bez dijakritike (`vjencanja`, `dogadaji`) — dijakritika u URL-u znači percent-encoding i ružne linkove pri dijeljenju. Mapiranje id ↔ slug ↔ hrvatski naziv živi na jednom mjestu: `src/lib/categories.ts`.

---

## 2. Tech stack

| Sloj | Izbor | Zašto |
|---|---|---|
| Jezik | TypeScript **6**, `strict: true` | Ne 7. `typescript-eslint` tvrdo odbija TS 7 (`does not support TS 7.0`), a lint nam vrijedi više od brzine kompajlera. Vratiti na 7 kad ekosustav stigne. |
| Build / app | **Vite + React 19 + React Router v8 (framework mode)** | Vite DX koji želimo; RR daje rute i **prerender** (SSG) pa portfolio ima pravi statički HTML za Google. |
| Stiliziranje | **Tailwind v4** + design tokeni kao CSS custom properties u `@theme` | 1:1 preslikavanje design systema iz Claude Designa. |
| Hosting | **Cloudflare Workers/Pages** | Besplatno, neograničen static bandwidth, globalni CDN. |
| Storage fotki | **Cloudflare R2** | 10 GB besplatno, **egress 0 €** — ključno za foto-heavy stranicu. |
| Admin auth | **Cloudflare Access (Zero Trust)** | Besplatno do 50 korisnika. Damir se prijavi e-mail OTP-om ili Googleom. **Ne pišemo vlastiti auth kod.** |
| Metapodaci galerije | `gallery.json` manifest u R2 | Jedan admin korisnik → nema concurrency problema. Nema baze, nema dnevnih limita, CDN-cacheable. |
| Testovi | Vitest + Testing Library; Playwright za admin flow | — |
| Lint/format | ESLint (flat config) + Prettier | — |

**Ukupni mjesečni trošak: 0 €** (uz domenu ~10 €/god).

### Zašto ne Supabase
Free tier: 1 GB storage, **5 GB egress/mj**, i **projekt se auto-pauzira nakon 7 dana neaktivnosti**. Za portfolio sa sporadičnim prometom to znači da galerija može biti mrtva kad netko dođe. R2 nema ni jedan od ta dva problema.

### Kad bismo prerasli free tier
- >10 GB u R2 → $0.015/GB/mj (11. GB košta ~1.5 centa).
- D1 bazu uvodimo **samo** ako manifest pređe ~2000 fotki ili ako dođe drugi admin. Do tada je JSON jednostavniji i robusniji.

---

## 3. Arhitektura

**Stranica je jedna.** Izbornik ne navigira — scrolla na sidro unutar iste stranice.

```
/                → cijela stranica, prerenderirana u jedan HTML
  #vrh           → hero
  #galerija      → sve četiri kategorije, filter umjesto navigacije
  #o-meni        → portret + biografija
  #kontakt       → mailto, telefon, instagram
```

**Nema druge rute.** `/admin` je postojao za dashboard iza Cloudflare Accessa; taj
plan je zamijenjen sinkronizacijom s Google Drivea, koja ne treba vlastitu stranicu
jer Damir radi u folderu. Detalji u [docs/plan-drive-sync.md](docs/plan-drive-sync.md).

**Kategorije su stanje, ne rute.** Klik na `vjenčanja` mijenja `useState`, ne URL.

Sve četiri mreže se renderiraju, neaktivne nose `hidden`. Dva razloga, oba nose težinu:
- Dokument je sad jedan. Ako kategorija nije u HTML-u, njezine fotke i alt tekstovi **ne postoje za tražilice**.
- `hidden` je `display: none`, a lazy slike u skrivenom elementu se **ne preuzimaju**. Višak košta bajtove HTML-a, ne prijenos.

**Cijena koju smo platili:** izgubili smo `/galerija/vjencanja` kao zasebnu stranicu. Za „fotograf vjenčanja Zagreb" sad se natječe jedna stranica umjesto četiri ciljane. Ako organski promet postane bitan, rješenje nije vraćanje rutanja nego nekoliko prerenderiranih landing stranica koje vode na `#galerija`.

**Nepregovorljiva sigurnosna pravila**
- Tajne (R2 ključevi, service account JSON, GitHub token) žive **isključivo** kao GitHub secrets i Worker secrets (`wrangler secret put`), te lokalno u gitignoranom `.env`. Nikad u `VITE_*` varijablama — sve što ima `VITE_` prefiks završi u bundleu koji vidi svatko.
- Public R2 bucket služi samo za čitanje slika. Pisati u njega smije samo GitHub Action, svojim tokenom ograničenim na taj jedan bucket.
- Workflow se okida samo na `schedule` i `workflow_dispatch`, nikad na `pull_request_target`.
- Logovi ispisuju brojeve i Drive id-eve, nikad imena fajlova: repozitorij je javan, a imena fajlova su imena klijenata.

---

## 4. Slike — ovo je srce projekta

Damir traži **visoku kvalitetu koja se učitava trenutno**. To se ne postiže uploadanjem originala, nego pipelineom.

### Upload (drag & drop iz Findera / Explorera)
- Prihvaćamo `DataTransfer.files` i `webkitGetAsEntry()` (drop cijelog foldera).
- Sve procesiranje je **u browseru**, prije uploada — `createImageBitmap` + `OffscreenCanvas`. Nema plaćenog transform servisa.
- Za svaku fotku generiramo širine: **400, 800, 1200, 1600, 2400 px** (nikad iznad originalne širine).
- Formati po varijanti: **AVIF** (`@jsquash/avif`, wasm) + **WebP** (nativni `canvas.toBlob`) + JPEG fallback.
- **LQIP**: 24 px široka, jako komprimirana WebP kao base64 data URI — sprema se u manifest i renderira instantno kao blur placeholder.
- **EXIF**: orijentaciju primjenjujemo na piksele, zatim strippamo sve metapodatke. **GPS koordinate se nikad ne uploadaju** — privatnost lokacija snimanja.
- Original čuvamo u `originals/` (Damirov backup, nikad se ne servira posjetiteljima).

### Struktura u R2
```
originals/{id}.{ext}
img/{id}/{width}.avif
img/{id}/{width}.webp
img/{id}/{width}.jpg
gallery.json
```

### `gallery.json` — oblik

```ts
type CategoryId = 'weddings' | 'lifestyle' | 'events' | 'studio'

type Photo = {
  id: string            // stabilan; nikad se ne mijenja nakon uploada
  category: CategoryId
  order: number         // redoslijed unutar kategorije
  width: number
  height: number        // oboje iz originala, za aspect-ratio
  widths: number[]      // koje su varijante stvarno generirane
  alt: string           // hrvatski, obavezan
  lqip: string          // base64 data URI
  pinned?: boolean      // fotke koje ostaju trajno (vidi ispod)
}
```

**Trajne vs. rotirajuće fotke.** Damir je rekao da dio fotki ostaje na stranici stalno, a dio se mijenja. `pinned: true` znači da fotka ide na vrh svoje kategorije i da admin traži potvrdu prije brisanja. Sve ostalo se slobodno rotira.

### Odakle dolazi manifest

`app/data/gallery.json` se **importa**, ne dohvaća. Time svaka stranica u statičkom HTML-u već ima svoje fotke — dobro za tražilice i jedan round-trip manje prije nego se išta pojavi. Cijena je da novi upload traži rebuild.

Zato Faza 4: Worker upiše u R2, pa okine deploy hook. Za portfolio koji se mijenja povremeno to je ispravan smjer trgovine — posjetitelj dobije brzinu, Damir čeka minutu.

`scripts/build-media.mjs` je build-time blizanac browser pipelinea iz admina. **Oba moraju proizvoditi isti oblik** — iste širine, iste formate, isti LQIP — da se fotka dodana kroz admin ne razlikuje od one iz seeda.

### Serviranje
- Uvijek `<picture>` s AVIF → WebP → JPEG i točnim `srcset` + `sizes`.
- Uvijek eksplicitni `width`/`height` (ili `aspect-ratio`) → nula layout shifta.
- Above-the-fold hero: `fetchpriority="high"`, `loading="eager"`, preload link. Sve ostalo: `loading="lazy"` + `decoding="async"`.
- Derivati se cacheaju agresivno (`immutable`, godinu dana) — ime fajla sadrži id pa je invalidacija besplatna.
- `gallery.json` ima kratak TTL; nakon admin izmjene Worker radi cache purge.

### Performance budžeti (CI ih provjerava)
- LCP < 2.0 s na simuliranoj 4G vezi.
- Najveća slika iznad preloma ≤ 200 KB u AVIF-u.
- Početni JS bundle < 150 KB gzip. Admin chunk se **ne** broji jer se ne učitava posjetiteljima.
- CLS < 0.05. Lighthouse Performance ≥ 95 na produkciji.

---

## 5. Design system

### Logotip — što nam govori

Logo postoji: wordmark `capturedwell.` u geometrijskom sans-serifu, mala slova, bold, čisto crno na bijelom. Originali u [design/brand/](design/brand/).

Iz njega slijedi cijeli vizualni smjer — nemamo ga pravo ignorirati:

- **Mala slova svugdje** u brand kontekstu. Logotip se nikad ne piše verzalom, ni u naslovima, ni u navigaciji, ni u `<title>`.
- **Točka je potpis brenda.** Jedini karakter u logotipu koji nije slovo. Koristimo je kao motiv: oznaka aktivne stavke u navigaciji, separator u meta podacima, marker kraja sekcije. Suzdržano — motiv, ne dekoracija.
- **Naslovi sekcija su iznimka od svega ispod.** Alfa Slab One, vintage slab, jedna boja po slovu iz retro palete (cream / mustard / rust / teal). Tri naslova na stranici: `o meni`, ime kategorije, `javi se`. Font ima prava mala slova pa pravilo o malim slovima preživi. **Nikad za tekst koji se čita** — slab ove težine u tijelu teksta je iscrpljujući. Vidi [design/references/03-naslovi-uzivo.png](design/references/03-naslovi-uzivo.png).
- **Paleta je monokromatska** *(osim naslova sekcija, gore).* Logo nema boje. Stranica ne uvodi brand boju; crna, bijela i par neutralnih sivih. **Boju nose fotografije, ne UI.** Akcentna boja bi se tukla s Damirovim radovima.
- **Tipografija: Quicksand** (Google Fonts, OFL). Varijabilni font 300–700 u [design/brand/fonts/](design/brand/fonts/). Provjereno sadrži sve hrvatske dijakritike uključujući `đ`/`Đ` — **kod subsetiranja obavezno uključiti `latin-ext`**, inače `đ` nestane. Self-hosta se iz `public/fonts/` kao woff2; ne učitavamo s Google CDN-a.
- **Logo SVG ne postoji**, samo PNG 500 × 500. Rekonstruiramo ga iz Quicksanda (wordmark → krivulje → SVG) jer je PNG mutan na retini i boja mu je zaključana. Detalji u [design/brand/README.md](design/brand/README.md).
- **Bez razmaka u `capturedwell`.** Nikad `captured well`.

### Integracija s Claude Designom

Dva smjera, oba bez gubitka vrijednosti:

1. **Dizajn → kod.** Canvas se objavi kao Artifact; Claude ga čita direktno i dobiva stvarni HTML/CSS artboarda (točan hex, px, font stack). Iz toga se popunjava `theme.css`. Zalijepi URL canvasa u razgovor. **PNG izvozi se ne koriste za ovo** — s piksela se boja pogađa, ne čita.
2. **Kod → design system.** Kad komponente postoje, `/design-sync` ih gura u design-system projekt na claude.ai/design, da dizajn i kod ostanu ista stvar.

Inspiracija i što iz nje uzimamo: [design/references/LINKS.md](design/references/LINKS.md). Referenca se ne kopira — zapisuje se **što točno** preuzimamo i što odbacujemo.

PNG izvozi idu u [design/wireframes/](design/wireframes/) kao zamrznuta arhiva — korisna za „kako je ovo izgledalo u ožujku", beskorisna kao izvor vrijednosti.

**Ako se dizajn i kod raziđu, izvor istine je `src/styles/theme.css`.** Canvas je referenca, ne autoritet.

### Skala je fluidna, ne fiksna

Canvas je okvir od 1440 px, pa je svaka veličina u njemu broj koji radi **točno na toj širini**. Naslov od 136 px na telefonu od 390 px daje četiri znaka po retku.

Zato je svaka display veličina i veći razmak `clamp()` između telefonske i canvas vrijednosti:

```
clamp(MIN, MIN + (MAX − MIN) × (100vw − 390px) / 1050, MAX)
```

390 px je telefon, 1440 px je artboard, 1050 je razmak. Izvan tih granica clamp drži krajeve ravnima.

**Sitan UI tekst (nav, label, caption) se namjerno ne skalira** — 13 px koji se dalje smanjuje postaje nečitljiv, a ionako stane svugdje.

**Hero i wordmark dijele točno jedan ekran.** Stupac je `min-h-svh`, fotka je `flex-1`, naslov ispod uzima svoju prirodnu visinu — pa je `capturedwell_` uvijek cijeli vidljiv bez skrolanja, na svakoj veličini prozora i pri svakoj vrijednosti koju fluidna skala izračuna. Nema magičnog broja koji treba prepodešavati kad se veličina promijeni. `svh` a ne `vh`: na mobilnom Safariju `vh` broji i područje iza URL trake, pa bi naslov ostao ispod nje.

### Pravila tokena

- Tokeni (boje, tipografija, spacing, radiusi, easing) žive na jednom mjestu: `app/styles/theme.css` unutar Tailwind `@theme` bloka, kao CSS custom properties.
- `@theme` prvo **gasi Tailwindove defaulte** (`--color-*: initial` i dalje). Bez toga se u CSS izvozi ~40 boja plave i zelene koje monokromatski dizajn nikad neće koristiti, a `bg-blue-500` tiho radi i izlazi iz sustava.
- Tailwind skenira **samo `app/`** (`source(none)` + `@source`). Automatska detekcija čita cijeli repo, uključujući izvezeni canvas u `design/canvas/` — 3 MB tuđeg markupa iz kojeg je generirao ~1000 smeća-selektora i napuhao CSS s 24 KB na 89 KB.
- **Nijedna komponenta ne smije imati hardkodiranu boju ili px vrijednost izvan tokena.** Ako token ne postoji — dodaj ga u `theme.css`, ne u komponentu.
- Kad se design canvas promijeni, prvo se ažurira `theme.css`, pa tek onda komponente.
- Fotografija je glavni junak stranice: UI je suzdržan, tipografija i whitespace nose dizajn, boje su neutralne da ne konkuriraju fotkama.
- **Tema je tamna, i to je jedina tema.** Near-black pozadina, bijeli tekst — fotke iskaču s tamne podloge, kao u galeriji ili kinu. „Bez dark modea" znači **bez prekidača za temu**, ne svijetlu temu; nema `prefers-color-scheme` grana, nema duplih tokena. `color-scheme: dark` na `:root` da browser ispravno oboji scrollbarove i form kontrole.

  Iz toga slijede dvije obaveze:
  - **Logo mora biti bijel** → SVG rekonstrukcija iz Quicksanda nije opcionalna. Crni PNG na tamnoj pozadini ne radi.
  - **Pozadina nije čista crna** (`#000`). Čisto bijelo na čistoj crnoj je naporno za čitanje i fotke izgledaju kao da lebde u praznini. Koristi near-black (oko `#0a0a0a`–`#111`), a tekst near-white umjesto `#fff`. Duži tekstovi (O meni) idu na sniženi opacitet, ne na punu bjelinu.
  - Kontrast i dalje ≥ 4.5:1 — provjeriti, ne pretpostaviti.

**Otvaranje na telefonu**

```sh
npm run dev:phone                      # dev server, uživo, HMR
npm run build && npm run preview:phone # produkcijski build
```

Oba ispišu mrežnu adresu (`http://192.168.x.x:port`). Telefon mora biti na **istoj Wi-Fi mreži**.

Za ocjenu izgleda koristi `dev:phone`; za ocjenu **brzine** koristi `preview:phone` — dev bundle je neminificiran, nesplitan i bez kompresije, pa o vremenu učitavanja ne govori ništa.

Ovo je ujedno jedini način da se vide Safari fallbackovi uživo: staklo bez refrakcije i obični zaobljeni rubovi umjesto squirclea.

**Mjerenje razmaka pored reveal animacija**

Sekcije se otkrivaju pomakom, pa im `getBoundingClientRect()` vraća **animirani** položaj, ne layout. Dva uzastopna mjerenja šavova prijavila su nepostojeće razlike prije nego sam im povjerovao — jedno je uhvatilo sekcije koje još drže pomak, drugo jednu usred tranzicije natrag.

Gasi otkrivanja **prije** učitavanja stranice (`evaluateOnNewDocument`, uz `transition: none`), ne poslije. Poslije mjeriš animaciju.

**Layout se provjerava u pregledniku, ne u glavi**

`node scripts/shoot.mjs` (uz posluženi build) snimi stranicu na 1440×900, 1280×720 i 390×844, ispiše je li wordmark unutar prvog ekrana, i **prođe devet širina tražeći vodoravno prelijevanje**.

Stranica se ne smije pomicati bočno. `overflow-x: clip` na `html` je brava (`clip`, ne `hidden` — `hidden` bi napravio scroll kontejner i razbio sidrenu navigaciju), ali je brava zadnja linija: svako prelijevanje je i dalje bug.

Mjeri se po elementima, ne po `scrollWidth`. `fixed` zaglavlje ne širi dokument, pa je `scrollWidth` prijavljivao 390 dok je navigacija stvarno bježala 60 px preko ruba na 280 px.

Postoji jer su dva layout buga prošla upravo zato što su i markup i CSS izgledali ispravno odvojeno: hero je prelazio pregib, a `<picture>` je tiho ignorirao `height: 100%` — inline element nema definiranu visinu pa se postotak ne razriješi i `aspect-ratio` preuzme. Nijedno se ne vidi iz terminala.

**Staklo i squircle su progresivna poboljšanja**

Oboje je **samo Chromium** (~65 % korisnika), bez najave iz Safarija i Firefoxa. Zato se oboje piše dvoslojno:

- `.glass` prvo deklarira `backdrop-filter: blur() saturate()` sam za sebe, pa tek unutar `@supports` dodaje `url(#liquid-glass)`. Bez tog reda Safari odbacuje **cijelu** deklaraciju i ostaje bez ikakvog zamućenja.
- `.squircle` nosi oblik u `border-radius`, a `corner-shape: superellipse(2)` ga samo profinjuje gdje se razumije.

Pozadina stakla je **78 % neprozirna, namjerno.** Efekt je efekt, ali tekst na njemu i dalje mora proći 4.5:1 preko bilo koje fotografije — a ovdje je iza njega uvijek fotografija.

**Pristupačnost (nije opcionalna)**
- Kontrast tekst/pozadina ≥ 4.5:1.
- **Iznimka, svjesna:** obrub kontrola je `#3a3a3a` = **1.72:1**, ispod praga od 3:1 iz WCAG 1.4.11. Canvas je to namjerno spustio s `#606060` (3.11:1). Prolazi jer svaka kontrola nosi vlastiti tekst ili ikonu visokog kontrasta — obrub pojačava, ne identificira. Hover diže obrub na `ink`, focus crta prsten. **Paziti na neaktivne filter pillove**: tamo je obrub najveći dio onoga što gumb razlikuje od riječi.
- Svaka fotka ima smislen hrvatski `alt`; dekorativne dobivaju `alt=""`.
- Galerija i lightbox moraju raditi tipkovnicom (Tab, Enter, Esc, strelice), s vidljivim focus stanjem i focus trapom u lightboxu.
- `prefers-reduced-motion` gasi parallax i veće tranzicije.

---

## 6. Struktura repozitorija

```
src/
  routes/          # home.tsx — jedina ruta
  sections/        # Hero, Gallery, About, Contact — sekcije jedne stranice
  hooks/           # useScrollSpy — aktivna točka u izborniku
  components/      # dijeljene prezentacijske komponente
  features/
    gallery/       # javna galerija: grid, lightbox, data loading
  lib/
    categories.ts  # jedini izvor istine za id ↔ slug ↔ hrvatski naziv
    gallery-types.ts
    image/         # pipeline: resize, encode, LQIP, EXIF strip
    images.ts      # URL-ovi varijanti, srcset
  data/gallery.json # manifest, baked u build
  styles/theme.css # design tokeni
scripts/
  build-media.mjs  # originali -> varijante + manifest
  shoot.mjs        # snimi stranicu na tri veličine ekrana, izmjeri layout
  rasterize.mjs    # SVG -> PNG preko instaliranog Chromea
media-src/         # originali za seed — briše se kad odu na Drive
worker/            # Cloudflare Worker: cron okidač za sync (Faza B4)
content/           # statički hrvatski tekstovi (o-meni, kontakt) — uređuju se u kodu
design/            # brand assetovi, inspiracija, PNG arhiva canvasa — ne build input
```

**Konvencije**
- Komponente: `PascalCase.tsx`, jedna komponenta po fajlu.
- Hookovi: `useNešto.ts`. Utilityji: `camelCase.ts`.
- Tipovi manifesta definirani **jednom** u `src/lib/gallery-types.ts`; Worker i frontend dijele isti tip.
- Bez `any`. Bez `@ts-ignore` bez komentara koji objašnjava zašto.
- Bez barrel `index.ts` fajlova koji re-exportaju sve — razbijaju tree-shaking.

> **Napomena (2026-09-23):** sekcije 4, 8 i 9 još opisuju admin iz Faze 4 i seed iz
> `media-src/`. Prepisuju se u koraku B1 plana; do tada je izvor istine za sve što
> se tiče fotografija [docs/plan-drive-sync.md](docs/plan-drive-sync.md).

---

## 7. Workflow

- Radi na feature granama, `main` ostaje deployabilan.
- Prije commita: `npm run typecheck && npm run lint && npm test`.
- Commit poruke: engleski, imperativ, konvencionalni prefiksi (`feat:`, `fix:`, `chore:`).
- Veće promjene idu kroz `/code-review` prije mergea.
- Nakon svake dovršene faze — ažuriraj ovaj dokument.

**Prije pisanja koda uvijek**
1. Provjeri postoji li već komponenta/util koji rješava problem.
2. Provjeri je li odluka već zapisana ovdje.
3. Ako uvodiš novu dependencyju — obrazloži je u PR-u. Manje je bolje; ovo je portfolio, ne aplikacija.

---

## 8. Skillovi i alati

Instalirano iz `claude-plugins-official`. Koristi ih, ne improviziraj.

| Skill / plugin | Kada |
|---|---|
| `grill-me` (mattpocock) | **Prije svake veće odluke.** Ispituje me dok specifikacija ne postane jednoznačna — koristimo ga na početku svake faze. |
| `grilling`, `to-spec`, `to-tickets` | Pretvaranje razgovora u specifikaciju i zadatke. |
| `codebase-design`, `domain-modeling` | Modeliranje manifesta galerije i granica modula. |
| `tdd`, `diagnosing-bugs` | Image pipeline i Worker logika — tu testovi stvarno vrijede. |
| `frontend-design` | **Obavezno prije pisanja bilo kojeg UI-ja.** Sprječava generički „AI izgled". |
| `modern-web-guidance` | Aktualne web prakse — provjeri prije uvođenja novog API-ja ili patterna. |
| `cloudflare`, `workers-best-practices`, `web-perf`, `cloudflare-one` | Workers, Wrangler, performance, i Cloudflare Access setup. |
| `/design` (ugrađen) | Design canvas → tokeni. Faza 1. |
| `/code-review`, `/simplify` | Prije mergea. |
| `/security-review` | Obavezno prije lansiranja i nakon svake izmjene Worker auth koda. |

Nisu instalirani, ali razmisliti kasnije: `chrome-devtools-mcp` (stvarni performance traceovi i LCP mjerenja u Chromeu), `playwright` (E2E admin flow), `resend` (kontakt forma mailom).

## 9. Faze

- **Faza 0 — dogovor stacka.** ✅ (ovaj dokument)
- **Faza 1 — design system.** Claude Design canvas → tokeni u `theme.css`.
- **Faza 2 — skeleton.** ✅ Vite + RR + TS + Tailwind, rute, prerender.
- **Faza 3 — javna galerija.** ✅ Single page, manifest, justified grid s filterom, lightbox, responsive slike. Ostaje: deploy na Cloudflare, stvarne fotke, pravi alt tekstovi.
- **Faza 4 — admin.** Cloudflare Access, Worker API, drag & drop upload, image pipeline, reorder, brisanje.
  - `thinking-orbs` (instaliran, MIT, 7.7 KB gzip, bez ovisnosti) čeka ovdje. Na javnoj stranici nema posla: sve je prerenderirano, a u lightboxu se nikad ne pokaže jer mreža fotografija već preuzme **istu** varijantu koju lightbox traži — `img.complete` je `true` prije prvog kadra, čak i na 20 kB/s. U adminu ima pravi posao: resize 20 MB originala u browseru traje sekunde.
- **Faza 5 — sadržaj i polish.** O meni, kontakt (`mailto:`), SEO (`hr` meta, Open Graph, JSON-LD `LocalBusiness`), sitemap.
- **Faza 6 — lansiranje.** `capturedwell.com`, analitika bez kolačića (Cloudflare Web Analytics), backup strategija za `originals/`.

---

## 10. Kontakt

Bez forme. `mailto:` link, plus telefon i Instagram ako Damir želi.

- Nema Workera za slanje maila, nema spam zaštite, nema Resenda. Manje koda, manje stvari koje pucaju.
- Adresu ne pišemo kao plain tekst u HTML-u — sastavlja se u JS-u pri kliku, da je scraperi ne pokupe direktno. Nije savršeno, ali filtrira najgore.
- Fallback: adresa mora biti vidljiva i čitljiva i ako JS ne radi.

---

## 11. Preostalo za dogovoriti

- **Sample fotke pod „proizvodi" su zapravo studijski portreti.** Kategorija je preimenovana, a seed fotke su starije od toga; prefiks `studio-` u `build-media.mjs` i dalje se razrješava da ne puknu. Nestaje kad Damir da prave fotografije proizvoda.

Ovo blokira Fazu 1 (dizajn), riješiti kroz `/grill-me`:

- Redoslijed kategorija u navigaciji (predloženo: Vjenčanja → Lifestyle → Događaji → Studio).
- Ima li svaka kategorija svoju cover fotku, ili se izvlači prva `pinned`?
- Naslovnica: jedan hero ili miješani prikaz najboljih iz svih kategorija?
- Prikazuje li lightbox tehničke podatke (objektiv, blenda) ili samo fotku?
