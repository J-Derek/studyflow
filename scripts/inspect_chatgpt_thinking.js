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
          // Look for thinking accordion or streaming thought text
          const thoughtHeaders = Array.from(document.querySelectorAll('div, button')).filter(el => 
            el.innerText.includes('Thought for') || el.innerText.includes('Thinking')
          );
          const prose = Array.from(document.querySelectorAll('.prose, [data-message-author-role="assistant"]'));
          const lastProse = prose[prose.length - 1];

          return {
            thoughtsFound: thoughtHeaders.length,
            thoughtHeader: thoughtHeaders[0]?.innerText.slice(0, 80),
            hasProse: !!lastProse,
            proseSnippet: lastProse ? lastProse.innerText.slice(-500) : ''
          };
        })()`,
        returnByValue: true
      });
      console.log('Thinking check:', JSON.stringify(res.result.value, null, 2));
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
