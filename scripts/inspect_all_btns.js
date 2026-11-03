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
      const inspect = await send('Runtime.evaluate', {
        expression: `(() => {
          const allBtns = Array.from(document.querySelectorAll('button'));
          return allBtns.map(b => ({
            text: b.innerText.trim(),
            aria: b.getAttribute('aria-label'),
            testId: b.getAttribute('data-testid'),
            disabled: b.disabled,
            className: b.className
          })).filter(b => b.aria || b.testId);
        })()`,
        returnByValue: true
      });
      console.log('All buttons with aria or testId:', JSON.stringify(inspect.result.value.slice(-15), null, 2));
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
