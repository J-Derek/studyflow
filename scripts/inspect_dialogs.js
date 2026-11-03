const targetTabId = 'DC5057A11BA7FAFEA0BB4043A7004DD5';

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
          // Find all buttons inside dialogs or floating elements
          const dialogs = document.querySelectorAll('[role="dialog"], aside, [data-floating-ui-portal]');
          const found = [];
          dialogs.forEach(d => {
            const btns = Array.from(d.querySelectorAll('button')).map(b => ({
              aria: b.getAttribute('aria-label'),
              text: b.innerText.trim(),
              testid: b.getAttribute('data-testid')
            }));
            found.push({ tag: d.tagName, buttons: btns });
          });
          return found;
        })()`,
        returnByValue: true
      });
      console.log('Dialog / floating elements:', JSON.stringify(res.result.value, null, 2));
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
