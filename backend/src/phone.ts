// Normalises user input to E.164 ("+919876543210") so the same person can't end up as two accounts just because they typed spaces or omitted the country code.

export function normalizePhone(raw:string, defaultCountryCode:string): string | null {
    // clean the phone number which is a text 
    const cleaned = raw.trim().replace(/[\s().-]/g, '');
    // Check it is a digit
    if (!/^\+?\d+$/.test(cleaned)) return null;

    // Declare a variable named e164 that will hold TEXT
    let e164: string;
    if (cleaned.startsWith('+')) {
        e164 = `+${defaultCountryCode}${cleaned}`;
    }
    else {
        e164 = `+${cleaned}`;
    }

    // Final check if E.164 contain '+' then 8-15 digits, first digit non-zero
    return (/^\+[1-9]\d{7,14}$/.test(e164)) ? e164 : null;
}
