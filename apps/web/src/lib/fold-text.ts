/** Lower case, no accents or Hebrew and Arabic marks, one Arabic alef: for matching only. */
export const foldText = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-֑ͯ-ׇً-ٰٟ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
