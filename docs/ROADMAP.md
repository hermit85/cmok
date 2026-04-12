# CMOK — Product Roadmap

> Cel: retencja + wiralowość. Każdy sprint = 1 commit, test, stop.

---

## Sprint R1: Push notifications z osobowością
**Impact: retencja recipienta (otwieranie apki)**

Zmień push copy z informatywnego na emocjonalny:

1. Daily check-in push (do recipienta):
   - Dziś: "Cmok: [Imię] dał(a) znak 💚"
   - Nowe: streak-aware copy:
     - Streak 1: "[Imię] dał(a) Ci pierwszy znak!"
     - Streak 2-6: "[Imię] — dzień [N] z rzędu"
     - Streak 7: "[Imię] — cały tydzień! Nie zapomina o Tobie"
     - Streak 30: "[Imię] — miesiąc razem!"
     - Default: "[Imię] dał(a) znak — wszystko OK"

2. Morning nudge push (do recipienta, 9:00):
   - "Czekamy na dzisiejszy znak od [Imię]"
   - Tylko jeśli signaler jeszcze nie dał znaku
   - Daje recipientowi POWÓD żeby otworzyć apkę

3. Nudge push (do signalera, od recipienta):
   - "[Imię recipienta] czeka na Twój znak"

---

## Sprint R2: Recipient celebration — radość na obu stronach
**Impact: retencja recipienta (emotional payoff)**

Kiedy recipient otwiera apkę i widzi że signaler dał znak:
1. Animacja na kółku: transition z "···" do "✓" z bounce
2. Copy: "Mama dała znak" z warm subtitle
3. Confetti particles (te same co signaler milestones) na pierwszym
   otwarciu po znaku — recipient też dostaje moment radości
4. Streak info widoczne dla recipienta: "5 dni z rzędu!"

---

## Sprint R3: Multi-reakcje zamiast jednego "Wyślij serduszko"
**Impact: engagement depth, daily interaction**

Zamiast 1 buttona "Wyślij serduszko", pokaż 3-4 quick reactions:
- ❤️ (serce) — "kocham"
- ☕ (kawa) — "miłego dnia"  
- 🌞 (słońce) — "piękny dzień"
- 👋 (machanie) — "cześć!"

Signaler widzi JAKĄ reakcję dostał, nie tylko "Jest znak".
To zamienia check-in w mini-rozmowę bez słów.

Technicznie: signals.emoji już wspiera dowolne emoji.
Trzeba tylko zmienić UI z 1 buttona na 4.

---

## Sprint R4: Opcjonalny status signalera  
**Impact: engagement depth, emotional connection**

Po tapnięciu "Daj znak" signaler OPCJONALNIE może dodać status:
- 🌞 Dobry dzień
- ☕ Spokojnie
- 😴 Zmęczona
- 🏥 U lekarza
- 🚶 Na spacerze

Recipient widzi: "Mama dała znak — na spacerze 🚶"
To daje więcej kontekstu bez wymogu pisania.

Technicznie: nowa kolumna w daily_checkins (status_emoji text nullable).

---

## Sprint R5: Milestone sharing — wiralowość
**Impact: organic growth, word-of-mouth**

Po milestone (7, 14, 30 dni) pokaż share card:
- Piękna grafika: "Mama i ja — 30 dni bliskości"
- Button: "Podziel się" → native share sheet
- Targetowane copy: "Znasz kogoś, kto mieszka sam?"

Recipient widzi po 7 dniach:
- "Mama daje Ci znak codziennie od tygodnia. 
   Znasz kogoś, komu też by to pomogło?"
- Button "Zaproś" z linkiem do App Store

---

## Sprint R6: Multi-pair — growth engine
**Impact: wiralowość, network effect**

Jeden user może być w wielu parach:
- Syn monitoruje mamę I babcię
- Mama jest monitorowana przez syna I córkę
- Sąsiad jest w kręgu zaufanym mamy

UI: home screen z tabs/swipe między parami.
Onboarding: "Dodaj kolejną osobę" po zakończeniu pierwszej pary.

---

## Sprint R7: Weekly summary — retention loop
**Impact: retencja, awareness**

Push w niedzielę wieczorem:
- "Tydzień z Mamą: 6/7 znaków. Mama jest spokojna."
- "Tydzień z Mamą: 7/7 — pełny tydzień!"
- "Tydzień z Mamą: 3/7 — może warto porozmawiać?"

---

## Sprint R8: Smart reminders
**Impact: retencja signalera**

Signaler ustawia przypomnienie (np. 8:00):
- Push: "Czas na Twój codzienny znak"
- Jeśli do 12:00 nie da znaku: "Pamiętaj o znaku — [Imię] czeka"
- Konfigurowalne w Settings

---

## KOLEJNOŚĆ: R1 → R2 → R3 → R4 → R5 → R6 → R7 → R8

R1-R2: natychmiastowy impact na retencję (push + celebration)
R3-R4: deepening (więcej do robienia w apce)
R5-R6: growth (sharing + network effect)
R7-R8: polish (weekly loop + reminders)
