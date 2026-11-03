// Node.js script to inspect and message Claude tab
const targetTabId = '2FB10A8721090994FBC5AF9B684B24C2';
const action = process.argv[2] || 'read';

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
      if (action === 'read') {
        const res = await send('Runtime.evaluate', {
          expression: `(() => {
            const claudeMsgs = Array.from(document.querySelectorAll('.font-claude-message, [data-testid="user-message"], div.grid-cols-1'));
            if (claudeMsgs.length > 0) {
              return claudeMsgs.slice(-2).map(m => m.innerText).join('\\n\\n=== MESSAGE BREAK ===\\n\\n');
            }
            return document.body.innerText.slice(-2500);
          })()`,
          returnByValue: true
        });
        console.log(res.result.value);
      } else if (action === 'buttons') {
        const res = await send('Runtime.evaluate', {
          expression: `JSON.stringify(Array.from(document.querySelectorAll('button, div[contenteditable="true"]')).map(el => ({
            tag: el.tagName,
            label: el.getAttribute('aria-label'),
            text: el.innerText.trim().slice(0, 30),
            disabled: el.disabled || el.getAttribute('aria-disabled'),
            className: el.className.slice(0, 50)
          })).filter(x => x.label || x.text || x.tag === 'DIV'), null, 2)`,
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
