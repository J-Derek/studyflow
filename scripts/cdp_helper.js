// Node.js script for CDP automation
const targetTabId = process.argv[2] || 'DC5057A11BA7FAFEA0BB4043A7004DD5';
const action = process.argv[3] || 'info';
const extraArg = process.argv[4] || '';

async function main() {
  const ws = new WebSocket(`ws://127.0.0.1:9223/devtools/page/${targetTabId}`);
  
  let msgId = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = msgId++;
    const handler = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === id) {
        ws.removeEventListener('message', handler);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  ws.onopen = async () => {
    try {
      if (action === 'info') {
        const res = await send('Runtime.evaluate', {
          expression: `JSON.stringify({
            title: document.title,
            url: location.href,
            textSnippet: document.body.innerText.slice(-1500)
          }, null, 2)`,
          returnByValue: true
        });
        console.log(res.result.value);
      } else if (action === 'read_chatgpt') {
        const res = await send('Runtime.evaluate', {
          expression: `(() => {
            const articles = Array.from(document.querySelectorAll('article'));
            if (articles.length > 0) {
              return articles.slice(-2).map(a => a.innerText).join('\\n\\n=== ARTICLE BREAK ===\\n\\n');
            }
            const turns = Array.from(document.querySelectorAll('[data-message-author-role]'));
            if (turns.length > 0) {
              return turns.slice(-2).map(t => t.getAttribute('data-message-author-role') + ':\\n' + t.innerText).join('\\n\\n=== TURN BREAK ===\\n\\n');
            }
            return document.body.innerText.slice(-2000);
          })()`,
          returnByValue: true
        });
        console.log(res.result.value);
      } else if (action === 'read_claude') {
        const res = await send('Runtime.evaluate', {
          expression: `(() => {
            const msgs = Array.from(document.querySelectorAll('.font-claude-message, [data-testid="user-message"]'));
            if (msgs.length > 0) {
              return msgs.slice(-2).map(m => m.innerText).join('\\n\\n=== CLAUDE BREAK ===\\n\\n');
            }
            return document.body.innerText.slice(-2000);
          })()`,
          returnByValue: true
        });
        console.log(res.result.value);
      } else if (action === 'buttons') {
        const res = await send('Runtime.evaluate', {
          expression: `JSON.stringify(Array.from(document.querySelectorAll('button')).map((b, i) => ({
            index: i,
            label: b.getAttribute('aria-label'),
            testid: b.getAttribute('data-testid'),
            text: b.innerText.trim(),
            disabled: b.disabled || b.getAttribute('aria-disabled')
          })).filter(b => b.label || b.testid || b.text), null, 2)`,
          returnByValue: true
        });
        console.log(res.result.value);
      }
      ws.close();
      process.exit(0);
    } catch (e) {
      console.error(e);
      ws.close();
      process.exit(1);
    }
  };
}

main();
