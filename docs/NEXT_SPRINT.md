# Next Sprint: Core Experience Fix

## Priority 1: Push Notifications (BLOCKER)
- [ ] Push notifications nie docierają na fizycznym urządzeniu
- [ ] checkin-notify zwraca 401 — edge functions odrzucają auth
- [ ] register-device zwraca 401 — push token nie jest rejestrowany
- [ ] Diagnoza: czy problem jest w anon key, session token, czy JWT verification
- [ ] Test: wysłać push ręcznie przez Expo Push Tool do zarejestrowanego tokena
- [ ] Test: sprawdzić device_installations w Supabase — czy tokeny są tam

## Priority 2: Realtime / Signal Delivery
- [ ] Reakcja recipient → signaler nie dociera (signaler widzi "Jest znak" bez emoji)
- [ ] Morning thought / poranna myśl — nie widoczna po drugiej stronie
- [ ] Nudge signal — sprawdzić czy dociera
- [ ] Realtime subscriptions — czy działają na produkcji (nie tylko symulator)
- [ ] Polling fallback jest dodany (30s) ale trzeba zweryfikować

## Priority 3: UI / Fun Factor (pre-release)
- [ ] Signaler Home "done" state — za nudny, zero celebracji
  - Dodać: konfetti/particles po check-in
  - Dodać: ciepły toast "Mama już wie"
  - Lepszy response receipt — zamiast "Jest znak" → "Mama wysłała ♥ Kocham"
  - Streak counter bardziej widoczny i gamified
- [ ] Recipient Home — za statyczny
  - Status circle powinien mieć bounce animation gdy znak przychodzi
  - Warm toast przy pierwszym widoku znaku
  - Reaction buttons — więcej juice (spring, scale, haptic)
  - Po reakcji — celebracja, nie tylko pill z tekstem
- [ ] Signaler "Daj znak" pre-state — za pusty
  - Breathing animation na kółku (już jest ale sprawdzić na device)
  - Copy "Mama czeka na Twój znak" — personalizowane
  - Subtle shadow pulse
- [ ] Mood picker — za mały i za płaski
  - Większe chipy z ikony
  - Animacja przy wyborze
  - Haptic feedback
- [ ] Overall polish
  - Brak animacji przejść między stanami
  - Brak micro-interactions
  - Brak sound effects (opcjonalnie)
  - WeekDots — dodać etykiety dni tygodnia (Pn Wt Śr Cz Pt Sb Nd)

## Priority 4: Invite Flow
- [ ] "Zaproś kolejną osobę" — musi generować kod i go pokazywać PRZED share
- [ ] Share message z kodem — zweryfikować że link działa
- [ ] Deep link cmok://join/{code} — czy otwiera app i prowadzi do JoinScreen

## Build Plan
- Naprawić P1 i P2 najpierw
- Potem P3 (UI polish)
- Jeden build na koniec ze wszystkim
- buildNumber: 5 (następny)
