const MINIMUM_USER_AGE = 14;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatDateOnly = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateOnlyToUtc = (value) => {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const getMaximumBirthDate = (referenceDate = new Date()) =>
  new Date(
    referenceDate.getFullYear() - MINIMUM_USER_AGE,
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

const isAtLeastMinimumUserAge = (birthDateValue, referenceDate = new Date()) => {
  const birthDate =
    birthDateValue instanceof Date ? birthDateValue : parseDateOnlyToUtc(birthDateValue);

  if (!birthDate) {
    return false;
  }

  return birthDate.getTime() <= getMaximumBirthDate(referenceDate).getTime();
};

const getMinimumAgeValidationMessage = (referenceDate = new Date()) =>
  `El usuario debe tener al menos ${MINIMUM_USER_AGE} años. Fecha maxima permitida: ${formatDateOnly(
    getMaximumBirthDate(referenceDate)
  )}.`;

module.exports = {
  MINIMUM_USER_AGE,
  parseDateOnlyToUtc,
  isAtLeastMinimumUserAge,
  getMinimumAgeValidationMessage
};
