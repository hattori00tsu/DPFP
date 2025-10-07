import axios from 'axios';

export async function fetchTweetFullText(tweetId: string): Promise<string | null> {
  try {
    const { data } = await axios.get('https://cdn.syndication.twimg.com/tweet', {
      params: { id: tweetId, lang: 'ja' },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      timeout: 10000
    });
    const raw = data?.full_text || data?.text || '';
    if (!raw) return null;
    return normalizeTweetText(String(raw));
  } catch (e) {
    return null;
  }
}

export function normalizeTweetText(text: string): string {
  if (!text) return '';
  let out = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // 末尾のメディア短縮URLを削除（文中リンクは極力残す）
  out = out.replace(/https?:\/\/pic\.twitter\.com\/\S+$/gm, '');
  out = out.replace(/\s*https?:\/\/t\.co\/\S+$/gm, '');
  // 行末・連続空白整理
  out = out.replace(/[\t ]+$/gm, '');
  out = out.replace(/[\t ]{2,}/g, ' ');
  // 連続改行の詰め（最大2つ）
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}


