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
      const expandRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const restoreBtn = document.querySelector('button[aria-label*="Restore floating chat"]') ||
                             document.querySelector('button[aria-label="Expand floating chat"]');
          if (restoreBtn) {
            restoreBtn.click();
            return { clicked: true, label: restoreBtn.getAttribute('aria-label') };
          }
          return { clicked: false };
        })()`,
        returnByValue: true
      });
      console.log('Expand result:', expandRes.result.value);

      await new Promise(r => setTimeout(r, 1000));

      const sendRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const sendBtn = Array.from(document.querySelectorAll('button')).find(b => 
            b.getAttribute('data-testid') === 'send-button' || 
            b.getAttribute('aria-label') === 'Send prompt' ||
            b.getAttribute('aria-label') === 'Send'
          );
          if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
            return { sent: true };
          }
          return { sent: false };
        })()`,
        returnByValue: true
      });
      console.log('Send result:', sendRes.result.value);

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
