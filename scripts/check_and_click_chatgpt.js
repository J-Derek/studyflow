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
          const btns = form ? Array.from(form.querySelectorAll('button')) : [];
          return btns.map(b => ({
            aria: b.getAttribute('aria-label'),
            testid: b.getAttribute('data-testid'),
            disabled: b.disabled,
            text: b.innerText.trim(),
            svg: b.querySelector('svg')?.outerHTML.slice(0, 100)
          }));
        })()`,
        returnByValue: true
      });
      console.log('Composer buttons:', res.result.value);

      // Let's click the send button if present
      const clickRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const form = document.querySelector('form');
          const sendBtn = form?.querySelector('button[data-testid="send-button"]') ||
                          form?.querySelector('button[aria-label="Send prompt"]') ||
                          form?.querySelector('button[aria-label="Send"]');
          if (sendBtn) {
            sendBtn.click();
            return { clicked: true, disabled: sendBtn.disabled, aria: sendBtn.getAttribute('aria-label') };
          }
          return { clicked: false };
        })()`,
        returnByValue: true
      });
      console.log('Click result:', clickRes.result.value);

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
