# Cmok — stan projektu i dokumentacja robocza

Stan na: 2026-03-26  
Źródło: audit kodu w repo + weryfikacja kompilacji TypeScript (`tsc --noEmit`)

## 1. Gdzie dziś jesteśmy

Cmok jest dziś mobilnym MVP zbudowanym wokół trzech rzeczy:

1. relacji 1:1 między osobą, która `Nadaje znak`, a osobą, która `Dostaje znak`
2. codziennego rytuału `Dzisiejszy znak`
3. prostego trybu `Potrzebuję wsparcia` z pierwszym modelem `Osób zaufanych`

To nie jest już koncept, tylko działająca baza produktu:

- onboarding i połączenie relacji są wdrożone
- daily loop jest wdrożony
- support loop jest wdrożony
- trusted contacts istnieją
- push setup został utwardzony pod Expo push

Jednocześnie repo nadal ma kilka wyraźnych długów:

- fizyczny model danych nadal siedzi na starych nazwach `senior` / `caregiver`
- w repo nadal leżą stare aliasy tras i ekranów po dawnym modelu
- nie ma testów automatycznych
- część logiki nadal opiera się o historyczne nazwy tabel i kolumn
- `checkin-monitor` wygląda na starszy, niedokończony tor i nie jest spójny z nowym framingiem produktu

## 2. Produkt w aktualnym wydaniu

### Główna obietnica

Cmok daje bliskim spokojny, codzienny kontakt bez klimatu monitoringu:

- jedna osoba daje prosty znak, że dziś wszystko jest w porządku
- druga osoba ma jasny stan dnia bez potrzeby dopytywania
- jeśli coś jest nie tak, można uruchomić prostą prośbę o wsparcie

### Obecne role produktu

- `Nadaję znak`
- `Dostaję znak`
- `Osoba zaufana`

### Co produkt realnie robi

- tworzy relację przez kod połączenia
- pozwala wysłać `Dzisiejszy znak`
- pokazuje stan dnia po obu stronach
- pozwala uruchomić `Potrzebuję wsparcia`
- pokazuje aktywną sprawę wsparcia głównej osobie i osobom zaufanym
- pozwala jednej osobie kliknąć `Zajmuję się tym`
- pozwala zamknąć sprawę

### Czego produkt jeszcze nie robi wiarygodnie end-to-end

- nie gwarantuje dostarczenia push na urządzenie
- nie ma SMS fallbacku
- nie ma read receiptów
- nie ma automatycznych retry scenariuszy poza ręcznym retry
- nie ma rozbudowanej historii wsparcia ani wielostopniowej eskalacji

## 3. Stack i narzędzia

### Frontend

- Expo 54
- React 19
- React Native 0.81
- `expo-router`
- `expo-notifications`
- `expo-location`
- `expo-secure-store`
- `@react-native-community/netinfo`

Główne pliki:

- `package.json`
- `app/_layout.tsx`
- `app/index.tsx`
- `app/onboarding.tsx`

### Backend / dane

- Supabase
- Postgres + RLS
- Supabase Edge Functions

Główne obszary:

- `supabase/migrations/`
- `supabase/functions/register-device/index.ts`
- `supabase/functions/urgent-signal/index.ts`

### Build / deploy

- EAS Build
- `app.config.ts`
- `app.json`
- `eas.json`

### Najważniejsze komendy lokalne

- `npm run start`
- `npm run android`
- `npm run ios`
- `npm run web`
- `./node_modules/.bin/tsc --noEmit --pretty false`

## 4. Mapa aplikacji

### Trasy aktywne

- `/onboarding`
- `/waiting`
- `/signaler-home`
- `/recipient-home`
- `/trusted-contacts`
- `/trusted-support`
- `/settings`

### Routing główny

`app/index.tsx` rozdziela użytkownika na podstawie:

- sesji
- profilu
- statusu relacji
- dostępu jako `Osoba zaufana`

Aktualna logika:

- brak profilu lub sesji -> onboarding
- `pending` + rola `recipient` -> waiting
- `active` + rola `signaler` -> signaler home
- `active` + rola `recipient` -> recipient home
- brak głównej relacji, ale aktywny membership trusted -> trusted support

### Ekrany i ich rola

#### Onboarding

- `src/screens/WelcomeScreen.tsx`
- `src/screens/EnterCodeScreen.tsx`
- `src/screens/PhoneAuthScreen.tsx` (telefon + weryfikacja SMS w jednym)
- `src/screens/WhoGetsSignScreen.tsx`
- `src/screens/JoinScreen.tsx`

#### Ekrany główne

- `src/screens/SignalerHomeScreen.tsx`
- `src/screens/RecipientHomeScreen.tsx`
- `src/screens/TrustedSupportScreen.tsx`
- `src/screens/TrustedContactsScreen.tsx`
- `src/screens/SettingsScreen.tsx`

## 5. Aktualne feature’y

### 5.1 Onboarding i relacja

Status: działa

Opis:

- logowanie odbywa się przez numer telefonu i OTP
- użytkownik wybiera rolę `Nadaję znak` albo `Dostaję znak`
- osoba `Dostaję znak` tworzy kod połączenia
- osoba `Nadaję znak` wpisuje kod i aktywuje relację

Technicznie:

- `src/screens/JoinScreen.tsx`
- `src/hooks/useRelationship.ts`
- migracja `006_relationship_cleanup.sql`
- RPC `accept_relationship_invite`

Uwagi:

- warstwa domenowa mówi już językiem `signaler` / `recipient`
- storage nadal używa `care_pairs`, `senior_id`, `caregiver_id`

### 5.2 Daily loop

Status: działa

Opis:

- `Nadaję znak` ma ekran z centralnym rytuałem `Dzisiejszy znak`
- po wysłaniu pojawia się success state i lekkie domknięcie dnia
- `Dostaję znak` widzi spokojny status dnia i ostatni kontakt
- istnieje prosty continuity view ostatnich dni
- istnieją drobne reakcje zwrotne

Technicznie:

- `src/screens/SignalerHomeScreen.tsx`
- `src/screens/RecipientHomeScreen.tsx`
- `src/hooks/useCheckin.ts`
- `src/hooks/useSignals.ts`
- `src/hooks/useCircle.ts`

Uwagi:

- check-in zapisuje się do `daily_checkins`
- reakcje zapisują się do `signals`
- część nazw technicznych nadal odwołuje się do starego modelu danych

### 5.3 Support loop

Status: działa jako MVP

Opis:

- signaler może uruchomić pilny sygnał (`Daj znać bliskim`)
- system tworzy aktywną sprawę wsparcia
- główna osoba i osoby zaufane widzą tę samą sprawę
- jedna osoba może przejąć sprawę przez `Zajmuję się tym`
- właściciel może zamknąć sprawę

Technicznie:

- `src/hooks/useUrgentSignal.ts`
- `src/screens/TrustedSupportScreen.tsx`
- support sekcje w `SignalerHomeScreen.tsx` i `RecipientHomeScreen.tsx`
- edge function `supabase/functions/urgent-signal/index.ts`
- migracja `007_support_network.sql`
- RPC `claim_support_alert`
- RPC `resolve_support_alert`

Uczciwe ograniczenia:

- `sent` oznacza próbę wysyłki do Expo, nie gwarantowane dostarczenie
- brak SMS
- brak potwierdzenia odczytu

### 5.4 Osoby zaufane

Status: działa jako MVP

Opis:

- główna osoba może dodać dodatkowe osoby po numerze telefonu
- osoba musi już mieć konto w Cmok
- osoby zaufane nie dostają codziennego znaku
- osoby zaufane widzą tylko aktywną sprawę wsparcia

Technicznie:

- `src/screens/TrustedContactsScreen.tsx`
- `src/hooks/useTrustedContacts.ts`
- tabela `trusted_contacts`
- RPC `add_trusted_contact_by_phone`
- RPC `remove_trusted_contact`

### 5.5 Push

Status: utwardzone, ale nadal bez gwarancji delivery

Opis:

- app rejestruje Expo push token przy starcie
- token trafia do `device_installations`
- support alert wysyła push do głównej osoby i osób zaufanych
- system zapisuje status próby wysyłki per odbiorca

Technicznie:

- `src/services/notifications.ts`
- `supabase/functions/register-device/index.ts`
- `supabase/functions/urgent-signal/index.ts`
- `app.config.ts`
- `eas.json`

## 6. Model danych

### Główne tabele

- `users`
- `care_pairs`
- `daily_checkins`
- `alert_cases`
- `alert_deliveries`
- `signals`
- `device_installations`
- `trusted_contacts`

### Ważna uwaga domenowa

Repo świadomie ukrywa część starego języka domenowego za hookami i typami, ale baza nadal fizycznie używa:

- `care_pairs`
- `senior_id`
- `caregiver_id`

To oznacza:

- produktowo jesteśmy po pivocie
- semantycznie storage jeszcze nie

### Najważniejsze migracje

- `001_initial_schema.sql` — baza danych i podstawowe RLS
- `002_sos_rls_policies.sql` — dodatkowe RLS polityki dla sygnałów
- `003_checkin_monitor.sql` — stare monitorowanie braku check-inu
- `004_multi_caregiver.sql` — starszy tor multi-caregiver/signals
- `005_nullable_senior_id.sql` — pending relationship
- `006_relationship_cleanup.sql` — cleanup relacji po pivocie
- `007_support_network.sql` — osoby zaufane i ownership spraw wsparcia

## 7. Najważniejsze hooki i usługi

### Hooki domenowe

- `useRelationship`
  - źródło prawdy o sesji, profilu, relacji i trusted access
- `useCheckin`
  - stan dzisiejszego znaku i zapis check-inu
- `useUrgentSignal`
  - pilny sygnał: trigger, retry, claim, resolve, cancel
- `useTrustedContacts`
  - lista, dodawanie i usuwanie osób zaufanych
- `useSignals`
  - małe reakcje zwrotne
- `useCircle`
  - prosty widok relacji 1:1 wykorzystywany przez ekrany główne

### Usługi

- `src/services/supabase.ts`
  - klient Supabase i storage sesji
- `src/services/notifications.ts`
  - rejestracja Expo push tokena
- `src/services/offlineSync.ts`
  - lokalny pending check-in i próba późniejszej synchronizacji

## 8. Co działa dobrze

- jasny podział produktu na daily loop i support loop
- onboarding jest prostszy niż w starej wersji
- waiting state jest wydzielony
- support ownership jest minimalne, ale czytelne
- trusted contacts są małe i sensowne, bez rozlewania scope’u
- push setup jest bardziej uczciwy niż wcześniej
- TypeScript przechodzi

## 9. Co jest długiem albo ryzykiem

### 9.1 Dług techniczny w nazwach

Mimo pivota nadal istnieją w repo stare pliki:

- `app/senior-home.tsx`
- `app/caregiver-dashboard.tsx`
- `src/screens/SeniorHomeScreen.tsx`
- `src/screens/CaregiverDashboardScreen.tsx`

To wygląda jak pozostałości po rename cleanup. Trzeba traktować je jako dług do wycięcia albo świadomie utrzymywany alias.

### 9.2 Dług semantyczny w bazie

Nowa domena produktu siedzi na starych polach:

- `senior_id`
- `caregiver_id`
- `senior_name`

To jest dziś akceptowalne operacyjnie, ale kosztuje czytelność i utrudnia dalszy rozwój.

### 9.3 Brak testów automatycznych

Repo nie ma:

- testów jednostkowych
- testów integracyjnych
- testów E2E

Jedyne potwierdzenie jakości w kodzie to:

- ręczne testy
- typecheck

### 9.4 Push nadal nie jest gwarantowany

System potrafi:

- zarejestrować token
- zapisać token
- próbować wysłać push
- zapisać status próby

System nie potrafi dziś zagwarantować:

- że użytkownik dostał powiadomienie
- że urządzenie było dostępne
- że system operacyjny je pokazał

### 9.5 Stary tor monitoringu check-inu

`supabase/functions/checkin-monitor/index.ts` nadal istnieje i używa starego języka oraz starszych założeń produktu. To wygląda jak obszar wymagający decyzji:

- albo go przepisać pod nowy model
- albo usunąć z aktywnego użycia

### 9.6 Konfiguracja

Repo ma jednocześnie:

- `app.json`
- `app.config.ts`

To jest do przeżycia, ale wymaga dyscypliny, żeby jedna konfiguracja nie zaczęła rozjeżdżać drugiej.

### 9.7 Sekretologia i env

`src/services/supabase.ts` trzyma URL i publishable key w kodzie. To technicznie działa, ale warto mieć świadomość, że:

- jest to mniej elastyczne środowiskowo
- utrudnia łatwe przepinanie środowisk

## 10. Co dziś jest gotowe do testów z ludźmi

Za gotowe do pierwszych realnych testów można uznać:

- onboarding 1:1
- codzienny znak
- support alert
- ownership sprawy
- trusted contacts
- push registration na fizycznym urządzeniu

Warunek: trzeba przejść ręczną checklistę release readiness na realnych telefonach.

## 11. Co wymaga ręcznej walidacji przed testami

- czy na realnych urządzeniach zapisują się `push_token` w `device_installations`
- czy support alert dociera do głównej osoby
- czy trusted contact faktycznie widzi aktywną sprawę
- czy `Zajmuję się tym` nie daje race condition przy dwóch telefonach
- czy waiting state poprawnie kończy się po połączeniu

## 12. Rekomendowany następny porządek prac

### Krótki termin

- dokończyć cleanup starych aliasów tras i ekranów
- zdecydować los `checkin-monitor`
- dopiąć jedną prawdę o konfiguracji Expo (`app.config.ts` jako źródło główne)

### Średni termin

- dodać minimalne testy smoke / integration wokół relacji i support flow
- ograniczyć bezpośrednie użycie nazw `senior/caregiver` do warstwy storage
- poprawić read model daily loopu pod timezone i lokalny dzień

### Dalszy termin

- rozważyć pełny rename storage lub warstwę repository/mapper
- dodać lepsze operacyjne logowanie i obserwowalność edge functions

## 13. Krótki słownik domenowy

- `Nadaję znak` — osoba mieszkająca sama, która wysyła codzienny znak
- `Dostaję znak` — główna bliska osoba, która dostaje znak codziennie
- `Osoba zaufana` — dodatkowa osoba widząca tylko aktywną sprawę wsparcia
- `Dzisiejszy znak` — codzienny check-in
- `Potrzebuję wsparcia` — uruchomienie sprawy wsparcia
- `Zajmuję się tym` — przejęcie ownership aktywnej sprawy

## 14. Najkrótsze podsumowanie

Projekt jest po najważniejszym pivocie produktowym i ma już działające MVP, które da się testować na realnych użytkownikach. Największy dług nie jest dziś w samym produkcie, tylko w porządku repo, nazewnictwie storage, manualnym QA i operacyjnej wiarygodności push.
