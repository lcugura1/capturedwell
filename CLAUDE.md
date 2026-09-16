# capturedwell — upute za rad na repozitoriju

> Ovaj dokument je izvor istine za sve odluke o stacku, arhitekturi, dizajnu i workflowu.
> Svaka Claude Code sesija ga čita prije rada. Ako odstupaš od njega — prvo ga ažuriraj, pa onda kodiraj.

---

## 1. Projekt

**Klijent:** Damir Sukop, fotograf
**Brand:** capturedwell (malim slovom, uvijek jedna riječ, bez razmaka)
**Domena:** `capturedwell.hr`
**Cilj:** profesionalna portfolio stranica — galerija radova, predstavljanje fotografa, kontakt.

**Branding pravila**
- Primarno ime u naslovima i logotipu je **capturedwell**. Damirovo ime stoji uz njega (npr. `capturedwell — Damir Sukop` u `<title>`, potpis u footeru, About sekcija).
- Nikad `CapturedWell`, `Captured Well` ni `captured-well`.

**Jezik:** hrvatski, isključivo. Bez i18n sloja.
- Sav UI copy, alt tekstovi, error poruke, meta tagovi → hrvatski s punim dijakritičkim znakovima (č, ć, đ, š, ž).
- `<html lang="hr">`.
- Imena varijabli, funkcija, fajlova, commit poruke i komentari u kodu → **engleski**. Hrvatski je samo ono što korisnik vidi.

**Kategorije galerije** — fiksne, četiri. Nema dodavanja kroz admin; nova kategorija znači promjenu koda.

| Naziv (UI) | `id` u kodu | URL slug |
|---|---|---|
| Vjenčanja | `weddings` | `/galerija/vjencanja` |
| Lifestyle | `lifestyle` | `/galerija/lifestyle` |
| Događaji | `events` | `/galerija/dogadaji` |
| Studio | `studio` | `/galerija/studio` |

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

```
/                        → naslovnica (prerenderirano)
/galerija                → pregled sve četiri kategorije (prerenderirano)
/galerija/vjencanja      → kategorija; fotke iz gallery.json preko CDN-a
/galerija/lifestyle
/galerija/dogadaji
/galerija/studio
/o-meni, /kontakt        → prerenderirano
/admin/*                 → Cloudflare Access štiti na edgeu; JS chunk se lazy-loada
/api/admin/*             → Worker; provjerava Access JWT; jedini put do R2 writea
```

**Kako radi „mini admin gumb"**
1. Diskretan gumb/ikonica (footer ili `Ctrl+Shift+A`) vodi na `/admin`.
2. Cloudflare Access presreće zahtjev **prije nego dođe do naše aplikacije** i traži prijavu. Neautorizirani ne prolaze — nikakva logika u frontendu nije sigurnosna granica.
3. Nakon prijave postoji `CF_Authorization` cookie. Frontend zove `GET /api/me`; Worker verificira Access JWT i vraća identitet → tek tada se prikazuju admin kontrole.

**Nepregovorljiva sigurnosna pravila**
- R2 credentials i Access secret žive **isključivo** kao Worker secrets (`wrangler secret put`). Nikad u `VITE_*` varijablama — sve što ima `VITE_` prefiks završi u bundleu koji vidi svatko.
- Worker verificira Access JWT (`Cf-Access-Jwt-Assertion`) na **svakoj** `/api/admin/*` ruti, protiv JWKS-a tima. Provjera samo cookiea nije dovoljna.
- Public R2 bucket služi samo za čitanje slika. Upload ide isključivo kroz Worker.
- Admin kod se učitava dinamičkim importom. Običan posjetitelj ga ne smije skinuti.

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
- **Paleta je monokromatska.** Logo nema boje. Stranica ne uvodi brand boju; crna, bijela i par neutralnih sivih. **Boju nose fotografije, ne UI.** Akcentna boja bi se tukla s Damirovim radovima.
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

**Pristupačnost (nije opcionalna)**
- Kontrast tekst/pozadina ≥ 4.5:1.
- Svaka fotka ima smislen hrvatski `alt`; dekorativne dobivaju `alt=""`.
- Galerija i lightbox moraju raditi tipkovnicom (Tab, Enter, Esc, strelice), s vidljivim focus stanjem i focus trapom u lightboxu.
- `prefers-reduced-motion` gasi parallax i veće tranzicije.

---

## 6. Struktura repozitorija

```
src/
  routes/          # React Router v7 rute
  components/      # dijeljene prezentacijske komponente
  features/
    gallery/       # javna galerija: grid, lightbox, data loading
    admin/         # cijeli admin — lazy-loaded, nikad importan iz javnog koda
  lib/
    categories.ts  # jedini izvor istine za id ↔ slug ↔ hrvatski naziv
    gallery-types.ts
    image/         # pipeline: resize, encode, LQIP, EXIF strip
    images.ts      # URL-ovi varijanti, srcset
  data/gallery.json # manifest, baked u build
  styles/theme.css # design tokeni
scripts/           # build-media.mjs — originali -> varijante + manifest
media-src/         # originali za seed (Damirovi idu ovdje)
worker/            # Cloudflare Worker: /api/admin/*, /api/me
content/           # statički hrvatski tekstovi (o-meni, kontakt) — uređuju se u kodu
design/            # brand assetovi, inspiracija, PNG arhiva canvasa — ne build input
```

**Konvencije**
- Komponente: `PascalCase.tsx`, jedna komponenta po fajlu.
- Hookovi: `useNešto.ts`. Utilityji: `camelCase.ts`.
- Tipovi manifesta definirani **jednom** u `src/lib/gallery-types.ts`; Worker i frontend dijele isti tip.
- Bez `any`. Bez `@ts-ignore` bez komentara koji objašnjava zašto.
- Bez barrel `index.ts` fajlova koji re-exportaju sve — razbijaju tree-shaking i lazy loading admina.

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
- **Faza 3 — javna galerija.** ✅ Manifest, justified grid, lightbox, responsive slike. Ostaje: deploy na Cloudflare, stvarne fotke, pravi alt tekstovi.
- **Faza 4 — admin.** Cloudflare Access, Worker API, drag & drop upload, image pipeline, reorder, brisanje.
- **Faza 5 — sadržaj i polish.** O meni, kontakt (`mailto:`), SEO (`hr` meta, Open Graph, JSON-LD `LocalBusiness`), sitemap.
- **Faza 6 — lansiranje.** `capturedwell.hr`, analitika bez kolačića (Cloudflare Web Analytics), backup strategija za `originals/`.

---

## 10. Kontakt

Bez forme. `mailto:` link, plus telefon i Instagram ako Damir želi.

- Nema Workera za slanje maila, nema spam zaštite, nema Resenda. Manje koda, manje stvari koje pucaju.
- Adresu ne pišemo kao plain tekst u HTML-u — sastavlja se u JS-u pri kliku, da je scraperi ne pokupe direktno. Nije savršeno, ali filtrira najgore.
- Fallback: adresa mora biti vidljiva i čitljiva i ako JS ne radi.

---

## 11. Preostalo za dogovoriti

Ovo blokira Fazu 1 (dizajn), riješiti kroz `/grill-me`:

- Redoslijed kategorija u navigaciji (predloženo: Vjenčanja → Lifestyle → Događaji → Studio).
- Ima li svaka kategorija svoju cover fotku, ili se izvlači prva `pinned`?
- Naslovnica: jedan hero ili miješani prikaz najboljih iz svih kategorija?
- Prikazuje li lightbox tehničke podatke (objektiv, blenda) ili samo fotku?
