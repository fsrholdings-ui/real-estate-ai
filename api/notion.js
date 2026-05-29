export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { extracted, posts, notes } = req.body;

    const DATABASE_ID = process.env.NOTION_DATABASE_ID;
    const NOTION_TOKEN = process.env.NOTION_TOKEN;

    if (!DATABASE_ID || !NOTION_TOKEN) {
      throw new Error('Notion の環境変数が設定されていません（NOTION_TOKEN, NOTION_DATABASE_ID）');
    }

    // 価格を数値に変換（例: "8,500万円" → 85000000）
    function parsePrice(str) {
      if (!str) return null;
      const s = str.replace(/,|円|¥|￥|\s/g, '');
      const m = s.match(/([\d.]+)億/);
      const n = s.match(/([\d.]+)万/);
      if (m) return Math.round(parseFloat(m[1]) * 100000000);
      if (n) return Math.round(parseFloat(n[1]) * 10000);
      const plain = parseInt(s);
      return isNaN(plain) ? null : plain;
    }

    // 駅徒歩分を数値に
    function parseMin(str) {
      if (!str) return null;
      const m = str.match(/(\d+)/);
      return m ? parseInt(m[1]) : null;
    }

    const price  = parsePrice(extracted['価格']);
    const mgmt   = parsePrice(extracted['管理費']);
    const walkMin = parseMin(extracted['駅徒歩分']);

    // Notion page properties
    const properties = {
      '物件名': { title: [{ text: { content: extracted['物件名'] || '（物件名なし）' } }] },
      'ステータス': { select: { name: '売出し中' } },
      '住所': { rich_text: [{ text: { content: extracted['所在地'] || '' } }] },
      '間取り': { select: { name: extracted['間取り'] || 'その他' } },
      '築年数': { rich_text: [{ text: { content: extracted['築年数'] || '' } }] },
      '最寄り駅': { rich_text: [{ text: { content: extracted['最寄り駅'] || '' } }] },
      '向き': { select: { name: extracted['向き'] || '南' } },
      '特徴メモ': { rich_text: [{ text: { content: (extracted['その他特徴'] || '') + (notes ? '\n' + notes : '') } }] },
      '紹介文_日本語': { rich_text: [{ text: { content: posts?.ja || '' } }] },
      '紹介文_中国語': { rich_text: [{ text: { content: posts?.zh || '' } }] },
      '紹介文_英語':   { rich_text: [{ text: { content: posts?.en || '' } }] },
    };

    // エリア（select）
    if (extracted['エリア']) {
      properties['エリア'] = { select: { name: extracted['エリア'] } };
    }
    // 価格（number）
    if (price !== null) properties['価格'] = { number: price };
    // 管理費（number）
    if (mgmt !== null) properties['管理費月額'] = { number: mgmt };
    // 面積（number）
    const areaNum = parseFloat((extracted['面積'] || '').replace(/[^\d.]/g, ''));
    if (!isNaN(areaNum)) properties['面積㎡'] = { number: areaNum };
    // 駅徒歩分（number）
    if (walkMin !== null) properties['駅徒歩分'] = { number: walkMin };

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: DATABASE_ID },
        properties
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || `Notion API Error: ${response.status}`);
    }

    const page = await response.json();
    return res.status(200).json({ success: true, pageId: page.id, url: page.url });

  } catch (e) {
    console.error('notion error:', e);
    return res.status(500).json({ error: e.message });
  }
}
