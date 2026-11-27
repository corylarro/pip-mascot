// Install code and the AI builder prompt for a saved mascot. Shared by the paint page and "My mascots".
(function(){
const o=location.origin;
function snipCode(id,kind){return kind==='ios'
  ?`// Xcode: File → Add Package Dependencies… → https://github.com/corylarro/CritterKit\nimport CritterKit\n\nContentView()\n  .critterMascot(.init(mascotID: "${id}"))`
  :`<script src="${o}/critter.js"></script>\n<critter-mascot mascot="${id}" autopilot greet></critter-mascot>`}
function aiPrompt(id,kind,name){name=(name||'').trim()||'our mascot';
  const common=`\n\nAdd it to the places that matter in this app, using moments (pick whichever fit):\n- After a first purchase or upgrade: first-purchase\n- Daily streaks: streak with the day count\n- Finishing a goal or hitting a milestone: goal / milestone with a short line\n- Levelling up: level-up with the level\n- First visit: welcome. Returning after a while: welcome-back\n- Empty lists: empty. Failed saves or requests: oops\n\nFor something custom, chain moves with play, e.g. a flip, a dance and a line with {placeholders} filled from real values.\nKeep the lines short, friendly and in the app's voice. Don't add the mascot to every button, only real moments.\nFull API reference: ${o}/llms.txt`;
  return kind==='ios'
  ?`Add ${name}, our animated mascot from Critterkit, to this SwiftUI app.\n\n1. Add the Swift package https://github.com/corylarro/CritterKit (File → Add Package Dependencies…).\n2. import CritterKit, and on the root view add: .critterMascot(.init(mascotID: "${id}"))\n3. Tag views the mascot can walk to with .critterTarget("name").\n4. Call it from app code: Critter.moment(.firstPurchase), Critter.moment(.streak(days: n)), Critter.moment(.levelUp(level)), Critter.moment(.milestone, say: "…", at: "target"), Critter.point(at: "email", say: "…"), try await Critter.watch(success: "Saved!") { … } around saves, Critter.play([["do": "flip"], ["do": "say", "text": "Level {level}!"]], values: ["level": level]).`+common
  :`Add ${name}, our animated mascot from Critterkit, to this web app.\n\n1. Load the script once on every page: <script src="${o}/critter.js"></script>\n   (Next.js: next/script with strategy="afterInteractive" in the root layout.)\n2. Render once, near the end of <body>: <critter-mascot mascot="${id}" autopilot greet></critter-mascot>\n   In React/JSX write autopilot="" greet="" and declare 'critter-mascot' in JSX.IntrinsicElements if using TypeScript.\n3. Autopilot already reacts to typing, invalid forms, slow/failed/successful requests and errors. Don't rebuild that.\n4. Call it from app code with const pip = document.querySelector('critter-mascot'):\n   pip.moment('first-purchase'), pip.moment('streak', { count: n }), pip.moment('level-up', { count: level }), pip.moment('milestone', { say: '…', at: '#selector' }), pip.point(el, 'text'), pip.say('text'), pip.react('love', 2000),\n   pip.play([{ do: 'flip' }, { do: 'react', state: 'dance', ms: 2500 }, { do: 'say', text: 'Level {level}!' }], { level }).`+common}
// What the mascot does with no extra code, per platform
const AUTO={
  web:['Watches people type, and covers its eyes on password fields','Walks over and points at a field when a form won’t submit','Thinks while a request is slow, cheers when it works, looks worried when it fails','Points out error messages that appear on the page','Calms things down when someone taps a button over and over','Says welcome back when someone returns to the tab','Notices when the connection drops and comes back','Naps when nothing happens for a while, and wakes up when poked','Optional: seasonal touches like falling leaves or snow. Add seasonal to the tag to turn them on'],
  ios:['Watches people type, and covers its eyes on password fields','Hops onto the keyboard so it stays in view','Says welcome back when someone returns to the app','Reacts when someone takes a screenshot','Naps when nothing happens for a while, and wakes up when tapped']};
// One line each, for the moments only your app knows about
const MOMENTS=[
  {m:'welcome',name:'First visit',desc:'Says hi to someone new.',web:"pip.moment('welcome')",ios:'Critter.moment(.welcome)'},
  {m:'welcome-back',name:'Welcome back',desc:'Greets someone returning after a while.',web:"pip.moment('welcome-back')",ios:'Critter.moment(.welcomeBack)'},
  {m:'first-purchase',name:'First purchase',desc:'A big celebration for a first upgrade or order.',web:"pip.moment('first-purchase')",ios:'Critter.moment(.firstPurchase)'},
  {m:'purchase',name:'Purchase',desc:'A smaller thank-you for repeat orders.',web:"pip.moment('purchase')",ios:'Critter.moment(.purchase)'},
  {m:'streak',o:{count:7},name:'Streak',desc:'Bigger celebrations at 7, 30, 100 days and more.',web:"pip.moment('streak', { count: days })",ios:'Critter.moment(.streak(days: days))'},
  {m:'level-up',o:{count:5},name:'Level up',desc:'Jumps, flips and calls out the new level.',web:"pip.moment('level-up', { count: level })",ios:'Critter.moment(.levelUp(level))'},
  {m:'goal',name:'Goal reached',desc:'Cheers when someone finishes what they set out to do.',web:"pip.moment('goal')",ios:'Critter.moment(.goal)'},
  {m:'milestone',o:{say:'100 notes written!'},name:'Milestone',desc:'Your own line, next to anything on screen.',web:"pip.moment('milestone', { say: '100 notes written!', at: '#notes' })",ios:'Critter.moment(.milestone, say: "100 notes!", at: "notes")'},
  {m:'empty',name:'Empty state',desc:'A gentle nudge when a list has nothing in it.',web:"pip.moment('empty')",ios:'Critter.moment(.empty)'},
  {m:'oops',name:'Something failed',desc:'Owns the mistake so people don’t feel bad.',web:"pip.moment('oops')",ios:'Critter.moment(.oops)'}];
window.CK={snipCode,aiPrompt,AUTO,MOMENTS};
})();
