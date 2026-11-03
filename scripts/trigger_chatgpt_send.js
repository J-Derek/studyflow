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
      // 1. Focus the editor
      await send('Runtime.evaluate', {
        expression: `(() => {
          const editor = document.querySelector('div.ProseMirror') || document.querySelector('#prompt-textarea');
          if (editor) editor.focus();
        })()`
      });

      // 2. Insert real input event via CDP
      await send('Input.insertText', { text: '\n' });
      await new Promise(r => setTimeout(r, 800));

      // 3. Dispatch Enter key
      await send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        windowsVirtualKeyCode: 13,
        key: 'Enter',
        code: 'Enter'
      });
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        windowsVirtualKeyCode: 13,
        key: 'Enter',
        code: 'Enter'
      });

      await new Promise(r => setTimeout(r, 1000));

      // Check if send button appeared and click it if available
      const clickResult = await send('Runtime.evaluate', {
        expression: `(() => {
          const form = document.querySelector('form');
          const buttons = form ? Array.from(form.querySelectorAll('button')) : [];
          const sendBtn = buttons.find(b => 
            b.getAttribute('data-testid')?.includes('send') || 
            b.getAttribute('aria-label')?.toLowerCase().includes('send')
          );
          if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
            return { clicked: true, label: sendBtn.getAttribute('aria-label') };
          }
          return { clicked: false, buttons: buttons.map(b => b.getAttribute('aria-label')) };
        })()`,
        returnByValue: true
      });
      console.log('Result:', clickResult.result.value);

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
