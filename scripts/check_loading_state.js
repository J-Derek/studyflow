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
      console.log('Clicking Cancel loading...');
      await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = document.querySelector('button[aria-label="Cancel loading"]');
          if (btn) {
            btn.click();
            return { clicked: true };
          }
          return { clicked: false };
        })()`
      });

      await new Promise(r => setTimeout(r, 2000));

      const after = await send('Runtime.evaluate', {
        expression: `(() => {
          const form = document.querySelector('form');
          const btns = form ? Array.from(form.querySelectorAll('button')) : [];
          return btns.map(b => ({
            aria: b.getAttribute('aria-label'),
            dataTestId: b.getAttribute('data-testid'),
            disabled: b.disabled
          }));
        })()`,
        returnByValue: true
      });
      console.log('Buttons after cancel:', after.result.value);

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
