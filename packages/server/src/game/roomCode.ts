import BadWordsNext from 'bad-words-next';
import en from 'bad-words-next/lib/en';

const profanity = new BadWordsNext({ data: en });

const CONSONANTS = 'BCDFGHJKLMNPRSTVWXZ';
const VOWELS = 'AEIOU';

function randomChar(chars: string): string {
  const idx = Math.floor(Math.random() * chars.length);
  return chars[idx]!;
}

/**
 * Generate a unique 4-letter CVCV room code that is not in existingCodes
 * and does not match a profanity filter.
 *
 * @param existingCodes - Set of codes already in use
 * @param maxAttempts - Maximum number of generation attempts before throwing
 * @returns A 4-letter uppercase CVCV room code
 */
export function generateRoomCode(existingCodes: Set<string>, maxAttempts = 100): string {
  for (let i = 0; i < maxAttempts; i++) {
    const code =
      randomChar(CONSONANTS) +
      randomChar(VOWELS) +
      randomChar(CONSONANTS) +
      randomChar(VOWELS);

    if (existingCodes.has(code)) continue;
    if (profanity.check(code.toLowerCase())) continue;

    return code;
  }
  throw new Error(`Could not generate a unique room code after ${maxAttempts} attempts`);
}
