const Parser = require('rss-parser');
const fetch = require('node-fetch');
const fs = require('fs');

const WEBHOOK_URL = process.env.WEBHOOK_URL;

// 🔥 tratamento seguro do RSS_URLS
const RSS_URLS = (process.env.RSS_URLS || "")
  .split(',')
  .map(url => url.trim())
  .filter(url => url.length > 0);

const parser = new Parser();

(async () => {
  console.log("🚀 Iniciando script...");

  console.log("🔧 RSS_URLS RAW:", process.env.RSS_URLS);
  console.log("🔧 RSS_URLS PROCESSADO:", RSS_URLS);

  if (RSS_URLS.length === 0) {
    console.log("❌ Nenhum RSS configurado. Verifique o secret RSS_URLS.");
    return;
  }

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

      const feed = await parser.parseURL(url);

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
      console.log("Mensagem:", err.message);
    }
  }

  console.log("📦 Total de itens coletados:", allItems.length);

  if (allItems.length === 0) {
    console.log("❌ Nenhum item encontrado em nenhum feed");
    return;
  }

  // ordenar por mais recente
  allItems.sort((a, b) => b.date - a.date);

  console.log("🆕 Top 3 itens:");
  allItems.slice(0, 3).forEach((item, i) => {
    console.log(`${i + 1}. ${item.title}`);
  });

  // 🔥 modo debug (força envio)
  const newItems = allItems.slice(0, 3);

  console.log("📤 Enviando itens:", newItems.length);

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

      console.log("📡 Status webhook:", response.status);

      if (!response.ok) {
        const text = await response.text();
        console.log("❌ Erro resposta:", text);
      }

    } catch (err) {
      console.log("❌ Erro ao enviar:", err.message);
    }

    sentLinks.push(item.link);
  }

  // manter histórico leve
  sentLinks = sentLinks.slice(-100);

  fs.writeFileSync('sent.json', JSON.stringify(sentLinks, null, 2));

  console.log("💾 Histórico salvo:", sentLinks.length);
  console.log("✅ Finalizado");
})();
