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
          // If "Share prompt" modal opened, close it
          const closeBtn = document.querySelector('button[aria-label="Close"]');
          if (closeBtn) closeBtn.click();

          const allBtns = Array.from(document.querySelectorAll('button'));
          const sendBtn = allBtns.find(b => 
            b.getAttribute('data-testid') === 'send-button' || 
            b.getAttribute('aria-label') === 'Send prompt' ||
            b.getAttribute('aria-label') === 'Send'
          );
          if (sendBtn) {
            sendBtn.click();
            return { clicked: true, aria: sendBtn.getAttribute('aria-label') };
          }
          return { clicked: false, allArias: allBtns.map(b => b.getAttribute('aria-label')).filter(Boolean).slice(-10) };
        })()`,
        returnByValue: true
      });
      console.log('Click result:', res.result.value);

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
