// Send Phase 3 production features to Claude for adversarial critique
const targetTabId = '2FB10A8721090994FBC5AF9B684B24C2';

const claudePrompt = `[STUDYFLOW PHASE 3 ENGINE UPGRADE — ADVERSARIAL VILLAIN AUDIT]

Claude, you roasted the previous draft and forced us to fix the dark mode FOUC, multi-tab anonymous races, and unbounded query vulnerabilities. We implemented all your recommendations.

Now, based on deep production readiness standards for premier academic productivity apps, we just engineered and shipped 5 major systems:

================================================================================
1. HIGH-VISIBILITY DUAL THEME TOGGLE & ZERO-FOUC
================================================================================
- Added high-contrast [ ☀️ Light ] [ 🌙 Dark ] segmented pill controls in both the persistent Top Header and Sidebar, plus a corner floating quick-toggle shortcut.
- Synchronous <script> in <head> parses localStorage before React hydrates to prevent white flashes.

================================================================================
2. ACADEMIC GRADES & GPA "WHAT-IF" SIMULATOR (Grades.tsx)
================================================================================
- Full 4.0 scale GPA calculation (Quality Points / Enrolled Credits).
- Interactive slider dynamically simulates required scores on upcoming assessments (e.g. final exams) based on syllabus percentage weights to determine minimum score needed for target letter grades.
- Real-time score updates with immediate recalculation of term GPA and Dean's honor status.

================================================================================
3. COURSEWORK SUBTASKS & MILESTONES ENGINE (Assignments.tsx)
================================================================================
- Hierarchical checklist on assignment cards with auto-calculated percentage progress.
- Checking off milestones automatically advances progress bar; 100% completion marks assignment as finished.
- Inline subtask additions with fallback auto-generation for legacy assignments.

================================================================================
4. 100% NATIVE WEB AUDIO AMBIENT SOUNDSCAPES (soundscapes.ts)
================================================================================
- Zero external MP3 downloads. Synthesizes gentle pink noise (rain), brown noise (waterfall), white noise, and 40Hz gamma binaural beats directly via browser AudioContext with biquad filter nodes and volume gain compensation.
- Integrated into Focus Timer with volume slider and audio equalizer indicators.

================================================================================
5. RFC 5545 iCALENDAR (.ICS) SYNDICATION (icalExport.ts)
================================================================================
- 1-click generation of RFC 5545 compliant .ics calendar feeds for weekly class timetables.
- Direct export into Apple Calendar, Google Calendar, and Microsoft Outlook.

================================================================================
ROAST & VETTING DIRECTIVES:
================================================================================
Tear this new surface area apart:
1. Web Audio API pitfalls: Can the AudioContext get blocked by browser autoplay policies or leak nodes when users rapidly switch soundscapes?
2. Floating point GPA math: Does cumulative GPA calculation suffer from JS floating-point precision quirks?
3. iCalendar recurrence rules: Does RRULE:FREQ=WEEKLY;BYDAY handle timezone offsets without drifting?
4. What else can make this app feel like an Apple Design Award winner rather than an AI prototype?`;

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
          const editor = document.querySelector('div[contenteditable="true"].ProseMirror') || 
                         document.querySelector('[contenteditable="true"]');
          if (!editor) return { error: 'Editor not found in Claude' };
          editor.focus();
          
          const range = document.createRange();
          range.selectNodeContents(editor);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand('delete', false, null);
          
          document.execCommand('insertText', false, ${JSON.stringify(claudePrompt)});
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          return { success: true, textLength: editor.innerText.length };
        })()`,
        returnByValue: true
      });
      console.log('Claude insert:', res.result.value);
      
      await new Promise(r => setTimeout(r, 1200));
      const clickRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = document.querySelector('button[aria-label="Send Message"]') || 
                      document.querySelector('button[aria-label="Send message"]') ||
                      document.querySelector('button[aria-label="Send"]') ||
                      document.querySelector('fieldset button:last-child');
          if (btn) {
            btn.click();
            return { clicked: true, disabled: btn.disabled };
          }
          return { clicked: false };
        })()`,
        returnByValue: true
      });
      console.log('Claude click:', clickRes.result.value);
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
