// Lọc từ ngữ thô tục trong lời nguyện: thay bằng dấu *. Danh sách mở rộng qua PROFANITY_EXTRA.

/** So khớp có dấu (tránh nhầm: "cặc" ≠ "các", "lồn" ≠ "lon", "đéo" ≠ "đeo"). */
const EXACT = ['cặc', 'lồn', 'địt', 'đụ', 'đéo', 'đĩ', 'buồi', 'dái', 'cứt', 'đù', 'đờ mờ'];

/** So khớp sau khi bỏ dấu và gộp chữ lặp: viết tắt, không dấu, tiếng Anh. */
const ASCII = [
  'dm',
  'dmm',
  'dcm',
  'dcmm',
  'vcl',
  'vkl',
  'vl',
  'cc',
  'clm',
  'cmm',
  'cl',
  'dkm',
  'dit',
  'djt',
  'du ma',
  'dit me',
  'dit con me',
  'con di',
  'oc cho',
  'fuck',
  'fck',
  'fuk',
  'shit',
  'bitch',
  'cunt',
  'dick',
  'pussy',
  'asshole',
  'motherfucker',
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '@': 'a', $: 's' };

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

const asciiForm = (word: string) =>
  stripAccents(word.toLowerCase())
    .replace(/[0134@$]/g, (c) => LEET[c]!)
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1+/g, '$1');

export function createProfanityFilter(extra: string[] = []) {
  const exact = EXACT.map((w) => w.normalize('NFC').split(' '));
  const ascii = [...ASCII, ...extra].map((w) => w.split(' ').map(asciiForm));
  const maxLen = Math.max(...exact.map((p) => p.length), ...ascii.map((p) => p.length));

  return function filter(text: string): { text: string; flagged: boolean } {
    // Tách thành [chữ, khoảng trắng, chữ, ...] để thay đúng vị trí và giữ nguyên định dạng.
    const parts = text.normalize('NFC').split(/(\s+)/);
    const words = parts.map((p, i) => (i % 2 === 0 ? p : null));
    const idx = words.flatMap((w, i) => (w ? [i] : []));
    const lower = idx.map((i) => words[i]!.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''));
    const asc = idx.map((i) => asciiForm(words[i]!));
    const hit = new Set<number>();

    for (let start = 0; start < idx.length; start++) {
      for (let len = 1; len <= maxLen && start + len <= idx.length; len++) {
        const ex = lower.slice(start, start + len);
        const as = asc.slice(start, start + len);
        const match =
          exact.some((p) => p.length === len && p.every((w, k) => w === ex[k])) ||
          ascii.some((p) => p.length === len && p.every((w, k) => w === as[k]));
        if (match) for (let k = 0; k < len; k++) hit.add(idx[start + k]!);
      }
    }
    if (hit.size === 0) return { text, flagged: false };
    for (const i of hit) parts[i] = '*'.repeat([...parts[i]!].length);
    return { text: parts.join(''), flagged: true };
  };
}

export type ProfanityFilter = ReturnType<typeof createProfanityFilter>;
