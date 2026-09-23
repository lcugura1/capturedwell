# Plan: galerija iz Google Drivea

> Zamjenjuje admin dashboard iz Faze 4. Damir objavljuje fotke tako da ih ubaci u folder na Driveu; sve ostalo je automatsko.
> Kad se plan provede, sažetak ide u `CLAUDE.md` (sekcije 3, 4, 9), a ovaj fajl ostaje kao zapis postavljanja.

---

## 0. Dogovoreno

| Pitanje | Odluka |
|---|---|
| Admin dashboard | **Ne postoji.** Nema Cloudflare Accessa, JWT-a, browser pipelinea, drag & dropa. |
| Izvor fotki | Google Drive, folder `capturedwell/` s četiri podfoldera po kategoriji. |
| Redoslijed | **Broj na početku imena fajla, veći prvi** (`03 - …` ispred `02 - …` ispred `01 - …`), pa sve nenumerirano iza toga po `addedAt` silazno. Numeriranje je opcionalno — Damir numerira samo ono do čega mu je stalo. **Zašto:** Drive daje svim fotkama iz jednog batch uploada `createdTime` u istoj minuti, pa `addedAt` unutar batcha ne razlikuje ništa; razrješavalo se po `id`, stabilno ali proizvoljno. Preimenovanje ne mijenja sadržaj fajla, pa sync ne prerađuje ništa — samo prepiše manifest. |
| Naslovna fotka | Vlastiti folder `naslovna/`, najnovija pobjeđuje. Prije toga se računala kao najšira fotka u galeriji — heuristika, ne odluka. |
| Različita slika na mobitelu | Folder + `-mobitel` twin: `naslovna` / `naslovna-mobitel`, `o-meni` / `o-meni-mobitel`. Oba twina su neobavezna; prazan folder znači da telefon koristi istu fotku kao i sve ostalo. Izvedeno kroz `<picture>` s `media` uvjetom, pa se preuzme točno jedna slika. |
| Geste u lightboxu | Vodoravno listanje ostaje platformi (`touch-action: pan-x` na traci, native momentum i snap); sve ostalo — pinch, double tap, panning, povlačenje za zatvaranje — vozi **jedan** zoom u `hooks/usePhotoGestures.ts`. **Zašto ne nativno:** web nema primitiv za zoom *elementa*; preglednikov pinch zumira stranicu (skupa s × i strelicama) i skripta ga ne može ni pročitati ni postaviti, a Chrome na Androidu gasi native double-tap na svakoj stranici s `width=device-width`. Prva verzija je imala dva zooma — double tap na transformu, pinch na stranici — i šav se vidio čim se zumiranu fotku pokušalo dotjerati s dva prsta. |
| Lightbox biblioteka | **Ne uvodi se.** Razmotrene: `yet-another-react-lightbox` (11,7 KB gz, MIT, održavan), `react-photo-view` (7,5 KB gz, Apache-2.0), `photoswipe` (16,6 KB gz, MIT, zadnje izdanje 05/2024). Sve tri donose vlastiti DOM i vlastite kontrole, pa bi otišli genie, × i strelice u Alfa Slab Oneu — upravo ono po čemu se ovaj lightbox ne čini gotovim rješenjem. Preostala je razlika bila jedna gesta, ne cijeli sustav. |
| Broj fotki u mreži | 10 po kategoriji. Ostatak je iza kontrole `još N fotografija ›`, koja otvara lightbox na desetoj fotki. |
| Pinned fotke | Otpadaju. |
| Alt tekst | Polje „Opis" fotke u Driveu; ako je prazno → `{kategorija} — fotografija {n}`. |
| Serviranje | R2 preko `img.capturedwell.com`, nikad direktno s Drivea. |
| Manifest | `gallery.json` u R2; build ga povuče i prerenderira. Više se ne commita. |
| Okidač | Cloudflare Worker, Cron Trigger svakih 5 min → pokreće GitHub workflow samo kad ima promjena. |
| Repozitorij | Ostaje javan (neograničene Actions minute). |
| Računi | Jedan namjenski Gmail u Damirovom vlasništvu za Cloudflare i Google; `info@capturedwell.com` je samo javna adresa koja se prosljeđuje na njega (vidi A1). |

**Zašto Worker cron, a ne GitHub cron:** GitHub gasi zakazane workflowe u javnom repozitoriju nakon 60 dana bez commita. Portfolio koji radi upravo tako izgleda — Damir dodaje fotke, kod nitko ne dira — pa bi sync tiho umro nakon dva mjeseca.

---

## Arhitektura

```
Google Drive (namjenski capturedwell Gmail)
  capturedwell/
    vjencanja/  lifestyle/  proizvodi/  eventi/   ← Damir ubacuje JPEG/PNG
    naslovna/                                      ← naslovna fotka; najnovija pobjeđuje
    o-meni/                                        ← portret; najnovija fotka pobjeđuje
        │ dijeljeno sa service accountom (Viewer)
        ▼
Worker "capturedwell-sync" — Cron Trigger */5 * * * *
  1. izlista 6 foldera (Drive API, service account JWT)
  2. usporedi s sync.json iz R2 (driveId, md5Checksum, opis)
  3. nema razlike → kraj (jedan API poziv, 0 troška)
     ima razlike → POST workflow_dispatch na GitHub
        ▼
GitHub Action "sync" (concurrency: jedna instanca, bez otkazivanja)
  1. isti listing, izračuna diff
  2. skine SAMO nove/promijenjene originale
  3. sharp: 5 širina × AVIF/WebP/JPEG, LQIP, rotacija, sRGB, strip EXIF/GPS
  4. upload u R2: img/{id}/…  ·  obriše img/{id}/ maknutih fotki
  5. upiše gallery.json + sync.json u R2
  6. npm run build (povuče gallery.json) → wrangler deploy
        ▼
capturedwell.com (prerenderirani HTML) + img.capturedwell.com (R2, immutable cache)
```

### R2 ključevi

```
img/{id}/{width}.avif | .webp | .jpg    ← javno, Cache-Control: immutable, 1 god
gallery.json                            ← javno, kratak TTL
sync.json                               ← stanje synca (driveId → id, md5, opis); nije tajno
```

`originals/` otpada — Drive je original i backup.

### Id fotke

`id = sha256(driveFileId + md5Checksum)` skraćen na 12 hex znakova. Ako Damir zamijeni sadržaj fajla, md5 se promijeni → novi id → novi URL-ovi → `immutable` cache ostaje ispravan bez purgea.

### Promjene u tipu manifesta (`app/lib/gallery-types.ts`)

- `order: number` → `addedAt: string` (ISO, iz Driveovog `createdTime`); sortiranje silazno.
- `pinned` se briše, zajedno s granom u `photosInCategory`.
- Sve ostalo (`width`, `height`, `widths`, `alt`, `lqip`) ostaje — frontend se jedva mijenja.

---

## A. Priprema računa (ti i Damir, jednom)

Vrijednosti se zapisuju u `.env` (gitignoran; oblik je u `.env.example`), a kasnije prepisuju u GitHub secrets (A4) i Worker secrets (B4). Sam `.json` ključ nikad ne ide u repozitorij.

Redoslijed je bitan: A1 → A2 → A3 → A4. Svaki korak ovisi o prethodnom.
Nakon B slijedi C — preseljenje domene s Wfolija.

### A1. Gmail, Cloudflare račun, selidba domene, mailbox

**Stanje (provjereno 2026-09-22):** `capturedwell.com` je već registriran **kod Cloudflare Registrara** (od 2026-03-17, istječe 2027-03-17) i koristi Cloudflare nameservere. A zapis za `@` i `www` pokazuje na Wfolio (`159.100.6.196`). MX zapisa nema, dakle na domeni trenutno nema e-pošte. Postoji `google-site-verification` TXT zapis (Search Console) — **ne brisati ga**.

**Selidba je provedena (2026-09-23).** Domena je bila u Cloudflare računu treće osobe (kolega, `Conceptadigital@g…`) i preseljena je u namjenski capturedwell račun. Bilo je nužno **prije** nego išta izgradimo — R2, Workeri i domena moraju biti u istom računu (custom domain radi samo na zoni iz istog računa), pa bi sve napravljeno u koleginom računu kasnije trebalo graditi iznova.

**Login e-mail za sve račune: namjenski Gmail, ne adresa na domeni.**
Račun koji kontrolira DNS domene ne smije se oporavljati mailom *na toj domeni* — ako Email Routing ikad pukne (promjena DNS-a, istek domene), reset lozinke ne stiže i račun je zaključan iznutra. Zato:

- **`capturedwell.<nešto>@gmail.com`** (npr. `capturedwell.foto@gmail.com`) — login za Cloudflare **i** Google (Drive, Cloud projekt). Jedan račun, u Damirovom vlasništvu, 2FA, oporavak na Damirov telefon.
- **`info@capturedwell.com`** — samo javna kontakt adresa na stranici, prosljeđuje se na taj Gmail.

Usput nestaje i redoslijedna ovisnost: Gmail ne treba Email Routing da bi postojao.

**Koraci**

1. Otvori Gmail `capturedwell.<nešto>@gmail.com`. Oporavak: Damirov telefon + Damirov osobni mail. 2FA.
2. Novi Cloudflare račun na taj Gmail. Dodaj Damirovu karticu (Registrar obnova ~10 €/god; R2 je traži za aktivaciju iako ne naplaćuje do 10 GB).
3. **Prije selidbe zapiši postojeće DNS zapise** u kolegin računu (DNS → Records → Export). Selidba ih **ne prenosi**. Trenutno: `A @ 159.100.6.196`, `A www 159.100.6.196` (Wfolio), `TXT google-site-verification=…`.
4. Novi račun → **Add a domain** → `capturedwell.com` → Free plan → ponovno upiši zapise iz koraka 3. (Cloudflare dodijeli nameservere; zona se aktivira nakon selidbe registracije.)
5. Kolega, u svom računu → **Domain Registration → Manage Domains → `capturedwell.com` → Configuration → Move to another account → Start** → Account ID novog računa.
6. Novi račun dobije mail → **Manage Domains → View Actions → Accept**. **Rok: 5 dana.**
7. Nakon selidbe: registracija je 30 dana zaključana za transfer (nebitno za nas); **Domain Registration → Contacts** → promijeni registranta na Damira (WHOIS se prenosi kakav jest, tj. s kolegom); uključi **Auto-renew**.
8. Provjeri da `capturedwell.com` i dalje otvara Wfolio. Kolega obriše staru zonu iz svog računa ako je ostala.
9. Tebe Damir doda kao člana: **Manage Account → Members → Invite** → tvoj mail → **Super Administrator**.
10. **Email → Email Routing** → Enable → destination: Gmail iz koraka 1 → pravilo `info@capturedwell.com` → taj Gmail. Test porukom.

Izvori: [Move a Cloudflare Registrar domain between accounts](https://developers.cloudflare.com/registrar/account-options/inter-account-transfer/), [Move a domain between Cloudflare accounts](https://developers.cloudflare.com/fundamentals/manage-domains/move-domain/).

### A2. Google Cloud projekt

Koristi se Gmail iz A1/1 — isti račun daje Drive (15 GB) i Google Cloud konzolu. Google Workspace (plaćen) **ne treba**. Drive API ne traži billing račun ni karticu.

(Google račun *može* se otvoriti i na `info@capturedwell.com` kroz „Koristi postojeću adresu e-pošte", ali tada oporavak ovisi o domeni — vidi obrazloženje u A1.)

**Projekt**

1. <https://console.cloud.google.com> (prijavljen capturedwell Gmailom) → prihvati uvjete. **Ne aktiviraj free trial / billing** ako ponudi — ne treba.
2. Gore lijevo, izbornik projekta → **New project** → ime `capturedwell` → Create. Odaberi ga.
3. **APIs & Services → Library** → traži „Google Drive API" → **Enable**.
   Ovo se lako preskoči, a simptom je zavaravajući: Drive vraća `PERMISSION_DENIED`,
   što izgleda kao problem s dijeljenjem foldera. `npm run check:drive` to razlikuje.

**Service account** (robot koji čita Drive; nema lozinku, ima ključ)

4. **IAM & Admin → Service Accounts → Create service account**.
   - Name: `drive-sync`
   - Opis: „Čita foldere galerije, samo čitanje"
   - Korak „Grant this service account access to project" → **preskoči** (nijedna uloga ne treba; pristup daje dijeljenje foldera, ne IAM).
   - Done.
5. Klik na `drive-sync@capturedwell-xxxx.iam.gserviceaccount.com` → **zapiši tu adresu** (treba za A3).
6. Kartica **Keys → Add key → Create new key → JSON** → Create. Preuzme se `.json` fajl.
    - **Ovo je jedina tajna u cijelom Google dijelu.** Ne stavljaj ga u repozitorij, ne šalji mailom. Nakon A4 ga obriši s diska.
    - Ako izbaci grešku `iam.disableServiceAccountKeyCreation`: to se događa samo pod Workspace organizacijom. Na običnom računu ne bi trebalo; ako se dogodi, javi.

### A3. Drive folderi

Prijavljen capturedwell Gmailom na <https://drive.google.com>:

1. **New → Folder** → `capturedwell`.
2. Unutar njega šest foldera, **točno ovih imena** (sync ih traži po imenu):
   `vjencanja`, `lifestyle`, `proizvodi`, `eventi`, `naslovna`, `o-meni`
3. Desni klik na `capturedwell` → **Share** → zalijepi adresu service accounta iz A2/5 → uloga **Viewer** → makni kvačicu „Notify people" → Share.
4. Otvori `capturedwell` folder i kopiraj id iz URL-a: `drive.google.com/drive/folders/`**`1AbC…xyz`** → zapiši kao `DRIVE_ROOT_FOLDER_ID`.

**Kako Damir pristupa:** na mobitelu i računalu u Drive aplikaciji doda drugi račun (capturedwell Gmail) i ubacuje fotke izravno u njega.
Nemoj mu folder dijeliti na njegov osobni račun kao Editor — tada fotke koje on ubaci pripadaju **njegovom** računu, troše njegovih 15 GB i nestanu ako ih on obriše iz svog Drivea.

### A4. Cloudflare (R2, Worker) i GitHub

**R2 bucket**

1. Cloudflare → **R2 Object Storage** → prvi put traži aktivaciju (unos kartice je obavezan i za free tier; naplata tek iznad 10 GB).
2. **Create bucket** → ime `capturedwell-media` → lokacija Automatic → Standard storage class.
3. Bucket → **Settings → Public access → Custom Domains → Connect domain** → `img.capturedwell.com`. **Nemoj** uključiti `r2.dev` subdomenu — ima rate limit i nije za produkciju.
4. Zapiši **Account ID** (desno na početnoj stranici R2).

**R2 API token** (GitHub Action ga koristi za upload)

5. R2 → **Manage R2 API Tokens → Create API token**.
   - Name: `github-sync`
   - Permissions: **Object Read & Write**
   - Specify bucket: samo `capturedwell-media`
   - TTL: Forever
6. Zapiši **Access Key ID** i **Secret Access Key** — secret se prikazuje samo jednom.

**Cloudflare API token** (GitHub Action ga koristi za deploy stranice)

7. Profil (gore desno) → **API Tokens → Create Token** → predložak **Edit Cloudflare Workers** → Account Resources: tvoj račun; Zone Resources: `capturedwell.com` → Create.
8. Zapiši token.

**GitHub token** (Worker ga koristi da pokrene workflow)

9. GitHub → Settings → Developer settings → **Personal access tokens → Fine-grained tokens → Generate new token**.
   - Name: `capturedwell-sync-trigger`
   - Expiration: najdulje što ponudi (ako nudi „No expiration", uzmi to). **Stavi podsjetnik u kalendar tjedan dana prije isteka** — kad istekne, sync prestaje.
   - Repository access: **Only select repositories** → `capturedwell`
   - Permissions → Repository → **Actions: Read and write**. Ništa drugo.
10. Zapiši token.

**GitHub secrets** — repozitorij → Settings → Secrets and variables → Actions → **New repository secret**:

| Ime | Vrijednost |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | cijeli sadržaj `.json` fajla iz A2/6 |
| `DRIVE_ROOT_FOLDER_ID` | iz A3/4 |
| `R2_ACCOUNT_ID` | iz A4/4 |
| `R2_ACCESS_KEY_ID` | iz A4/6 |
| `R2_SECRET_ACCESS_KEY` | iz A4/6 |
| `CLOUDFLARE_API_TOKEN` | iz A4/8 |

**Worker secrets** — postavljaju se kad Worker postoji (korak B4), naredbom, ne u dashboardu:

```sh
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON   # isti JSON
npx wrangler secret put DRIVE_ROOT_FOLDER_ID
npx wrangler secret put GITHUB_TOKEN                  # iz A4/10
```

11. Obriši `.json` ključ s diska.
12. U Claude Code interaktivnoj sesiji: `/mcp` → autoriziraj Cloudflare, da Claude može provjeravati bucket i Worker.

---

## B. Implementacija (Claude, na grani `feat/drive-sync`)

### B1. Ažurirati `CLAUDE.md`

- ~~**Domena `capturedwell.hr` → `capturedwell.com`** svugdje.~~ ✅ 2026-09-23. Usput: `subject` je bio prepisan u `Hero.tsx` i `Contact.tsx` i oba su ostala na staroj domeni — sada se izvodi iz `SITE.url` kao `ENQUIRY_SUBJECT`. Kontakt adresa je `capturedwell1@gmail.com`, ne na domeni (obrazloženje u A1).

- Sekcija 3: makni `/admin/*`, `/api/admin/*`, Access i „mini admin gumb". Umjesto toga: Drive → Worker cron → Action → R2.
- Sekcija 4: upload iz browsera → sync s Drivea; R2 struktura bez `originals/`; novi oblik manifesta; `gallery.json` se više ne importa iz repozitorija nego ga build povuče.
- Sigurnosna pravila: ostaju „tajne samo kao secrets" i „R2 write samo iz Actiona"; dodaje se „workflow samo na `schedule`/`workflow_dispatch`, nikad `pull_request_target`" i „logovi ispisuju brojeve, ne imena fajlova".
- Sekcija 9: Faza 4 prepisana; `thinking-orbs` se deinstalira.
- Sekcija 8: `cloudflare-one` više ne treba za ovaj projekt.

### B2. Sync skripta — `scripts/sync-drive.mjs`

Ovisi o A2, A3, A4 (R2 token).

- `scripts/lib/google-auth.mjs`: service account JWT → access token, **WebCrypto** (`crypto.subtle`, RS256). Bez `googleapis` paketa (~80 MB). Isti modul koristi i Worker, pa radi i u Nodeu i u Workeru.
- `scripts/lib/drive.mjs`: listing foldera (`'{id}' in parents and trashed = false`, polja `id, name, mimeType, md5Checksum, createdTime, description, size`), download (`alt=media`).
- Diff: Drive listing vs `sync.json` iz R2 → `{ toBuild, toRemove }`. Uspoređuje se **par (id, prefiks)**, ne samo id: fotka premještena iz `vjencanja` u `naslovna` zadržava isti Drive id i checksum, pa i isti `id`, ali joj varijante moraju pod `page/` a postoje samo pod `img/`. Usporedba samo po id-u javljala je „nema posla" i ostavljala naslovnu na 404.
- Manifest se prepisuje i kad nema posla oko piksela, ako mu se sadržaj promijenio (`sameManifest` ignorira `version` i `updatedAt`). Bez toga preimenovanje i izmjena opisa ne bi stigli na stranicu.
- Obrada: izvuci `processPhoto()` iz `build-media.mjs` u zajednički modul; dodati `.toColourspace('srgb')` (Damir izvozi i u Adobe RGB/Display P3).
- Upload: `scripts/lib/r2.mjs` potpisuje S3 zahtjeve sam (SigV4 preko WebCrypta), umjesto `aws s3 cp` iz prve verzije plana. **Zašto promjena:** AWS CLI je predinstaliran na GitHub runnerima, ali ne na razvojnom stroju, pa bi lokalni test tražio `brew install awscli` i vodio na dvije različite putanje koda za istu stvar. WebCrypto je već tu zbog `google-auth.mjs`, radi u Nodeu i u Workeru, i nema nove ovisnosti ni u jednom od njih. Cijena je ~90 linija SigV4 koda koji sami držimo — potpis se testira protiv stvarnog bucketa, pa greška ne može proći nezapaženo. `Cache-Control: public, max-age=31536000, immutable` na varijantama.
- Redoslijed zapisivanja: prvo varijante, pa `gallery.json`, pa `sync.json`, pa brisanje starih varijanti. Ako proces pukne na pola, stranica nikad ne pokazuje fotku čije slike još ne postoje.
- Nepodržan fajl (HEIC, RAW, video, >100 MB) se preskoči i broji; workflow na kraju padne sa statusom „upozorenje" → GitHub pošalje mail tebi.
- `--dry-run` zastavica za lokalni test: ispiše diff, ništa ne piše.
- Testovi (Vitest): diff logika, sortiranje po `addedAt`, fallback alt, id iz driveId+md5.

`scripts/check-drive.mjs` (`npm run check:drive`) već postoji i potvrđuje Drive stranu:
prijavu, dijeljenje root foldera, imena svih pet podfoldera, broj fotki, fotke bez opisa
i nepodržane formate. Njegovi moduli (`lib/google-auth.mjs`, `lib/drive.mjs`,
`lib/gallery-source.mjs`, `lib/env.mjs`) su temelj sync skripte, ne jednokratni kod.

**Gotovo kad:** `node scripts/sync-drive.mjs` lokalno (s `.env`) prebaci testnu fotku iz Drivea u R2 i `gallery.json` je sadrži.

### B3. Build čita manifest iz R2

- `scripts/fetch-manifest.mjs`: preuzme `https://img.capturedwell.com/gallery.json` → `app/data/gallery.json`. `npm run build` ga zove umjesto `npm run media`.
- `app/data/gallery.json` i `page-images.json` idu u `.gitignore`; brišu se iz gita.
- `app/lib/images.ts`: bazni URL varijanti → `https://img.capturedwell.com`.
- Portret: `o-meni/` folder na Driveu → manifest dobiva `pages.about` umjesto zasebnog `page-images.json`.
- Lokalni dev bez mreže: ako fetch ne uspije i lokalni fajl postoji, koristi njega; ako ne postoji, `EMPTY_GALLERY` i jasno upozorenje u konzoli.
- `media-src/` i `public/media/` se brišu. `scripts/build-media.mjs` postaje zajednički modul za obradu (B2).
- **Seed:** postojećih 10 fotki iz `media-src/` ručno ubaciti u Drive foldere (`studio-*` → `proizvodi/`) prije brisanja.

**Gotovo kad:** svjež clone → `npm run build` → stranica prikazuje fotke iz R2, a u repozitoriju nema nijedne fotke galerije.

### B4. GitHub workflow + Worker okidač

**`.github/workflows/sync.yml`**

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: '17 3 * * *'   # rezerva jednom dnevno, ako Worker iz nekog razloga ne okine
concurrency:
  group: sync
  cancel-in-progress: false
permissions:
  contents: read
```

Koraci: checkout → setup Node → `npm ci` → `sync-drive.mjs` → ako se `gallery.json` promijenio: `npm run build` → `wrangler deploy`.

**`worker/sync-trigger/`** — zaseban Worker, samo `scheduled()` handler, bez `fetch()` rute (nema što napasti).

- `wrangler.jsonc`: `triggers.crons: ["*/5 * * * *"]`, R2 binding na `capturedwell-media` (samo čita `sync.json`).
- Logika: listing → usporedba sa `sync.json` → ako razlika, `POST /repos/lcugura1/capturedwell/actions/workflows/sync.yml/dispatches`.
- Ako je razlika tu, a workflow već radi, `concurrency` drži najviše jedan u redu čekanja — duplikati se sami skupe.
- Ako GitHub vrati 401 (istekao token), zapiši u Worker log; vidi se u dashboardu.

**Gotovo kad:** fotka ubačena na Drive pojavi se na `capturedwell.com` unutar ~10 minuta, bez ičijeg klika.

### B5. Čišćenje i provjera

- Deinstalirati `thinking-orbs`; obrisati prazan `worker/` admin plan.
- `photosInCategory`: bez `pinned`, sort po `addedAt` silazno. Ažurirati testove.
- `node scripts/shoot.mjs` na buildu s R2 slikama — layout, hero, bez prelijevanja.
- Lighthouse na produkciji: budžeti iz CLAUDE.md §4 i dalje vrijede (LCP, CLS, veličina hero slike).
- End-to-end test s Damirom: on ubaci fotku s mobitela, gledate zajedno kad se pojavi.
- `/security-review` na workflow i Worker.

---

## C. Preseljenje domene s Wfolija

Domena ostaje gdje jest (Cloudflare Registrar). Seli se samo **na što pokazuje**.

### Prije preseljenja — provjeriti s Damirom

Wfolio stranica ima i stvari koje nova stranica nema:

- **`/disk/`, `/share/`, `/downloads/`** (vide se u `robots.txt`) — Wfolio isporuka galerija klijentima. **Ako Damir tako šalje fotke mladencima, gašenje Wfolija razbija te linkove.** To mora biti riješeno (Drive dijeljenje, Pixieset, ili Wfolio ostaje do isteka zadnje isporuke) prije isključenja.
- **`/services`** (usluge/cijene) i **`/comments`** (recenzije) — nova stranica ih nema. Treba li ih prenijeti?
- Datum obnove Wfolio pretplate — preseljenje planirati prije njega, otkazati automatsku obnovu.

### Tijek bez prekida

1. Nova stranica se prvo deploya na `capturedwell.<račun>.workers.dev` (ili `novo.capturedwell.com`). Wfolio i dalje radi na glavnoj domeni.
2. Damir pregleda i odobri.
3. Worker → **Settings → Domains & Routes → Add → Custom domain** → `capturedwell.com`, pa isto za `www.capturedwell.com`. Cloudflare zamijeni stare A zapise i izda certifikat. Prekid: sekunde do par minuta.
4. `www` → 301 na `capturedwell.com` (ili obrnuto — jedan kanonski oblik).
5. **301 preusmjerenja starih Wfolio adresa**, da Google i stari linkovi ne završe na 404:

   | Stara adresa | Nova |
   |---|---|
   | `/portfolio`, `/weddings`, `/lifestyle`, `/events`, `/studio` | `/#galerija` |
   | `/contacts` | `/#kontakt` |
   | `/services`, `/comments` | `/` (ili nova sekcija, ovisno o odluci gore) |
   | `/disk/*`, `/share/*` | ovisno o odluci o isporuci klijentima |

   Implementacija: Cloudflare **Bulk Redirects** (besplatno, bez koda) ili `_redirects` u static assetima Workera.
6. Search Console (property već postoji, TXT ostaje): pošalji novi `sitemap.xml`, prati greške indeksiranja tjedan dana.
7. Nakon tjedan dana bez problema: otkazati Wfolio.

---

## Rizici i što s njima

| Rizik | Posljedica | Mjera |
|---|---|---|
| GitHub token istekne | sync stane; stranica radi, samo se ne ažurira | podsjetnik u kalendaru; dnevni GitHub cron kao rezerva |
| Damir ubaci HEIC/RAW | fotka se ne pojavi | preskoči se, mail tebi; uputa Damiru: izvoz u JPEG |
| Damir premjesti staru fotku u drugi folder | `createdTime` se ne mijenja → fotka ide na staro mjesto u redoslijedu, ne na vrh | prihvatljivo; ako smeta, `addedAt` = prvi put kad ju je sync vidio |
| Damir obriše fotku greškom | nestane sa stranice | Drive koš čuva 30 dana; vrati iz koša → sync je vrati |
| Javni logovi | imena klijenata u imenima fajlova | skripta ispisuje samo brojeve |
| R2 > 10 GB | ~0.015 $/GB/mj | ≈ 3000+ fotki; daleko |

## Trošak

| Stavka | Cijena |
|---|---|
| Cloudflare Workers, Pages, R2 (≤ 10 GB), Email Routing, Cron Triggers | 0 € |
| GitHub Actions (javni repo) | 0 € |
| Google račun + Drive 15 GB + Cloud projekt | 0 € |
| Domena `capturedwell.com` (Cloudflare Registrar, po nabavnoj cijeni) | ~10 €/god — plaća se već sada, uz Wfolio |
| **Ukupno** | **samo domena** — ušteda je cijelih 50 €/god Wfolija |

## Checklist

- [ ] A1 capturedwell Gmail, novi Cloudflare račun, **domena preseljena ✅ 2026-09-23**; potvrditi još: DNS zapisi vraćeni, WHOIS na Damira, auto-renew, Email Routing radi
- [x] A2 Cloud projekt, Drive API, service account, JSON ključ — ✅ 2026-09-23
- [x] A3 pet foldera, dijeljenje sa service accountom, folder id u `.env` — ✅ 2026-09-23, potvrđeno `npm run check:drive`
- [ ] A4 R2 bucket + `img.capturedwell.com` ✅ (potvrđeno: domena vraća R2 404), R2 token ✅; ostaje: R2 vrijednosti u `.env` za lokalni B2 test, Cloudflare API token (A4/7) i GitHub PAT (A4/8) — oba tek za B4, `/mcp` autorizacija
- [ ] B1 CLAUDE.md
- [x] B2 sync skripta + testovi — ✅ 2026-09-23. `npm run sync` (`--dry-run`, `--names`);
      moduli `lib/{google-auth,drive,r2,image-pipeline,sync-plan,gallery-source,env}.mjs`;
      23 testa u `lib/sync-plan.test.mjs`. Prvi prolaz: 6 fotki → 90 varijanti u R2, ~70 s.
      Drugi prolaz: „Nema promjena." Ostaje za B3: `order` → `addedAt` i brisanje `pinned`
      u `app/lib/gallery-types.ts`, jer ih stranica tek tada čita.
- [x] B3 build iz R2, fotke izvan repozitorija — ✅ 2026-09-23. `npm run manifest` prije `dev` i
      `build`; `app/data/gallery.json` gitignoran; `page-images.json`, `scripts/build-media.mjs`
      i `public/media/` obrisani; portret dolazi iz `pages.about`; `order`/`pinned` zamijenjeni
      s `addedAt`. Prerenderirani HTML ima 112 referenci na `img.capturedwell.com` i nijednu na
      `/media/`. `shoot.mjs`: hero stane na sve tri veličine, bez vodoravnog prelijevanja.
- [ ] B3 seed: `media-src/` još nije na Driveu. Samo `vjencanja` ima fotke (6, Damirove);
      `lifestyle`, `proizvodi`, `eventi` i `o-meni` su prazni, pa stranica ondje pokazuje
      prazno stanje i placeholder portreta. `media-src/` zato ostaje dok se ne prenese.
- [ ] B4 workflow + Worker okidač, Worker secrets
- [ ] B5 čišćenje, shoot, Lighthouse, test s Damirom, security review
- [ ] C odluka o isporuci klijentima, /services, /comments
- [ ] C custom domain na Worker, 301 preusmjerenja, Search Console
- [ ] C otkazati Wfolio
