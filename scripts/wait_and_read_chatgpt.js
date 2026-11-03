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
      console.log('Waiting for ChatGPT response to complete...');
      for (let i = 0; i < 30; i++) {
        const check = await send('Runtime.evaluate', {
          expression: `(() => {
            const stopBtn = document.querySelector('button[aria-label="Cancel loading"]') || 
                            document.querySelector('button[aria-label="Stop generating"]');
            return { isGenerating: !!stopBtn };
          })()`,
          returnByValue: true
        });

        if (!check.result.value.isGenerating && i > 1) {
          console.log('Generation completed!');
          break;
        }
        await new Promise(r => setTimeout(r, 2000));
      }

      // Read latest response text
      const readRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const main = document.querySelector('main') || document.body;
          const text = main.innerText;
          const idx = text.lastIndexOf('SUPERVISOR SUBMISSION');
          if (idx !== -1) {
            return text.slice(idx);
          }
          return text.slice(-3000);
        })()`,
        returnByValue: true
      });

      console.log('--- CHATGPT SUPERVISOR RESPONSE ---');
      console.log(readRes.result.value);
      console.log('-----------------------------------');

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
