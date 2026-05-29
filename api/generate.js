export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { extracted, tone, sns, notes } = req.body;
    if (!extracted) return res.status(400).json({ error: '物件情報が必要です' });

    const summary = Object.entries(extracted)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    const prompt = `あなたは不動産専門家でSNSマーケターです。
以下の物件情報をもとに、SNS投稿用の紹介文を日本語・中国語（簡体字）・英語の3言語で作成してください。

【物件情報】
${summary}${notes ? '\n\n【追加セールスポイント】\n' + notes : ''}

【条件】
- ターゲット: ${tone || 'プロフェッショナル'}
- 投稿先: ${sns || 'Instagram'}
- 各言語200〜350文字程度
- ハッシュタグ3〜5個を含める
- 絵文字を効果的に使用（3〜5個）
- 価格・立地・特徴を魅力的に訴求
- 問い合わせを促すCTAを入れる

JSON形式のみで返してください（コードブロック不要）:
{"ja":"日本語テキスト","zh":"中文テキスト","en":"English text"}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `Anthropic API Error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content.find(b => b.type === 'text')?.text || '';
    const cleaned = text.replace(/```[\w]*\n?|```/g, '').trim();
    const posts = JSON.parse(cleaned);

    return res.status(200).json({ success: true, posts });

  } catch (e) {
    console.error('generate error:', e);
    return res.status(500).json({ error: e.message });
  }
}
