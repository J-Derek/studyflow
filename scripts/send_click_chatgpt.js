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
      const inspect = await send('Runtime.evaluate', {
        expression: `(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const bottomBtns = btns.filter(b => {
            const rect = b.getBoundingClientRect();
            return rect.bottom > window.innerHeight - 200;
          });
          return bottomBtns.map(b => ({
            id: b.id,
            ariaLabel: b.getAttribute('aria-label'),
            dataTestId: b.getAttribute('data-testid'),
            disabled: b.disabled,
            classes: b.className
          }));
        })()`,
        returnByValue: true
      });
      console.log('Bottom buttons:', inspect.result.value);

      // Try clicking the send button or pressing Enter
      const clickRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = document.querySelector('button[data-testid="send-button"]') ||
                      document.querySelector('button[aria-label="Send prompt"]') ||
                      document.querySelector('button[aria-label="Send"]') ||
                      document.querySelector('button[aria-label="Send message"]') ||
                      Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label')?.toLowerCase().includes('send'));
          if (btn && !btn.disabled) {
            btn.click();
            return { clicked: true, aria: btn.getAttribute('aria-label') };
          }
          return { clicked: false };
        })()`,
        returnByValue: true
      });
      console.log('Click result:', clickRes.result.value);

      // If not clicked, trigger Enter keydown
      if (!clickRes.result.value.clicked) {
        console.log('Dispatching Enter key to editor...');
        await send('Runtime.evaluate', {
          expression: `(() => {
            const editor = document.querySelector('div.ProseMirror') || document.querySelector('#prompt-textarea');
            if (editor) {
              editor.focus();
              const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
              });
              editor.dispatchEvent(enterEvent);
              return { enterSent: true };
            }
            return { enterSent: false };
          })()`,
          returnByValue: true
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
