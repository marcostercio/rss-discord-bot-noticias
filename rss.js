const Parser = require('rss-parser');
const fetch = require('node-fetch');
const fs = require('fs');

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const RSS_URLS = process.env.RSS_URLS.split(',');

const parser = new Parser();

(async () => {
  let sentLinks = [];

  if (fs.existsSync('sent.json')) {
    sentLinks = JSON.parse(fs.readFileSync('sent.json'));
  }

  let allItems = [];

  for (const url of RSS_URLS) {
    try {
      const feed = await parser.parseURL(url.trim());

      const items = feed.items.map(item => {
        const date = new Date(item.pubDate || Date.now());

        return {
          title: item.title,
          link: item.link,
          date: date,
          isoDate: date.toISOString(),
          source: new URL(item.link).hostname,
          description: item.contentSnippet || item.content || ''
        };
      });

      allItems = allItems.concat(items);
    } catch (err) {
      console.log(`Erro no feed: ${url}`, err.message);
    }
  }

  // ordenar por mais recente
  allItems.sort((a, b) => b.date - a.date);

  // pegar só novos (máx 5 por execução)
  const newItems = allItems
    .filter(item => !sentLinks.includes(item.link))
    .slice(0, 5);

  for (const item of newItems.reverse()) {
    await fetch(WEBHOOK_URL, {
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

    sentLinks.push(item.link);
  }

  // mantém histórico leve
  sentLinks = sentLinks.slice(-100);

  fs.writeFileSync('sent.json', JSON.stringify(sentLinks, null, 2));
})();
