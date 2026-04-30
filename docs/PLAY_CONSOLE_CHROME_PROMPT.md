# Prompt do Chrome Extension — wypełnienie Play Console dla cmok

Wklej całość poniżej do extension (Claude in Chrome / browser-use / itd.).
Extension napędza już zalogowaną sesję Play Console.

---

# Zadanie

Jesteś agentem prowadzącym Google Play Console dla aplikacji `cmok`
(`com.hermit85.cmok`, account: cybirdconsulting). Aplikacja jest właśnie
utworzona, ale wszystkie sekcje "App content" i "Main store listing"
są puste. Twoja rola: wypełnić wszystkie wymagane pola dokładnie tak
jak poniżej, **zatrzymując się przed każdą nieodwracalną akcją**.

## Twarde zasady

1. **NIGDY** nie klikaj `Submit for review`, `Start rollout to Internal
   testing`, `Publish` ani podobnych przycisków produkcyjnych. Stop i
   raport do użytkownika.
2. `Save` (draft) na dole każdej sekcji — OK do klikania po wypełnieniu.
3. Dla uploadów plików: kliknij przycisk uploadu żeby otworzyć natywne
   okno systemu, **zatrzymaj się i powiedz użytkownikowi dokładną
   ścieżkę pliku do wybrania**. User wybierze ręcznie, potem wracasz.
4. Czekaj na przeładowanie strony przed kolejną akcją (Play Console
   jest powolne).
5. Jeśli któreś pole nie pasuje do tego promptu (np. Google dodał nowe
   pytanie) — STOP i raport.
6. Polskie znaki: zawsze pełne (ą, ę, ć, ś, ź, ż, ó, ł, ń) — nigdy
   bez ogonków.

## Start

URL: https://play.google.com/console
Wybierz aplikację: **cmok** (com.hermit85.cmok)

---

## SEKCJA 1 — Main store listing

Nawigacja: lewy panel → **Grow → Store presence → Main store listing**

### App name
```
cmok
```
(lowercase, 4 znaki)

### Short description
```
codzienny znak bliskości dla osób, które mieszkają osobno
```

### Full description
Wklej dokładnie (z zachowaniem pustych linii i polskich znaków):

```
cmok – codzienny znak bliskości

cmok to prosta apka dla dwóch osób, które mieszkają osobno i chcą wiedzieć, że u tej drugiej wszystko OK. Bez dzwonienia, bez stresu, bez kolejnego "jak się masz?". Jeden gest dziennie wystarczy.

JAK TO DZIAŁA

• Bliska osoba (np. mama, babcia, tata) raz dziennie wciska w apce „daj znak". To zajmuje sekundę.
• Ty od razu widzisz, że dzisiejszy znak jest. Spokój dla obu stron.
• Można dorzucić nastrój – „spokojnie", „zmęczona", „u lekarza" – żeby było wiadomo dlaczego.
• Reagujesz krótkim sercem, gestem, słowem. Bez wymuszania rozmowy.

KRĄG BLISKICH

Drugi krąg, który widzi tylko sygnały pilne. Sąsiad, brat, druga córka. Wpisujesz im numer i wszystko jest gotowe. Jak coś się dzieje – wszyscy dostają znać równolegle.

BEZPIECZNIK NA TRUDNIEJSZE CHWILE

Jeden duży przycisk „Potrzebuję pomocy". Po potwierdzeniu cmok wysyła sygnał do całego kręgu z lokalizacją (jeśli pozwolisz). Ktoś z bliskich potwierdza, że się zajmuje, żeby reszta nie panikowała.

DLA KOGO

• Dla rodziców i dzieci, które mieszkają w różnych miastach.
• Dla seniora i opiekuna.
• Dla każdego, kto chce mieć codzienny mostek do bliskiej osoby, bez nachalnego sprawdzania.

PRYWATNOŚĆ NA PIERWSZYM MIEJSCU

• Wszystkie dane są w UE (Frankfurt).
• Numer telefonu używany jest tylko do logowania.
• Brak reklam, brak trackerów cross-app.
• Możesz w każdej chwili usunąć konto z poziomu apki.
• Polityka prywatności i regulamin pod cmok.app.

WAŻNE

cmok nie zastępuje numeru 112 ani służb ratunkowych. To narzędzie codziennej bliskości i wczesnego sygnału do rodziny, nie alarm medyczny.

POMOC I KONTAKT

Pisz: cybird.consulting@gmail.com
```

### Graphics — STOP przy każdym uploadzie

Kliknij przycisk uploadu i powiedz użytkownikowi:

1. **App icon (512×512 PNG)**:
   `/Users/darekptaszek/Dev/active/cmok/artifacts/play-store-graphics/icon-512.png`

2. **Feature graphic (1024×500 PNG)**:
   `/Users/darekptaszek/Dev/active/cmok/artifacts/play-store-graphics/feature-graphic-1024x500.png`

3. **Phone screenshots** (Play wymaga min. 2; mamy 4 — wgraj wszystkie po kolei):
   - `/Users/darekptaszek/Desktop/01_hero.png`
   - `/Users/darekptaszek/Desktop/02_response.png`
   - `/Users/darekptaszek/Desktop/03_help.png`
   - `/Users/darekptaszek/Desktop/04_privacy.png`

4. **Video URL** — pomiń (zostaw puste)
5. **7-inch tablet screenshots** — pomiń
6. **10-inch tablet screenshots** — pomiń

Po wszystkich uploadach: kliknij `Save` na dole. Raport: "Sekcja 1 OK".

---

## SEKCJA 2 — Store settings

Nawigacja: lewy panel → **Grow → Store presence → Store settings**

- **App category**: `Lifestyle`
- **Tags**: pomiń (opcjonalne)
- **Email**: `cybird.consulting@gmail.com`
- **Phone**: pomiń
- **Website**: `https://cmok.app`
- **External marketing**: zostaw default

Kliknij `Save`. Raport: "Sekcja 2 OK".

---

## SEKCJA 3 — App content

Nawigacja: lewy panel → **Policy → App content**

Wypełnij każdą podsekcję w kolejności jak niżej.

### 3.1 Privacy policy
- URL: `https://cmok.app/polityka-prywatnosci`
- `Save`

### 3.2 App access
- Wybierz: **All or some functionality is restricted**
- Add instructions: kliknij `Add new instructions`
- Name: `Konto testowe — signaler i recipient`
- Username: `+48 500 000 001`
- Password: `123456`
- Comments / instructions:

```
Aplikacja wymaga logowania przez SMS OTP. Konta testowe:

• +48 500 000 001 (Mama, signaler) — kod OTP: 123456
• +48 500 000 002 (Darek, recipient) — kod OTP: 123456

SMS są obsługiwane przez Supabase Auth bez wysyłania faktycznych
wiadomości na te numery — kod 123456 jest pre-skonfigurowany.

Po zalogowaniu jako Mama (signaler) → ekran "daj znak", picker nastroju,
przycisk "Potrzebuję pomocy".
Po zalogowaniu jako Darek (recipient) → odbiór znaku + reakcje.
```
- `Save`

### 3.3 Ads
- Wybierz: **No, my app does not contain ads**
- `Save`

### 3.4 Content rating

Kliknij `Start questionnaire`.

- Email: `cybird.consulting@gmail.com`
- Category: **Reference, News, or Educational**

Kolejne pytania (odpowiedz **No** na wszystkie poniższe — STOP jeśli
pytanie nie pasuje do tej listy):

| Pytanie (skrót) | Odpowiedź |
|-----------------|-----------|
| Violence (any kind) | No |
| Sexual content / nudity | No |
| Profanity / crude humor | No |
| Controlled substances / drugs / alcohol / tobacco | No |
| Simulated gambling | No |
| Real money gambling | No |
| User-generated content (user can post text/images visible to others) | **YES** *(reakcje + wiadomości w cmok)* |
| Sharing user location | **YES** *(SOS dołącza lokalizację)* |
| Personal info collected | **YES** *(numer telefonu)* |
| Digital purchases | No |
| Gory / shocking content | No |

Po zakończeniu: kliknij `Save`, potem `Calculate rating`, potem na
podsumowaniu **STOP i raport** — pokaż użytkownikowi wynik (PEGI/IARC)
i czekaj na "OK". Dopiero potem klikaj `Apply rating`.

### 3.5 Target audience and content
- Target age groups: zaznacz tylko **18 and over**
- Appeal to children: **No**
- `Next` → potwierdź następny dialog → `Save`

### 3.6 News app
- Wybierz: **No, my app is not a news app**
- `Save`

### 3.7 Government apps
- Wybierz: **Not a government app**
- `Save`

### 3.8 Financial features
- Wybierz: **My app does not have any of these financial features**
- `Save`

### 3.9 Health apps
- Wybierz: **Not a health app**
- (Uzasadnienie dla użytkownika — cmok jest narzędziem komunikacyjnym,
  nie medycznym; dyskwalifikator zgodny z disclaimerem "nie zastępuje 112")
- `Save`

### 3.10 COVID-19 contact tracing
- Wybierz: **Not a publicly available COVID-19 contact tracing and
  status app**
- `Save`

### 3.11 Data safety — STOP, najtrudniejsza sekcja

Kliknij `Manage` lub `Start`. Tu wypełnij szczegółowo. **Stop po każdym
ekranie i raportuj** — to długi formularz, łatwo o pomyłkę.

#### Pytanie 1: Czy aplikacja zbiera lub udostępnia dane użytkownika?
- **Yes** (zbiera, ale nie udostępnia)

#### Pytanie 2: Czy wszystkie zebrane dane są szyfrowane w transmisji?
- **Yes** (HTTPS wszędzie)

#### Pytanie 3: Czy użytkownicy mogą prosić o usunięcie danych?
- **Yes** (in-app: Settings → "Usuń konto i dane")

#### Data types collected (dokładny zestaw)

Zaznacz tylko poniższe (resztę zostaw odznaczoną):

| Kategoria | Typ danych | Collected | Shared | Required/Optional | Purpose |
|-----------|-----------|-----------|--------|-------------------|---------|
| **Personal info** | Phone number | ✓ | ✗ | Required | Account management |
| **Personal info** | Name | ✓ | ✗ | Required | App functionality |
| **App activity** | App interactions | ✓ | ✗ | Optional | Analytics |
| **App info & performance** | Crash logs | ✓ | ✗ | Required | Analytics, App functionality |
| **App info & performance** | Diagnostics | ✓ | ✗ | Required | App functionality |
| **Device or other IDs** | Device or other IDs | ✓ | ✗ | Required | App functionality (push notifications) |
| **Location** | Approximate location | ✓ | ✗ | Optional | App functionality (SOS sygnał z lokalizacją) |

**NIE zaznaczaj**: precise location, financial info, health info,
fitness, messages, photos/videos, audio, files, calendar, contacts,
search history, web browsing history, race/ethnicity, sexual orientation,
political/religious info.

Dla każdego typu danych w formularzu Google zapyta:
- "Is this data collected, shared or both?" → **Collected**
- "Is this data processed ephemerally?" → **No** (jest przechowywane)
- "Is data collection required, or can users choose?" → patrz tabela
- "Why is this data collected?" → patrz tabela "Purpose"

Po wszystkich typach: review i `Save`. **STOP, NIE klikaj final
Submit** — wezwij użytkownika do review.

---

## Po wszystkich sekcjach

Pokaż użytkownikowi pełny status (które sekcje mają zielony ✓, które
brakują). NIE rób releasu (Internal testing) — to user uruchomi
osobno z lokalnego AAB.

Raport końcowy: krótki, faktyczny, w punktach.

---

# Lokalne pliki referowane w prompcie

| Plik | Lokalizacja |
|------|-------------|
| App icon 512×512 | `/Users/darekptaszek/Dev/active/cmok/artifacts/play-store-graphics/icon-512.png` |
| Feature graphic 1024×500 | `/Users/darekptaszek/Dev/active/cmok/artifacts/play-store-graphics/feature-graphic-1024x500.png` |
| Screenshot 01 hero | `/Users/darekptaszek/Desktop/01_hero.png` |
| Screenshot 02 response | `/Users/darekptaszek/Desktop/02_response.png` |
| Screenshot 03 help | `/Users/darekptaszek/Desktop/03_help.png` |
| Screenshot 04 privacy | `/Users/darekptaszek/Desktop/04_privacy.png` |

Koniec promptu.
