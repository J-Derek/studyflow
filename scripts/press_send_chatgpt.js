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
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }
        })()`
      });

      // Send a keydown for Space, then Backspace to trigger ProseMirror transaction
      await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ' ', key: ' ', code: 'Space' });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', text: ' ', key: ' ', code: 'Space' });
      await new Promise(r => setTimeout(r, 200));

      // Check form buttons
      const btnCheck = await send('Runtime.evaluate', {
        expression: `(() => {
          const form = document.querySelector('form');
          const btns = form ? Array.from(form.querySelectorAll('button')) : [];
          return btns.map(b => ({
            aria: b.getAttribute('aria-label'),
            dataTestId: b.getAttribute('data-testid'),
            classes: b.className
          }));
        })()`,
        returnByValue: true
      });
      console.log('Buttons after key press:', btnCheck.result.value);

      // Now click the send button or press Enter
      const submit = await send('Runtime.evaluate', {
        expression: `(() => {
          const form = document.querySelector('form');
          const sendBtn = form ? Array.from(form.querySelectorAll('button')).find(b => 
            b.getAttribute('data-testid')?.includes('send') || 
            b.getAttribute('aria-label')?.toLowerCase().includes('send')
          ) : null;
          
          if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
            return { clicked: true, aria: sendBtn.getAttribute('aria-label') };
          }
          return { clicked: false };
        })()`,
        returnByValue: true
      });
      console.log('Submit result:', submit.result.value);

      if (!submit.result.value.clicked) {
        console.log('Pressing Enter with modifiers...');
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
      }

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
