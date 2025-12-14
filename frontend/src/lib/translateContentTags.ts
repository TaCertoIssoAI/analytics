export function translateContentTags(input: string | null | undefined): string {
  if (!input) return "";

  const map: Record<string, string> = {
    IMAGE: "IMAGEM",
    VIDEO: "VÍDEO",
    AUDIO: "ÁUDIO",
    TEXT: "TEXTO",
  };

  return input.replace(/\[(IMAGE|VIDEO|AUDIO|TEXT)\]/g, (match, key: string) => {
    const replacement = map[key];
    return replacement ? `[${replacement}]` : match;
  });
}
