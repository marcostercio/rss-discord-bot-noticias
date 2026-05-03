const Parser = require('rss-parser');
const fetch = require('node-fetch');
const fs = require('fs');

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const RSS_URL = process.env.RSS_URL;

const parser = new Parser();

(async () => {
  const feed = await parser.parseURL(RSS_URL);

  let lastLink = null;

  if (fs.existsSync('last.json')) {
    lastLink = JSON.parse(fs.readFileSync('last.json')).link;
  }

  const newItems = [];

  for (const item of feed.items) {
    if (item.link === lastLink) break;
    newItems.push(item);
  }

  if (newItems.length > 0) {
    for (const item of newItems.reverse()) {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `📰 **${item.title}**\n${item.link}`
        })
      });
    }

    fs.writeFileSync('last.json', JSON.stringify({ link: newItems[0].link }));
  }
})();
