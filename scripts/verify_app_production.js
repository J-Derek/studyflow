// Verify all new production features via CDP on localhost:5173
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
      console.log('1. Reloading page...');
      await send('Page.reload');
      await new Promise(r => setTimeout(r, 2000));

      // 2. Test Dark Mode toggle
      console.log('2. Testing Theme Switcher...');
      const themeTest = await send('Runtime.evaluate', {
        expression: `(() => {
          const isDarkBefore = document.documentElement.classList.contains('dark');
          
          // Find dark mode button in header or sidebar
          const darkBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Dark') || b.getAttribute('title')?.includes('Dark'));
          if (darkBtn) darkBtn.click();
          
          const isDarkAfter = document.documentElement.classList.contains('dark');
          const header = document.querySelector('header');
          const headerBg = header ? window.getComputedStyle(header).backgroundColor : '';
          
          return {
            isDarkBefore,
            isDarkAfter,
            headerBg,
            themeSwitched: isDarkAfter !== isDarkBefore || isDarkAfter === true
          };
        })()`,
        returnByValue: true
      });
      console.log('Theme toggle result:', themeTest.result.value);

      // 3. Test Navigation to Grades & GPA
      console.log('3. Navigating to Grades & GPA...');
      const gradesNav = await send('Runtime.evaluate', {
        expression: `(() => {
          const gradesBtn = Array.from(document.querySelectorAll('aside button, nav button')).find(b => b.innerText.includes('Grades'));
          if (gradesBtn) {
            gradesBtn.click();
            return { clicked: true, text: gradesBtn.innerText };
          }
          return { clicked: false };
        })()`,
        returnByValue: true
      });
      console.log('Grades navigation:', gradesNav.result.value);

      await new Promise(r => setTimeout(r, 1000));

      const gradesCheck = await send('Runtime.evaluate', {
        expression: `(() => {
          const gpaText = document.body.innerText.includes('Cumulative Grade Point Average');
          const simulatorText = document.body.innerText.includes('What-If');
          const cards = document.querySelectorAll('input[type="range"]').length;
          return {
            hasGpaCard: gpaText,
            hasSimulator: simulatorText,
            hasSliders: cards > 0
          };
        })()`,
        returnByValue: true
      });
      console.log('Grades view check:', gradesCheck.result.value);

      // 4. Test Assignments Subtasks
      console.log('4. Navigating to Assignments & checking subtasks...');
      await send('Runtime.evaluate', {
        expression: `(() => {
          const asgBtn = Array.from(document.querySelectorAll('aside button, nav button')).find(b => b.innerText.includes('Assignments') || b.innerText.includes('Tasks'));
          if (asgBtn) asgBtn.click();
        })()`
      });

      await new Promise(r => setTimeout(r, 1000));

      const subtasksCheck = await send('Runtime.evaluate', {
        expression: `(() => {
          const subtaskItems = document.querySelectorAll('input[type="checkbox"]').length;
          const subtaskText = document.body.innerText.includes('Milestones & Subtasks');
          return {
            subtaskCheckboxesFound: subtaskItems,
            hasSubtaskHeader: subtaskText
          };
        })()`,
        returnByValue: true
      });
      console.log('Assignments subtasks check:', subtasksCheck.result.value);

      // 5. Test Focus Timer Soundscapes
      console.log('5. Navigating to Focus Timer & checking soundscapes...');
      await send('Runtime.evaluate', {
        expression: `(() => {
          const timerBtn = Array.from(document.querySelectorAll('aside button, nav button')).find(b => b.innerText.includes('Timer') || b.innerText.includes('Focus'));
          if (timerBtn) timerBtn.click();
        })()`
      });

      await new Promise(r => setTimeout(r, 1000));

      const soundscapesCheck = await send('Runtime.evaluate', {
        expression: `(() => {
          const hasSoundscapes = document.body.innerText.includes('Ambient Deep Work Soundscapes');
          const rainBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Gentle Rain'));
          return {
            hasSoundscapes,
            hasRainOption: !!rainBtn
          };
        })()`,
        returnByValue: true
      });
      console.log('Focus Timer soundscapes check:', soundscapesCheck.result.value);

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
