export function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^\d]/g, "");

  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return `254${cleaned.substring(1)}`;
  }
  if (cleaned.startsWith("1") && cleaned.length === 10) {
    return `254${cleaned}`;
  }
  if (cleaned.startsWith("254") && cleaned.length === 12) {
    return cleaned;
  }

  throw new Error("Invalid phone number format");
}
