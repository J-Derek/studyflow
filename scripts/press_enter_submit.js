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
      // Focus editor
      await send('Runtime.evaluate', {
        expression: `(() => {
          const editor = document.querySelector('div.ProseMirror') || document.querySelector('#prompt-textarea');
          if (editor) editor.focus();
        })()`
      });

      // Press Enter
      await send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        windowsVirtualKeyCode: 13,
        unmodifiedText: '\r',
        text: '\r',
        key: 'Enter',
        code: 'Enter'
      });
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        windowsVirtualKeyCode: 13,
        unmodifiedText: '\r',
        text: '\r',
        key: 'Enter',
        code: 'Enter'
      });

      await new Promise(r => setTimeout(r, 1500));

      const status = await send('Runtime.evaluate', {
        expression: `(() => {
          const editor = document.querySelector('div.ProseMirror') || document.querySelector('#prompt-textarea');
          return {
            editorLength: editor ? editor.innerText.length : 0,
            hasStopButton: !!document.querySelector('button[aria-label="Stop generating"]')
          };
        })()`,
        returnByValue: true
      });
      console.log('Status after Enter:', status.result.value);

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
