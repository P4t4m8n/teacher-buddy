// Israeli phones are stored in one format, so the same phone is always the same text:
// 10 digits as xxx-xxxxxxx (mobile: 050-1234567) and 9 digits as xx-xxxxxxx (landline: 03-1234567).
// Input that is not 9 or 10 digits is returned as it is: validate it before relying on the format.
export const normalizePhone = (phone: string): string => {
  const digits: string = phone.replace(/\D/g, "");
  if (digits.length !== 9 && digits.length !== 10) return phone;

  const codeLength: number = digits.length === 10 ? 3 : 2;
  return `${digits.slice(0, codeLength)}-${digits.slice(codeLength)}`;
};
