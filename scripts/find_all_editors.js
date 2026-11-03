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
      const editors = await send('Runtime.evaluate', {
        expression: `(() => {
          const els = Array.from(document.querySelectorAll('div.ProseMirror, #prompt-textarea, [contenteditable="true"]'));
          return els.map((el, i) => ({
            index: i,
            id: el.id,
            tag: el.tagName,
            classes: el.className,
            textLen: el.innerText.length,
            visible: el.offsetParent !== null,
            rect: el.getBoundingClientRect()
          }));
        })()`,
        returnByValue: true
      });
      console.log('Editors found:', JSON.stringify(editors.result.value, null, 2));
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
