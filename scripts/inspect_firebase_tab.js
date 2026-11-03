// Inspect Firebase Console tab
const targetTabId = '6E75243B8BDA1B75CBD4E0163367E97F';

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
      const res = await send('Runtime.evaluate', {
        expression: `JSON.stringify({
          title: document.title,
          url: location.href,
          bodySnippet: document.body.innerText.slice(0, 600),
          elements: Array.from(document.querySelectorAll('.cm-content, .cm-editor, textarea, iframe')).map(e => ({
            tag: e.tagName,
            class: e.className.slice(0, 60),
            id: e.id
          }))
        }, null, 2)`,
        returnByValue: true
      });
      console.log(res.result.value);
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
