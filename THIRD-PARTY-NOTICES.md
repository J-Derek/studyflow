# Third-party notices

StudyFlow ships these open-source packages in the app people download. Each keeps its own licence; all of them allow use in a commercial product. Versions are those installed on 2026-11-17 (see `app/package.json`).

| Package | Version | Licence | Used for |
|---|---|---|---|
| react, react-dom | 19.3.1 | MIT | The interface |
| zustand | 5.0.16 | MIT | App state |
| firebase | 13.1.0 | Apache-2.0 | Sign-in and saving plans |
| lucide-react | 1.66.0 | ISC | Icons |
| docx | 9.15.3 | MIT | Word download of writing |
| canvas-confetti | 1.9.4 | ISC | The small celebration when work is done |
| clsx, tailwind-merge | 2.1.1, 3.7.0 | MIT | Class names |
| @fontsource-variable/inter | 5.3.0 | SIL Open Font License 1.1 | Body font (Inter) |
| @fontsource-variable/bricolage-grotesque | 5.3.0 | SIL Open Font License 1.1 | Heading font (Bricolage Grotesque) |

Build and test tools (Vite, TypeScript, Tailwind CSS, Vitest, Playwright, oxlint, axe-core and the Firebase CLI) are used only to build and test the app and are not shipped to users. Their licences are listed in their own folders under `app/node_modules`.

## Images

- The app icon and favicon (`app/public/favicon.svg`, `app/public/icons/`) were drawn for this project.
- `app/public/og.png` is the link-preview picture. Its origin is not recorded.
- `app/src/assets/hero.png`, `react.svg` and `vite.svg` are not used by the app. The last two are the Vite starter files.

The owner should confirm where `og.png` and `hero.png` came from before a sale. If either came from an image generator or a stock site, note which one here.

## Sounds

The focus timer's background sounds are generated in the browser. No audio files are shipped.

## How to refresh this list

From `app/`, after `npm install`:

```bash
node -e "const p=require('./package.json');for(const d of Object.keys(p.dependencies)){const m=require('./node_modules/'+d+'/package.json');console.log(d,m.version,m.license)}"
```
