export function normalizeImageUrl(input: string): string {
  const url = input.trim();
  if (!url) return "";

  // Cloudinary ou URL direta (jpg/png/webp)
  if (
    url.includes("res.cloudinary.com") ||
    /\.(png|jpg|jpeg|webp|gif)$/i.test(url)
  ) {
    return url;
  }

  // Google Drive (converter para link direto)
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const id = m1?.[1] ?? m2?.[1];

  if (id) {
    return `https://drive.google.com/uc?export=view&id=${id}`;
  }

  // fallback: retorna o que veio
  return url;
}
