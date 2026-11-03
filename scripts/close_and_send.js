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
      // 1. Close dialog
      const closeRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Close') || b.getAttribute('aria-label')?.includes('Close'));
          if (btn) {
            btn.click();
            return { closed: true };
          }
          return { closed: false };
        })()`,
        returnByValue: true
      });
      console.log('Close dialog:', closeRes.result.value);

      await new Promise(r => setTimeout(r, 1000));

      // 2. Click Send button in composer
      const sendRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const form = document.querySelector('form');
          const sendBtn = form ? Array.from(form.querySelectorAll('button')).find(b => 
            b.getAttribute('data-testid') === 'send-button' || 
            b.getAttribute('aria-label') === 'Send prompt' ||
            b.getAttribute('aria-label') === 'Send'
          ) : Array.from(document.querySelectorAll('button')).find(b => 
            b.getAttribute('data-testid') === 'send-button' || 
            b.getAttribute('aria-label') === 'Send prompt' ||
            b.getAttribute('aria-label') === 'Send'
          );

          if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
            return { sent: true, aria: sendBtn.getAttribute('aria-label') };
          }
          return { sent: false };
        })()`,
        returnByValue: true
      });
      console.log('Send attempt:', sendRes.result.value);

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
