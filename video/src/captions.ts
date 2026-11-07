// Captions: phrases of up to seven words, shown bottom centre by Captions in ui.tsx.
// A chunk breaks only at a phrase boundary (after a comma or a clause end, or before "and" or "but"). A phrase too long
// for one chunk breaks at its most natural pause, never inside an amount ("$11.4 billion") or a name ("Haneul Beauty").
// Word times are spread over the line's spoken length by word length, since the voice gives one length per line.
const CHUNK = 7;
// A chunk reads best breaking after a comma or before one of these, and worst ending on one of the weak words.
const PAUSE_BEFORE = /^(that|which|whichever|so|to|with|inside|across|at|in|from|since|for|over|than|once|only)$/i;
const WEAK_END = /^(a|an|the|of|to|is|are|can|what|its|her|their|made|and|but|with|for|that|so|in|at|on|from|inside|over|whichever|which|it's|you)$/i;
const AMOUNT = /^\$[\d.,]*\d/;
// Two words that must stay together: an amount and its unit, or the parts of a name.
const joined = (a: string, b: string) => AMOUNT.test(a) && /^(billion|million)\b/.test(b) || /^[A-Z]/.test(a) && /^[A-Z]/.test(b) && !/[,.:;?!]$/.test(a);
function split(words: string[]): string[][] {
  if (words.length <= CHUNK) return [words];
  let best = -1, score = -Infinity;
  for (let i = 2; i <= words.length - 2; i++) {
    if (joined(words[i - 1], words[i])) continue;
    const s = (/,$/.test(words[i - 1]) ? 6 : 0) + (PAUSE_BEFORE.test(words[i]) ? 3 : 0) - (WEAK_END.test(words[i - 1]) ? 6 : 0) - 0.4 * Math.abs(words.length / 2 - i);
    if (s > score) { score = s; best = i; }
  }
  return best < 0 ? [words] : [...split(words.slice(0, best)), ...split(words.slice(best))];
}
// Phrases end at a clause end (. : ; ? !, but not a colon before an amount) and start before "and" or "but".
export function phrases(text: string) {
  const list = text.split(' '), out: string[][] = [[]];
  list.forEach((word, i) => {
    if (out[out.length - 1].length > 1 && /^(and|but)$/i.test(word)) out.push([]);
    out[out.length - 1].push(word);
    if (/[.;?!]$/.test(word) || /:$/.test(word) && !AMOUNT.test(list[i + 1] ?? '')) out.push([]);
  });
  // Short phrases share a chunk while they fit.
  return out.filter(row => row.length).flatMap(split).reduce<string[][]>((acc, part) => {
    const last = acc[acc.length - 1];
    if (last && last.length + part.length <= CHUNK && (last.length < 3 || part.length < 3)) last.push(...part); else acc.push([...part]);
    return acc;
  }, []);
}
export function chunks(text: string, start: number, end: number) {
  const list = text.split(' '), weight = list.map(word => word.length + 2), total = weight.reduce((a, b) => a + b, 0);
  let t = start, n = 0;
  const timed = list.map((word, i) => { const from = t; t += (end - start) * weight[i] / total; return { word, from, to: t }; });
  return phrases(text).map(part => { const words = timed.slice(n, n += part.length); return { words, from: words[0].from, to: words[words.length - 1].to }; });
}
