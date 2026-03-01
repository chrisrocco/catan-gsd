import { describe, it, expect } from 'vitest';
import { generateRoomCode } from './roomCode.js';

describe('generateRoomCode', () => {
  it('returns a 4-letter uppercase string matching /^[A-Z]{4}$/', () => {
    const code = generateRoomCode(new Set());
    expect(code).toMatch(/^[A-Z]{4}$/);
  });

  it('returns different codes on multiple calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(generateRoomCode(new Set()));
    }
    // With random CVCV generation we expect at least a few unique codes in 20 attempts
    expect(codes.size).toBeGreaterThan(1);
  });

  it('does not return a code already in existingCodes', () => {
    // Collect many codes and verify none appear in the excluded set
    const existing = new Set<string>();
    // Generate a bunch of valid codes to populate existing set
    for (let i = 0; i < 5; i++) {
      existing.add(generateRoomCode(new Set()));
    }
    // Generate more codes that should not be in existing
    const generated: string[] = [];
    for (let i = 0; i < 50; i++) {
      generated.push(generateRoomCode(existing));
    }
    for (const code of generated) {
      expect(existing.has(code)).toBe(false);
    }
  });

  it('throws if maxAttempts exceeded', () => {
    // Create a huge set of all possible CVCV codes so no code can be generated
    // CVCV: 19 consonants * 5 vowels * 19 consonants * 5 vowels = 9025 combinations
    // We can't enumerate all but can pass an impossibly large existing set via mock
    // Instead test by passing maxAttempts=0
    expect(() => generateRoomCode(new Set(), 0)).toThrow();
  });

  it('follows CVCV pattern (consonant-vowel-consonant-vowel)', () => {
    const vowels = new Set(['A', 'E', 'I', 'O', 'U']);
    for (let i = 0; i < 20; i++) {
      const code = generateRoomCode(new Set());
      expect(vowels.has(code[1]!)).toBe(true);  // index 1 = vowel
      expect(vowels.has(code[3]!)).toBe(true);  // index 3 = vowel
      expect(vowels.has(code[0]!)).toBe(false); // index 0 = consonant
      expect(vowels.has(code[2]!)).toBe(false); // index 2 = consonant
    }
  });
});
