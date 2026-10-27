// Israeli phones are stored in one format, so the same phone is always the same text: 10 digits as xxx-xxxxxxx (mobile: 050-1234567) and 9 digits as xx-xxxxxxx (landline: 03-1234567).
export const normalizePhone = (phone: string): string => {
  const digits: string = phone.replace(/\D/g, "");
  if (digits.length !== 9 && digits.length !== 10) return phone;

  const codeLength: number = digits.length === 10 ? 3 : 2;
  return `${digits.slice(0, codeLength)}-${digits.slice(codeLength)}`;
};

// What a phone search looks for.
export const getPhoneSearchTerms = (search: string): string[] => {
  if (!/^[\d\s-]+$/.test(search)) return [search];

  const digits: string = search.replace(/\D/g, "");
  const terms: string[] = [search];
  for (const codeLength of [3, 2]) {
    if (digits.length > codeLength) terms.push(`${digits.slice(0, codeLength)}-${digits.slice(codeLength)}`);
  }
  return [...new Set(terms)];
};