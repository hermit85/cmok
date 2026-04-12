# Cmok — Codzienny znak, że jest OK

## Jedno zdanie

Cmok to darmowa aplikacja dla bliskich osób, które mieszkają osobno — codzienny gest zamiast dzwonienia, spokój zamiast stresu, bezpiecznik zamiast niepokoju.

---

## Problem

Miliony Polaków mieszka samotnie — rodzice, dziadkowie, sąsiedzi. Ich bliscy mieszkają w innych miastach i codziennie martwią się: czy u mamy wszystko OK? Czy tata zjadł obiad? Czy babcia się nie przewróciła?

Dzwonienie codziennie jest ciężkie — dla obu stron. SMS-y giną. A strach zostaje.

Z drugiej strony — osoba mieszkająca sama boi się, że jak jej się coś stanie, nikt nie będzie wiedział. Nie zdąży zadzwonić na 112. Nikt nie sprawdzi przez tydzień.

Cmok rozwiązuje oba problemy jednym gestem dziennie.

---

## Jak to działa

### Codzienny rytuał (30 sekund)

1. **Mama** otwiera apkę rano i tapuje jedno duże kółko: „Daj znak"
2. Opcjonalnie wybiera jak się czuje: Dobrze / Spokojnie / Zmęczona / Na spacerze / U lekarza
3. **Syn** dostaje powiadomienie: „Mama dała znak — wszystko OK"
4. Syn odpowiada jednym gestem: ♥ Kocham / OK! / Super! / Dobranoc
5. Mama widzi: „Syn jest z Tobą"

To jest cały codzienny flow. Jeden tap z każdej strony. Zero pisania, zero dzwonienia.

### Bezpiecznik (gdy coś się dzieje)

Jeśli mama źle się czuje:
1. Tapuje „Potrzebuję pomocy" (widoczny przycisk na dole) lub przytrzymuje kółko przez 2 sekundy
2. Syn, sąsiadka i córka dostają natychmiast pilne powiadomienie z lokalizacją mamy
3. Ktoś z kręgu potwierdza „Zajmuję się tym" — reszta wie, że ktoś reaguje

Jeśli mama NIE dała znaku przez 24 godziny:
- System sam wysyła powiadomienie do kręgu: „Mama nie dała znaku od wczoraj. Sprawdź czy wszystko OK."
- Nie trzeba nic klikać — to pasywny bezpiecznik

### Krąg bliskich

Mama nie jest połączona tylko z synem. Ma krąg — syn, córka, sąsiadka. Każda z tych osób:
- Widzi codzienny znak mamy
- Może odpowiedzieć gestem
- Dostanie pilne powiadomienie, gdy mama potrzebuje pomocy
- Może potwierdzić, że się zajmuje sytuacją

Im więcej osób w kręgu, tym większe bezpieczeństwo.

---

## Funkcje

### Dla osoby dającej znak (np. mama)
- Jedno duże kółko „Daj znak" — jeden tap dziennie
- Opcjonalny status nastroju (5 opcji bez pisania)
- Widoczny przycisk „Potrzebuję pomocy" + skrót long-press
- Week dots — 7 kropek pokazujących aktywność z tygodnia
- Streak — „5 dni z rzędu", „Cały tydzień!", milestones na 7/14/21/30 dni
- Celebracja na milestones z możliwością podzielenia się
- Statystyki: streak + łączna liczba znaków

### Dla osoby odbierającej znak (np. syn)
- Status kółko — pulsuje gdy czeka, bounce + confetti gdy znak przyszedł
- Ciepły toast: „Mama pamięta o Tobie"
- 4 szybkie reakcje: ♥ Kocham / Dobranoc / OK! / Super!
- Poranne myśli — „Wyślij poranną myśl" zanim mama da znak
- „Przypomnij delikatnie" — soft nudge do mamy
- Week dots + 30-dniowa historia
- Informacja o stażu relacji: „Razem od 14 dni"

### Powiadomienia push (z osobowością)
- Po check-inie: „Mama dała znak — wszystko OK" (lub streak: „Mama — 7 dni z rzędu! Nie zapomina o Tobie")
- Poranne przypomnienie: „Dzień dobry! Syn czeka na Twój znak"
- Nudge od recipienta: „Syn czeka na Twój znak"
- Tygodniowe podsumowanie (niedziela): „Tydzień z Mamą: 6/7 znaków"
- Pilny sygnał: „Mama prosi o kontakt" (kanał urgent)
- Auto-alert 24h: „Mama nie dała znaku od wczoraj. Sprawdź czy wszystko OK."

### Bezpieczeństwo
- Przycisk „Potrzebuję pomocy" (widoczny na głównym ekranie)
- Long-press na kółku (2 sekundy) — szybki sygnał w panice
- Lokalizacja dołączana do sygnału
- Claim/resolve flow — ktoś z kręgu potwierdza, reszta wie
- Automatyczny alert po 24h bez znaku — pasywny bezpiecznik
- Powiadomienia push na kanale urgent (wyższy priorytet)

### Wiralowość
- Onboarding: „Stwórz swój krąg bliskich osób"
- Share na milestones: „Od 7 dni daję Mamie znak, że u mnie OK..."
- „Zaproś kogoś do kręgu" na obu ekranach
- „Zaproś kolejną osobę" w ustawieniach
- Deep link: cmok://join/[kod] — jedno kliknięcie dołączenia
- Kod zaproszenia — 6 cyfr, łatwy do podania przez telefon

### Onboarding (30 sekund)
- 3 slajdy: problem → rozwiązanie → krąg
- Dwie ścieżki: „Mam kod zaproszenia" / „Chcę zaprosić bliską osobę"
- Weryfikacja SMS (6-cyfrowy kod)
- Nazwij bliską osobę (np. Mama, Syn, Sąsiadka)
- Wygeneruj kod lub wpisz kod — gotowe

### Prywatność i zgodność
- Usuwanie konta i wszystkich danych (wymagane przez Apple/Google)
- Polityka prywatności + Regulamin
- Dane przechowywane w Supabase (EU region)
- Brak zbierania danych marketingowych
- Lokalizacja tylko przy pilnym sygnale (za zgodą)

---

## Stack technologiczny

- **Frontend**: React Native + Expo (iOS + Android)
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + Realtime)
- **Push**: Expo Push Notifications
- **Fonts**: Nunito (nagłówki) + Inter (body)
- **Bezpieczeństwo**: Row Level Security na każdej tabeli, JWT auth

---

## Kluczowe metryki (do śledzenia)

- **DAU/MAU** — ile osób codziennie otwiera apkę
- **Check-in rate** — % signalerów, którzy dali znak dziś
- **Response rate** — % recipientów, którzy odpowiedzieli gestem
- **Streak length** — średni streak (cel: >7 dni)
- **K-factor** — ile nowych użytkowników przynosi jeden istniejący
- **Time to first sign** — czas od instalacji do pierwszego znaku
- **Urgent signal usage** — ile razy użyto pilnego sygnału
- **Circle size** — średnia liczba osób w kręgu (cel: >2)

---

## Dla kogo jest Cmok

- Dorosłe dzieci, których rodzice mieszkają sami w innym mieście
- Rodzice, którzy chcą dać dzieciom spokój bez codziennego dzwonienia
- Sąsiedzi starszych osób, którzy chcą mieć oko bez natrętności
- Każdy, kto martwi się o bliską osobę mieszkającą samotnie

---

## Czym Cmok NIE jest

- Nie jest aplikacją medyczną ani alarmową
- Nie monitoruje zdrowia, nie mierzy tętna
- Nie śledzi lokalizacji na bieżąco (tylko przy pilnym sygnale)
- Nie wymaga smartwatcha ani dodatkowych urządzeń
- Nie jest kolejnym komunikatorem — to codzienny rytuał, nie chat

---

## Jedno zdanie na koniec

Cmok to codzienny cmok na dzień dobry — cyfrowy pocałunek od mamy, że u niej jest OK. I bezpiecznik, gdyby nie było.
