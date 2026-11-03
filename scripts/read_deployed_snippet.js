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
        expression: `(() => {
          const text = document.body.innerText;
          const startIdx = text.indexOf("rules_version = '2'");
          if (startIdx !== -1) {
            return text.slice(startIdx, startIdx + 1200);
          }
          return 'Not found';
        })()`,
        returnByValue: true
      });
      console.log('--- DEPLOYED FIRESTORE RULES SNIPPET ---');
      console.log(res.result.value);
      console.log('----------------------------------------');
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
