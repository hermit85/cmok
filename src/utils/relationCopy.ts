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
