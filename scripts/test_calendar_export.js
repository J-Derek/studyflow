// Test Calendar .ICS generation
const targetTabId = '956DF0401AC3BC4CC78AB809AEE57BA0';

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
      // Navigate to Calendar
      await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('aside button, nav button')).find(b => b.innerText.includes('Schedule') || b.innerText.includes('Calendar'));
          if (btn) btn.click();
        })()`
      });

      await new Promise(r => setTimeout(r, 1000));

      const icsCheck = await send('Runtime.evaluate', {
        expression: `(() => {
          const exportBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Export .ICS'));
          return {
            hasExportBtn: !!exportBtn,
            btnText: exportBtn ? exportBtn.innerText.trim() : null
          };
        })()`,
        returnByValue: true
      });
      console.log('Calendar Export Check:', icsCheck.result.value);

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
