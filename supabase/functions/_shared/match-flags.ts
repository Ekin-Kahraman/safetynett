/** Demonstration keyword matching only. It does not understand negation or assess safety. */
export function matchRedFlags(response: string, flags: string[]): string[] {
  const stopWords = new Set(["the", "and", "for", "not", "has", "are", "was", "been", "with", "from", "than"]);
  const text = response.toLowerCase();
  return flags.filter(flag => flag.toLowerCase().split(/\s+/)
    .filter(word => word.length >= 3 && !stopWords.has(word))
    .some(word => text.includes(word)));
}
