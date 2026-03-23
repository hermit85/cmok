export const Colors = {
  primary: '#27AE60',          // zielony — check-in OK
  danger: '#E74C3C',           // czerwony — SOS
  dangerDark: '#C0392B',       // ciemniejszy czerwony — przycisk na tle SOS
  accent: '#2E86C1',           // niebieski — info
  disabled: '#BDC3C7',         // szary — nieaktywne elementy
  background: '#FFFFFF',
  screenBg: '#F5F5F5',         // lekko szare tło ekranu
  cardBg: '#FFFFFF',           // tło kart
  text: '#1A1A1A',
  textSecondary: '#555555',
  statusOkBg: '#E8F8F5',       // badge "OK" — tło
  statusOkText: '#0E6655',     // badge "OK" — tekst
  statusMissingBg: '#FDEDEC',  // badge "brak znaku" — tło
  statusMissingText: '#922B21', // badge "brak znaku" — tekst
} as const;
