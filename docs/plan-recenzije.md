# Plan: recenzije

> Prva stvar na stranici koja **prima** podatke od posjetitelja. Mijenja CLAUDE.md §10
> („bez forme, bez Workera za mail, bez spam zaštite") — kad se provede, §10 se prepisuje.
> Grana: `feat/reviews`.

---

## 0. Dogovoreno (2026-09-23)

| Pitanje | Odluka |
|---|---|
| Tko piše recenziju | Klijent sam, kroz formu na stranici. |
| Moderacija | **Mail Damiru s gumbima Objavi / Odbij.** Bez admin stranice i bez prijave. |
| Fotka | ~~Fotka sa snimanja uz svaku recenziju.~~ **Promijenjeno 2026-09-23:** Damir ne želi fotke uz recenzije. Sekcija ima **jednu** fotku ispod naslova, iz Drive foldera `recenzije/` (+ neobavezni `recenzije-mobitel/`), kao naslovna i portret. Recenzije su samo tekst. |
| Postojeće | Svih 8 recenzija s Wfolija (`/comments`) se prenosi: ime, link, tekst. |
| Ocjena | **Bez zvjezdica.** Na portfoliju je svaka ocjena 5/5 i ne govori ništa. |

**Zašto mail, a ne admin:** admin je upravo ono što je Drive sync zamijenio — stranica,
prijava, Cloudflare Access, kod koji treba održavati za jednog korisnika. Mail ima Damir
već otvoren na mobitelu.

---

## Arhitektura

```
posjetitelj ── forma (#recenzije): ime, tekst, neobavezni link
        │ POST /api/recenzije  (+ Turnstile token)
        ▼
Worker stranice (isti Worker koji servira assete; kod samo za /api/*)
  1. provjeri Turnstile, duljine, link (samo http/https)
  2. spremi u PRIVATNI bucket capturedwell-reviews:  pending/{id}.json
  3. mail Damiru (Email Routing, send_email): tekst, linkovi Objavi / Odbij
        │ Damir klikne
        ▼
GET /api/recenzije/odluka?t=…   → stranica s potvrdom (NE mijenja ništa)
POST isto                        → pending/ → approved/ (ili obriše), pa workflow_dispatch
        ▼
GitHub Action "sync" (postojeći)
  pročita approved/ iz privatnog bucketa → gallery.json dobiva `reviews` → build → deploy
```

### Zašto ovako

- **GET ne smije mijenjati stanje.** Gmail, Outlook i antivirusni skeneri sami otvaraju
  linkove iz maila. Da „Odbij" briše na GET, recenzije bi odbijali roboti. Link otvara
  potvrdu; odluka je tek gumb na njoj (POST).
- **Linkovi su potpisani** (HMAC-SHA256, tajna `REVIEW_SIGNING_KEY`), nose id, odluku i rok
  (14 dana). Nitko tko ne zna tajnu ne može sastaviti link, a stari mail ne vrijedi zauvijek.
- **Privatni bucket za neodobreno.** Javni bucket je cijeli javan preko `img.capturedwell.com`;
  tu ne smije stajati ništa što Damir nije odobrio. Pravilo iz CLAUDE.md §3 ostaje:
  u javni bucket piše samo GitHub Action.
- **Objavljena recenzija je u statičnom HTML-u**, kao i galerija — tražilice je vide,
  posjetitelj ne čeka fetch. Cijena je isti rebuild od minutu.
- **Bez uploada fotki.** Otpada najveći dio posla i rizika forme: nema obrade slika na
  Workeru, nema EXIF/GPS pitanja, nema ograničenja veličine uploada.

### Oblik u manifestu

```ts
type Review = {
  id: string
  name: string
  link?: { href: string; label: string }   // Instagram, LinkedIn, web
  text: string                              // odlomci razdvojeni praznim retkom
  addedAt: string
}
Gallery.reviews?: Review[]                  // neobavezno: stari manifesti ga nemaju
```

### Zaštita forme

- **Turnstile** (besplatan, bez kolačića, obično nevidljiv) — provjera na Workeru, ne u browseru.
- Honeypot polje, ograničenja duljine (ime ≤ 80, tekst ≤ 2000, link ≤ 300).
- Ništa ne ide na stranicu bez Damirova klika, pa spam koji prođe košta samo mail.

---

## Faze

- [x] **R1 — prikaz.** ✅ 2026-09-23. Tip `Review`, sekcija „rekli su" (`#recenzije`), stavka
      u izborniku. Naslov i strelice u jednom redu, jedna fotka (visina izvedena iz ekrana, da
      sekcija stane u jedan ekran), pa traka s tekstom. Duge recenzije skraćene na 4 retka
      (3 na niskim ekranima) uz „pročitaj cijelu". Izmjereno: cijela sekcija stane na
      1920×1080, 1440×900, 1280×800 i 1024×768; na 1280×720 imena padnu tik ispod pregiba.
      Recenzije se na stranici vide tek s R2; dotad samo uz lokalni fixture.
- [x] **R2 — objava kroz sync.** ✅ kod 2026-09-23 (`approvedReviews()` u sync-drive.mjs). Privatni bucket, `approved/` → `reviews` u manifestu.
      8 Wfolio recenzija ne ide kroz bucket: žive u `app/data/reviews-wfolio.json` (sadržaj,
      kao tekst O meni) i spajaju se s onima iz manifesta u `reviewsNewestFirst`.
- [x] **R3 — forma i API.** ✅ kod 2026-09-23 (`worker/site/`, `ReviewForm.tsx`). Polja:
      ime i prezime, recenzija. Link na profil izbačen 2026-09-24 (Damir); Worker ga ignorira. Forma, Turnstile, `POST /api/recenzije`,
      `pending/`. Stranica postaje Worker sa skriptom (`run_worker_first: ["/api/*"]`).
- [x] **R4 — moderacija.** ✅ kod 2026-09-23; `pending/` se sam briše nakon 30 dana
      (R2 lifecycle `pending-expiry`). Čeka: stvarni test maila, `/security-review`. Mail s potpisanim linkovima, stranica potvrde, POST odluke,
      dispatch workflowa. `/security-review` obavezno.
- [ ] CLAUDE.md §10 i §3 prepisani.

### Postavljanje (ti, prije R2–R4)

1. R2 → Create bucket `capturedwell-reviews`, **bez** public accessa i custom domene.
2. R2 token `github-sync` → proširiti na taj bucket (ili novi token samo za čitanje njega).
3. Turnstile → Add widget → domena `capturedwell.com` (+ `workers.dev` za pregled) → site key i secret.
4. Email Routing: Damirov Gmail kao **verified destination** (A1/10) — `send_email` smije slati samo na nju.

### Otvoreno

- Banner se **ne reže**: okvir preuzima proporcije same fotke. Na mobitelu puna širina, iznad
  toga visina `min(40svh, 22rem)` i širina iz omjera, poravnato s naslovom. Strelice su
  glifovi iz lightboxa (`‹` senf, `›` hrđa). Damirova fotka je u `recenzije/` od 2026-09-23.
- Od `lg` recenzije stoje u stupcu uz fotku. Traka se sama pomiče svakih 5 s (s kraja na
  početak) dok posjetitelj ne klikne, tipka ili fokusira bilo što; ne kad je izvan ekrana
  ni uz `prefers-reduced-motion`. Oba ruba trake se gase maskom na širinu gutter-a, da tekst
  ne udara u fotku ni u rub ekrana.
- Alt bannera je generički („Fotografija Damira Sukopa"). Bolji ide u polje *Opis* fotke na Driveu.
- Recenzije nemaju linkove na profile (2026-09-24), ni nove ni one s Wfolija.
