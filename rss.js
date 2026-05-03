const Parser = require('rss-parser');
const fetch = require('node-fetch');
const fs = require('fs');

const parser = new Parser();

// 🔥 CONFIGURAÇÃO (Gran Cursos separado)
const FEEDS = [
  {
    url: "https://tecnoblog.net/feed/",
    webhook: process.env.WEBHOOK_1
  },
  {
    url: "https://www.metropoles.com/feed",
    webhook: process.env.WEBHOOK_1
  },
  {
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCI1FHmMbh27WuxHjGXyn2ww",
    webhook: process.env.WEBHOOK_1
  },
  {
    url: "https://blog.grancursosonline.com.br/feed/",
    webhook: process.env.WEBHOOK_2
  }
];

(async () => {
  console.log("🚀 Iniciando bot RSS...\n");

  let sentLinks = [];

  // 📂 carregar histórico
  if (fs.existsSync('sent.json')) {
    sentLinks = JSON.parse(fs.readFileSync('sent.json'));
    console.log(`📁 Histórico carregado: ${sentLinks.length} itens\n`);
  } else {
    console.log("📁 Nenhum histórico encontrado\n");
  }

  for (const feedConfig of FEEDS) {
    const { url, webhook } = feedConfig;

    console.log("====================================");
    console.log(`🔎 FEED: ${url}`);

    if (!webhook) {
      console.log("❌ Webhook não configurado\n");
      continue;
    }

    try {
      const feed = await parser.parseURL(url);

      console.log(`📊 Itens encontrados: ${feed.items.length}`);

      const items = feed.items
        .map(item => {
          const date = new Date(item.pubDate || item.isoDate || Date.now());

          return {
            title: item.title || "Sem título",
            link: item.link,
            date,
            isoDate: date.toISOString(),
            source: item.link ? new URL(item.link).hostname : "desconhecido",
            description: item.contentSnippet || item.content || '',
            content: item.content || '',
            enclosure: item.enclosure || null
          };
        })
        .sort((a, b) => b.date - a.date);

      const newItems = items
        .filter(item => item.link && !sentLinks.includes(item.link))
        .slice(0, 3);

      console.log(`🆕 Novos itens: ${newItems.length}`);

      if (newItems.length === 0) {
        console.log("⚠️ Nada novo\n");
        continue;
      }

      for (const item of newItems.reverse()) {
        console.log(`📨 Enviando: ${item.title}`);

        let image = null;

        // 1. enclosure
        if (item.enclosure && item.enclosure.url) {
          image = item.enclosure.url;
        }

        // 2. <img> no conteúdo
        if (!image && item.content) {
          const match = item.content.match(/<img.*?src="(.*?)"/i);
          if (match && match[1]) {
            image = match[1];
          }
        }

        // 3. YouTube thumbnail
        if (!image && item.link && item.link.includes("youtube.com")) {
          const match = item.link.match(/v=([^&]+)/);
          if (match && match[1]) {
            image = `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
          }
        }

        // 4. OG IMAGE (pegar direto do site)
        if (!image && item.link) {
          try {
            const res = await fetch(item.link, { timeout: 5000 });
            const html = await res.text();

            const ogMatch = html.match(/<meta property="og:image" content="(.*?)"/i);
            if (ogMatch && ogMatch[1]) {
              image = ogMatch[1];
            }
          } catch (e) {
            console.log("⚠️ Erro ao buscar OG image");
          }
        }

        console.log("🖼️ Imagem:", image ? "OK" : "NÃO ENCONTRADA");

        try {
          const res = await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [
                {
                  title: item.title,
                  url: item.link,
                  description: item.description.substring(0, 200),
                  color: 5814783,
                  footer: {
                    text: `🌐 ${item.source}`
                  },
                  timestamp: item.isoDate,
                  ...(image && { image: { url: image } })
                }
              ]
            })
          });

          console.log(`📡 Status: ${res.status}`);

          if (res.status === 204 || res.status === 200) {
            sentLinks.push(item.link);
          } else {
            const text = await res.text();
            console.log("❌ Erro resposta:", text);
          }

        } catch (err) {
          console.log("❌ Erro ao enviar:", err.message);
        }
      }

      console.log("");

    } catch (err) {
      console.log("❌ Erro no feed:");
      console.log(err.message + "\n");
    }
  }

  // 💾 salvar histórico
  sentLinks = sentLinks.slice(-200);
  fs.writeFileSync('sent.json', JSON.stringify(sentLinks, null, 2));

  console.log("💾 Histórico salvo");
  console.log("✅ Finalizado\n");
})();
