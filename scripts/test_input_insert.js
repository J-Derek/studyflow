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
      console.log('Focusing editor...');
      await send('Runtime.evaluate', {
        expression: `(() => {
          const editor = document.querySelector('div.ProseMirror') || document.querySelector('#prompt-textarea');
          if (editor) {
            editor.focus();
          }
        })()`
      });

      console.log('Dispatching Input.insertText...');
      await send('Input.insertText', { text: ' ' });

      await new Promise(r => setTimeout(r, 500));

      const btns = await send('Runtime.evaluate', {
        expression: `(() => {
          const allBtns = Array.from(document.querySelectorAll('button'));
          return allBtns.map(b => b.getAttribute('aria-label')).filter(Boolean);
        })()`,
        returnByValue: true
      });
      console.log('Button aria labels:', btns.result.value.slice(-8));

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
