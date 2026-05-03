const Parser = require('rss-parser');
const fetch = require('node-fetch');
const fs = require('fs');

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const RSS_URLS = process.env.RSS_URLS.split(',');

const parser = new Parser();

(async () => {
  console.log("🚀 Iniciando script...");

  let sentLinks = [];

  if (fs.existsSync('sent.json')) {
    sentLinks = JSON.parse(fs.readFileSync('sent.json'));
    console.log("📁 Histórico carregado:", sentLinks.length);
  } else {
    console.log("📁 Nenhum histórico encontrado");
  }

  let allItems = [];

  for (const url of RSS_URLS) {
    try {
      console.log(`🔎 Lendo feed: ${url}`);

      const feed = await parser.parseURL(url.trim());

      console.log(`✅ Feed carregado: ${feed.title}`);
      console.log(`📊 Itens encontrados: ${feed.items.length}`);

      const items = feed.items.map(item => {
        const date = new Date(item.pubDate || Date.now());

        return {
          title: item.title || "Sem título",
          link: item.link,
          date: date,
          isoDate: date.toISOString(),
          source: item.link ? new URL(item.link).hostname : "desconhecido",
          description: item.contentSnippet || item.content || ''
        };
      });

      allItems = allItems.concat(items);

    } catch (err) {
      console.log(`❌ Erro no feed: ${url}`);
      console.log(err.message);
    }
  }

  console.log("📦 Total de itens coletados:", allItems.length);

  // ordenar por mais recente
  allItems.sort((a, b) => b.date - a.date);

  // DEBUG: mostrar primeiros itens
  console.log("🆕 Top 5 itens:");
  allItems.slice(0, 5).forEach((item, i) => {
    console.log(`${i + 1}. ${item.title}`);
  });

  // FORÇAR ENVIO (DEBUG MODE)
  const newItems = allItems.slice(0, 3);

  console.log("📤 Itens que serão enviados:", newItems.length);

  for (const item of newItems.reverse()) {
    try {
      console.log("📨 Enviando:", item.title);

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: item.title,
              url: item.link,
              description: item.description.substring(0, 200) || "Nova notícia 🚀",
              color: 5814783,
              footer: {
                text: `🌐 ${item.source}`
              },
              timestamp: item.isoDate
            }
          ]
        })
      });

      console.log("📡 Status do webhook:", response.status);

      if (!response.ok) {
        const text = await response.text();
        console.log("❌ Erro resposta webhook:", text);
      }

    } catch (err) {
      console.log("❌ Erro ao enviar:", err.message);
    }

    sentLinks.push(item.link);
  }

  // salva histórico
  sentLinks = sentLinks.slice(-100);

  fs.writeFileSync('sent.json', JSON.stringify(sentLinks, null, 2));

  console.log("💾 Histórico atualizado:", sentLinks.length);
  console.log("✅ Finalizado");
})();
