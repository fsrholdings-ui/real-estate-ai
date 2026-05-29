
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileData, fileType } = req.body;
    if (!fileData || !fileType) return res.status(400).json({ error: 'fileData と fileType が必要です' });

    const isImage = fileType.startsWith('image/');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: [
            {
              type: isImage ? 'image' : 'document',
              source: { type: 'base64', media_type: fileType, data: fileData }
            },
            {
              type: 'text',
              text: `この不動産チラシから物件情報を抽出してください。
JSON形式のみで返してください（コードブロック不要）:
{"物件名":"","価格":"","所在地":"","エリア":"","間取り":"","面積":"","築年数":"","階数":"","最寄り駅":"","駅徒歩分":"","向き":"","管理費":"","修繕積立金":"","駐車場":"","取引形態":"","その他特徴":""}
情報がない項目は空文字列。数字・単位はそのまま記載してください。`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `Anthropic API Error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content.find(b => b.type === 'text')?.text || '';
    const cleaned = text.replace(/```[\w]*\n?|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json({ success: true, data: parsed });

  } catch (e) {
    console.error('analyze error:', e);
    return res.status(500).json({ error: e.message });
  }
}
