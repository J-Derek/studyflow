// Inspect Assignments DOM
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
      // Click Assignments
      await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('aside button, nav button')).find(b => b.innerText.includes('Assignments') || b.innerText.includes('Tasks'));
          if (btn) btn.click();
        })()`
      });

      await new Promise(r => setTimeout(r, 1200));

      const res = await send('Runtime.evaluate', {
        expression: `(() => {
          const state = JSON.parse(localStorage.getItem('studyflow_storage_v1') || '{}');
          const assignments = state?.state?.assignments || [];
          const headings = Array.from(document.querySelectorAll('h3')).map(h => h.innerText);
          const allInputs = Array.from(document.querySelectorAll('input')).map(i => ({ type: i.type, placeholder: i.placeholder }));
          return {
            localStorageAssignmentCount: assignments.length,
            sampleSubtasks: assignments[0]?.subtasks,
            headings,
            allInputs
          };
        })()`,
        returnByValue: true
      });
      console.log(JSON.stringify(res.result.value, null, 2));

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
