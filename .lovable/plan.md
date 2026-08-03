## Goal
Make the "Install Just Wheels" prompt reappear for visitors who haven't installed the app.

## What I found (verified)
`InstallPrompt` is still rendered in the root layout and its texts exist in both languages, so nothing was deleted. Three real reasons it can stay hidden:

1. **The browser event is missed.** The component only listens for `beforeinstallprompt` from inside a `useEffect`. Chrome fires that event very early — often before React hydrates — so the prompt is simply never captured and the banner never renders.
2. **iOS/Safari never fires that event at all**, so iPhone/iPad users can never see it.
3. **A one-time dismissal is permanent.** Tapping "Later" or the X writes a flag that hides the banner forever, with no way back.

## Fix

**1. Capture the event before React loads**
Add a tiny inline script in the document head that listens for `beforeinstallprompt`, prevents the default mini-infobar and stashes the event on `window`. The component then reads the stashed event on mount as well as listening for later ones. This is the main fix.

**2. iOS fallback**
When there's no install event, the browser is Safari on iOS, and the app isn't already running standalone, show the same banner with short "Tap Share, then Add to Home Screen" wording (EN + AF strings added to the dictionary).

**3. Snooze instead of permanent dismiss**
Change "Later"/X to store a timestamp and re-show after ~14 days. Add a small one-time migration so existing users who already dismissed get the banner again.

**4. Also keep it reachable**
Add an "Install app" item in the menu (hidden when already installed) so it can be triggered on demand rather than only appearing on its own.

## Technical notes
- Files: `src/components/InstallPrompt.tsx`, `src/routes/__root.tsx` (head script + mount), `src/i18n/dictionaries.ts`, `src/components/SiteLayout.tsx` (menu entry).
- No changes to the service worker, manifest, or `vite.config.ts`.
- Chrome only fires the event on a secure origin with a valid manifest and SW; the Lovable preview iframe suppresses it, so verification is on the published site (or the iOS path in preview).
