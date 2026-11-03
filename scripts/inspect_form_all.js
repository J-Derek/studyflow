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
          const form = document.querySelector('form');
          if (!form) return [];
          const all = Array.from(form.querySelectorAll('*'));
          const interactives = all.filter(el => 
            el.tagName === 'BUTTON' || 
            el.getAttribute('role') === 'button' ||
            el.onclick != null ||
            el.getAttribute('aria-label') ||
            el.getAttribute('data-testid')
          );
          return interactives.map(el => ({
            tag: el.tagName,
            aria: el.getAttribute('aria-label'),
            testid: el.getAttribute('data-testid'),
            text: el.innerText.trim(),
            rect: el.getBoundingClientRect()
          }));
        })()`,
        returnByValue: true
      });
      console.log('Interactives in form:', JSON.stringify(res.result.value, null, 2));
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
