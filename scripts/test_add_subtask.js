// Test adding a subtask
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
      const addRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const input = document.querySelector('input[placeholder="+ Add subtask..."]');
          if (!input) return { error: 'Input not found' };
          
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(input, 'Review Paxos vs Raft leader invariants');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          
          return { dispatched: true, value: input.value };
        })()`,
        returnByValue: true
      });
      console.log('Input result:', addRes.result.value);

      await new Promise(r => setTimeout(r, 600));

      // Click the Add button
      const clickRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Add');
          if (btn) {
            btn.click();
            return { clicked: true };
          }
          return { clicked: false };
        })()`,
        returnByValue: true
      });
      console.log('Click Add:', clickRes.result.value);

      await new Promise(r => setTimeout(r, 800));

      const verify = await send('Runtime.evaluate', {
        expression: `(() => {
          const checkboxes = document.querySelectorAll('input[type="checkbox"]');
          const hasMilestones = document.body.innerText.includes('Milestones & Subtasks');
          const taskItem = document.body.innerText.includes('Review Paxos vs Raft');
          return {
            checkboxesCount: checkboxes.length,
            hasMilestones,
            taskItem
          };
        })()`,
        returnByValue: true
      });
      console.log('Verification:', verify.result.value);

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
