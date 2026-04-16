# cmok — Brand & Design System

## Misja
cmok to codzienny rytuał bliskości między osobami, które mieszkają osobno. Jeden gest dziennie = spokój dla obu stron + bezpiecznik gdy coś się dzieje.

## Ton głosu
- Ciepły, intymny, polski
- Jak cmok na dzień dobry — nie jak komunikat z urzędu
- Nigdy kliniczny, alarmowy, medyczny
- Mówi "bliska osoba", nie "użytkownik" czy "pacjent"
- Lowercase "cmok" — szept, nie krzyk

## Paleta kolorów

| Token | Hex | Użycie |
|-------|-----|--------|
| background | `#FFF8F2` | Tło wszystkich ekranów (cream) |
| accent | `#E85D3A` | CTA buttony, logo, primary actions (terracotta) |
| accentStrong | `#D04E2E` | Hover/pressed terracotta |
| safe | `#2EC4B6` | Kółko "Daj znak", checkmarki, streaki (teal) |
| safeStrong | `#23A99D` | Teal pressed |
| safeLight | `#E0F7F5` | Teal tło (done state, sent pill) |
| love | `#FF6B6B` | Serce, reakcje, receipt pill (coral) |
| loveLight | `#FFE5E5` | Coral tło |
| highlight | `#FFD93D` | Today dot, streak accent (gold) |
| delight | `#A78BFA` | Confetti, milestones (lilac) |
| text | `#2D2926` | Primary text |
| textSecondary | `#9B9490` | Secondary text, subtitles |
| textMuted | `#AAA299` | Muted text, hints |
| border | `#E0DAD3` | Borders, dividers |
| surface | `#F0EBE5` | Input backgrounds, cards |
| cardStrong | `#FFFFFF` | White cards |

## Typografia

| Rola | Font | Weight | Rozmiar |
|------|------|--------|---------|
| Logo | Nunito | 800 (ExtraBold) | 32-40px |
| Nagłówki (>20px) | Nunito | 700 (Bold) | 20-48px |
| Sub-nagłówki | Nunito | 600 (SemiBold) | 16-20px |
| Body text | Inter / system | 400-500 | 14-16px |
| Labels, captions | Inter / system | 500-600 | 12-13px |
| Buttony | Nunito | 700 | 17px |

## Komponenty

### Button Primary (CTA)
- Background: `accent` (#E85D3A)
- Text: white, Nunito Bold 17px
- Height: 56px, borderRadius: 18px
- Shadow: `0 6px 20px rgba(232,93,58,0.35)`
- Disabled: opacity 0.4 (nie szary kolor)
- Pressed: opacity 0.85, scale 0.98

### Button Teal (join/confirm)
- Background: `safe` (#2EC4B6)
- Shadow: `0 6px 20px rgba(46,196,182,0.3)`
- Reszta jak Primary

### Kółko "Daj znak" (signaler)
- Rozmiar: 200x200px
- Active: teal fill, breathing animation (scale 1.0→1.03, 2.5s)
- Shadow: animated opacity pulse (0.2→0.4)
- Done: teal border 3px + safeLight fill
- Text: "Daj znak" (active) / "Gotowe ✓" (done)

### Kółko status (recipient)
- Rozmiar: 180x180px
- Pending: transparent + teal border (opacity 0.4), pulsing scale
- OK: safeLight fill + teal border 3px + checkmark

### Week Dots
- Rozmiar: 12px
- OK: teal fill
- Missing: border-only (#E0DAD3, 2px)
- Today (pending): gold fill, pulse animation
- Today (done): teal fill + gold border

### Input
- Background: `surface` (#F0EBE5)
- BorderRadius: 16px
- Height: 56px
- Focus: teal border 2px
- Placeholder: `textSoft`

### Receipt Pill
- Background: `safeLight`
- Text: `safeStrong`, 13px, fontFamily medium
- BorderRadius: 20px
- Padding: 8px 16px

### Reaction Buttons (recipient)
- 4 buttony: ♥ Kocham, • Dobranoc, ✓ OK!, ★ Super!
- Rozmiar: 64x64px, borderRadius 16px
- Background: white + border
- Symbol: kolorowy (love/delight/safe/highlight)
- Label: 9px muted pod symbolem

### Status Mood Chips (signaler)
- 5 chipów: Dobrze, Spokojnie, Zmęczona, Na spacerze, U lekarza
- Background: surface, borderRadius 12px
- Symbol: kolorowy, 16px
- Label: 9px muted

## Spacing
- Screen padding: 24-28px horizontal
- Section gap: 24px minimum
- Card padding: 16-20px
- Between related elements: 8px
- Between sections: 24px

## Animacje
- Breathing: scale 1.0→1.03, 2.5s ease-in-out loop
- Button press: scale down 0.88 (120ms) → spring back (tension 120, friction 6)
- Copy slide-up: translateY 12px → 0, 300ms, delay 400ms
- Celebration particles: 14 particles, 1000ms, gravity pull
- StatusCircle bounce: scale 0.9 → spring 1.0 on sign arrival
- Warm toast: fade in 300ms, hold 2.5s, fade out 500ms

## Ikona aplikacji
- Tło: cream (#FFF8F2) rounded square
- Brand motif: coral dot + line + teal dot (centered upper half)
- "cmok" wordmark w terracotta (centered lower half)
- 1024x1024px

## Push notifications
- Kanały: `default` (codzienne), `urgent` (pilne sygnały)
- Tytuł: zawsze "cmok"
- Body: streak-aware, personalny (imię z relacji)
- Priorytet: normal (daily), high (urgent)

## Copy rules
- Lowercase "cmok" wszędzie
- Bez myślników (—) w UI — używaj przecinków
- Bez emoji w Text z custom fontFamily (broken na iOS)
- Polskie znaki: ą, ę, ć, ś, ź, ż, ó, ł, ń — zawsze poprawne
- "bliska osoba" nie "użytkownik"
- "daj znak" nie "check in"
- "krąg bliskich" nie "circle" czy "network"

## Architektura
- Frontend: React Native + Expo (iOS + Android)
- Backend: Supabase (PostgreSQL + Auth + Edge Functions + Realtime)
- Push: Expo Push Notifications
- Auth: SMS OTP (Supabase Auth, legacy JWT anon key)
- RLS: enabled na wszystkich 8 tabelach
- Edge functions: 12 (checkin-notify, urgent-signal, nudge-signal, morning-reminder, weekly-summary, missed-sign-alert, delete-account, register-device, checkin-monitor, reaction-notify, poke-notify, reset-test-data)

## URL-e
- App Store: https://apps.apple.com/pl/app/cmok/id6762090888
- Landing page: https://cmok-web.vercel.app (docelowo cmok.app)
- Universal download: /pobierz (redirect by user-agent)
- Polityka prywatności: /polityka-prywatnosci
- Regulamin: /regulamin
- Deep link: cmok://join/{code}

## Numery testowe
- +48 100 000 001 (signaler, "Mama") — kod SMS: 123456
- +48 100 000 002 (recipient, "Darek") — kod SMS: 123456
- +48 100 000 003 (trusted contact, "Sąsiad") — kod SMS: 123456
- Invite code: tworzy recipient w SetupScreen
- Sąsiad: dodawany przez Mamę lub Darka do kręgu bliskich via TrustedContacts

## Reset danych testowych
Edge function `reset-test-data` (no JWT required):

```bash
# Wyczyść dane, zostaw konta + relację (do testowania home screens):
curl -X POST https://pckpxspcecbvjprxmdja.supabase.co/functions/v1/reset-test-data \
  -H "Content-Type: application/json" \
  -d '{"mode": "keep_pair"}'

# Full reset — usuń wszystko, testuj onboarding od zera:
curl -X POST https://pckpxspcecbvjprxmdja.supabase.co/functions/v1/reset-test-data \
  -H "Content-Type: application/json" \
  -d '{"mode": "full_reset"}'
```

Po `keep_pair`: zaloguj się na obu telefonach, app pokaże home screen (czyste dane, relacja aktywna).
Po `full_reset`: oba konta usunięte, zaloguj się → onboarding od zera.
