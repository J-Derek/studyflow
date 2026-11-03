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
          const form = document.querySelector('form');
          const editor = document.querySelector('div.ProseMirror') || document.querySelector('#prompt-textarea');
          const formButtons = form ? Array.from(form.querySelectorAll('button')) : [];
          
          return {
            hasForm: !!form,
            editorTextLength: editor ? editor.innerText.length : 0,
            buttons: formButtons.map(b => ({
              aria: b.getAttribute('aria-label'),
              testid: b.getAttribute('data-testid'),
              disabled: b.disabled,
              text: b.innerText,
              html: b.outerHTML.slice(0, 100)
            }))
          };
        })()`,
        returnByValue: true
      });
      console.log('Result:', JSON.stringify(res.result.value, null, 2));

      // Attempt to submit via form or button
      const submitRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const form = document.querySelector('form');
          // In new ChatGPT UI, the send button is the last button in the composer form
          const formButtons = form ? Array.from(form.querySelectorAll('button')) : [];
          const sendBtn = formButtons.find(b => 
            b.getAttribute('data-testid')?.includes('send') || 
            b.getAttribute('aria-label')?.toLowerCase().includes('send') ||
            b.querySelector('svg path[d*="M15.192"]') // standard send arrow SVG
          ) || formButtons[formButtons.length - 1];

          if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
            return { clicked: true, aria: sendBtn.getAttribute('aria-label'), testid: sendBtn.getAttribute('data-testid') };
          }
          
          // Fallback: Dispatch Enter key
          const editor = document.querySelector('div.ProseMirror');
          if (editor) {
            editor.focus();
            const ke = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            });
            editor.dispatchEvent(ke);
            return { dispatchedEnter: true };
          }

          return { clicked: false };
        })()`,
        returnByValue: true
      });
      console.log('Submit attempt:', submitRes.result.value);
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
