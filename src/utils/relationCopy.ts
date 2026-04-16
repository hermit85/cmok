const EXACT_FORMS: Record<
  string,
  {
    nominative: string;
    genitive: string;
    dative: string;
    instrumental: string;
  }
> = {
  mama: {
    nominative: 'Mama',
    genitive: 'Mamy',
    dative: 'Mamie',
    instrumental: 'Mamą',
  },
  tata: {
    nominative: 'Tata',
    genitive: 'Taty',
    dative: 'Tacie',
    instrumental: 'Tatą',
  },
  babcia: {
    nominative: 'Babcia',
    genitive: 'Babci',
    dative: 'Babci',
    instrumental: 'Babcią',
  },
  dziadek: {
    nominative: 'Dziadek',
    genitive: 'Dziadka',
    dative: 'Dziadkowi',
    instrumental: 'Dziadkiem',
  },
};

function fallbackForms() {
  return {
    nominative: 'bliska osoba',
    genitive: 'bliskiej osoby',
    dative: 'bliskiej osobie',
    instrumental: 'bliską osobą',
    isFallback: true,
  };
}

export function getRelationForms(label?: string | null) {
  const value = label?.trim();
  if (!value) return fallbackForms();

  const lower = value.toLowerCase();
  if (EXACT_FORMS[lower]) {
    return {
      ...EXACT_FORMS[lower],
      isFallback: false,
    };
  }

  if (lower === 'bliska osoba') {
    return fallbackForms();
  }

  if (value.endsWith('a')) {
    const stem = value.slice(0, -1);
    return {
      nominative: value,
      genitive: `${stem}y`,
      dative: `${stem}ie`,
      instrumental: `${stem}ą`,
      isFallback: false,
    };
  }

  // Masculine names ending in consonant (e.g. Darek, Tomek, Paweł, Janusz)
  // -ek → stem loses 'e': Darek → Darka, Tomek → Tomka
  if (value.endsWith('ek') && value.length > 2) {
    const stem = value.slice(0, -2) + 'k';
    return {
      nominative: value,
      genitive: `${stem}a`,
      dative: `${stem}owi`,
      instrumental: `${stem}iem`,
      isFallback: false,
    };
  }

  // General masculine (add -a for genitive, -owi for dative, -em for instrumental)
  const lastChar = value.charCodeAt(value.length - 1);
  const isConsonant = lastChar >= 65 && !['a', 'e', 'i', 'o', 'u', 'y'].includes(value.charAt(value.length - 1).toLowerCase());
  if (isConsonant) {
    return {
      nominative: value,
      genitive: `${value}a`,
      dative: `${value}owi`,
      instrumental: `${value}em`,
      isFallback: false,
    };
  }

  return {
    nominative: value,
    genitive: value,
    dative: value,
    instrumental: value,
    isFallback: false,
  };
}

export function relationDisplay(label?: string | null) {
  return getRelationForms(label).nominative;
}

export function relationFrom(label?: string | null) {
  return `od ${getRelationForms(label).genitive}`;
}

export function relationFor(label?: string | null) {
  return `dla ${getRelationForms(label).genitive}`;
}

export function relationTo(label?: string | null) {
  return getRelationForms(label).dative;
}

export function relationWith(label?: string | null) {
  return `z ${getRelationForms(label).instrumental}`;
}
