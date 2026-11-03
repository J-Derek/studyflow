// Deploy rules by navigating through the Firebase console UI
import fs from 'fs';

const targetTabId = '6E75243B8BDA1B75CBD4E0163367E97F';
const rulesPath = 'C:\\Users\\Jiva\\Documents\\Freelance\\studyflow\\firestore.rules';
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

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
      // 1. Click Firestore in sidebar
      console.log('Finding and clicking Firestore in navigation...');
      await send('Runtime.evaluate', {
        expression: `(() => {
          const links = Array.from(document.querySelectorAll('a, button, [role="button"]'));
          const firestoreLink = links.find(el => el.innerText.includes('Firestore') || el.getAttribute('aria-label')?.includes('Firestore'));
          if (firestoreLink) {
            firestoreLink.click();
            return { clicked: true, text: firestoreLink.innerText };
          }
          return { clicked: false };
        })()`
      });

      await new Promise(r => setTimeout(r, 2500));

      // 2. Click Rules tab
      console.log('Finding and clicking Rules tab...');
      await send('Runtime.evaluate', {
        expression: `(() => {
          const tabs = Array.from(document.querySelectorAll('[role="tab"], a, button'));
          const rulesTab = tabs.find(t => t.innerText.trim() === 'Rules');
          if (rulesTab) {
            rulesTab.click();
            return { clicked: true };
          }
          return { clicked: false };
        })()`
      });

      // 3. Wait for CodeMirror editor
      console.log('Waiting for CodeMirror editor...');
      let editorReady = false;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const check = await send('Runtime.evaluate', {
          expression: `(() => {
            const cm = document.querySelector('.cm-content');
            return !!(cm && (cm.cmView?.view || cm.cmView || cm.parentElement?.cmView?.view));
          })()`,
          returnByValue: true
        });
        if (check.result.value) {
          editorReady = true;
          break;
        }
      }

      if (!editorReady) {
        console.error('CodeMirror editor not found');
        ws.close();
        process.exit(1);
      }

      console.log('CodeMirror detected! Injecting rules...');
      const injectRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const cm = document.querySelector('.cm-content');
          const view = cm.cmView?.view || cm.parentElement?.cmView?.view;
          if (!view) return { error: 'No cmView' };
          
          const newRules = atob(${JSON.stringify(Buffer.from(rulesContent).toString('base64'))});
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: newRules }
          });
          cm.dispatchEvent(new Event('input', { bubbles: true }));
          return { success: true, length: view.state.doc.length };
        })()`,
        returnByValue: true
      });
      console.log('Inject result:', injectRes.result.value);

      await new Promise(r => setTimeout(r, 2000));

      // 4. Click Publish
      console.log('Clicking Publish...');
      const pubRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const pubBtn = buttons.find(b => b.innerText.trim().toLowerCase() === 'publish' || b.getAttribute('aria-label') === 'Publish');
          if (pubBtn) {
            const disabled = pubBtn.disabled || pubBtn.getAttribute('aria-disabled') === 'true';
            if (!disabled) {
              pubBtn.click();
              return { clicked: true };
            }
            return { clicked: false, disabled: true };
          }
          return { clicked: false, notFound: true };
        })()`,
        returnByValue: true
      });
      console.log('Publish result:', pubRes.result.value);

      // 5. Verification
      await new Promise(r => setTimeout(r, 3500));
      const verify = await send('Runtime.evaluate', {
        expression: `(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const pubBtn = buttons.find(b => b.innerText.trim().toLowerCase() === 'publish');
          const isPublished = pubBtn ? (pubBtn.disabled || pubBtn.getAttribute('aria-disabled') === 'true') : true;
          return { isPublished };
        })()`,
        returnByValue: true
      });
      console.log('Status:', verify.result.value.isPublished ? 'HARDENED RULES LIVE IN FIRESTORE!' : 'Publishing...');

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
