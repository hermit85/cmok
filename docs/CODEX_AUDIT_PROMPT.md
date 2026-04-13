# Codex Independent Audit Prompt for cmok

Zrób niezależny, sceptyczny audit aplikacji cmok w repo /Users/darekptaszek/Projects/cmok.

Nie ufaj wcześniejszym raportom. Zweryfikuj wszystko od zera i rozdziel:
1. co działa naprawdę na backendzie,
2. co jest tylko preview/dev state,
3. co jest zablokowane przez stan danych testowych.

## Kontekst testowy
- recipient: +48100000002, w apce 100000002
- signaler: +48100000001, w apce 100000001
- OTP dla obu: 123456
- timezone: Europe/Warsaw
- dzisiejsza data: 2026-04-13
- Supabase project: pckpxspcecbvjprxmdja

## Krok 1: Sprawdź stan danych w Supabase

Najpierw sprawdź aktualny stan:
- czy para signaler-recipient jest active,
- czy istnieją dodatkowe pending care_pairs (orphany),
- jaki jest aktualny invite_code,
- czy signaler_label / senior_name są zachowane po accept_relationship_invite,
- czy users mają poprawne role i nazwy.

## Krok 2: Audit runtime, ekran po ekranie

Zakres:
- onboarding welcome slides
- intent screen
- phone verify + OTP
- signaler-home
- recipient-home
- settings
- circle
- trusted-contacts
- trusted-support
- waiting
- join/[code]

Dla każdego ekranu odpowiedz:
- czy renderuje się bez crasha,
- czy jest osiągalny z prawdziwego flow,
- czy używa realnych danych z Supabase / RPC / Edge Function,
- czy to preview-only state (__DEV__ + preview param),
- czy wygląda na martwy ekran albo makietę.

## Krok 3: Ryzyka do sprawdzenia

Szczególnie sprawdź:
- accept_relationship_invite czy czyści orphan pending pairs po accept (nowo dodany cleanup),
- resolveLabel: czy recipient widzi konkretną nazwę signalera (np. "Mama"), nie "Bliska osoba",
- useCircle: czy signaler widzi poprawną nazwę recipienta (z users.name), a nie signaler_label,
- UI nie zawiera myślników „—" w widocznym tekście (brand rule),
- preview states w recipient-home i signaler-home nie są mylone z produkcyjnymi flow,
- SetupScreen: invite_expires_at jest ustawiane (24h), waiting screen pokazuje datę wygaśnięcia.

## Krok 4: Code audit

- Sprawdź wszystkie supabase.rpc() i supabase.functions.invoke() — czy nazwy/parametry istnieją,
- Sprawdź cleanup realtime subscriptions (supabase.removeChannel),
- Sprawdź polskie znaki: ą, ę, ć, ś, ź, ż, ó, ł, ń — szukaj "z rzedu", "lacznie", "Caly", "Swietna", "dal(a)" bez ogonków,
- Sprawdź czy usunięte pliki (LocationConsentScreen, PhoneAuthScreen, VerifyCodeScreen) nie są importowane.

## Krok 5: Nie wykonuj

- Nie usuwaj kont (delete-account),
- Nie wysyłaj realnego urgent signal,
- Nie zmieniaj danych produkcyjnych bez konieczności.

## Format odpowiedzi

1. Findings first, od najwyższego priorytetu.
2. Przy każdym problemie podaj:
   - severity: blocker / major / minor
   - co dokładnie nie działa
   - czy to bug danych, bug UI, bug flow, czy preview-only behavior
   - plik i linia
   - jak to odtworzyć
3. Potem osobno:
   - Ekrany realne
   - Ekrany preview-only
   - Ekrany niezweryfikowane
4. Na końcu:
   - krótkie podsumowanie gotowości do App Store
   - lista 3 najważniejszych rzeczy do naprawy
