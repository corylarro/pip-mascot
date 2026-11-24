import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        pg=await b.new_page(); await pg.goto('file:///home/claude/pip/index.html')
        painted=open('/home/claude/pip-mascot/painted.js').read()
        src=await pg.evaluate('''(painted)=>{const c={name:"Pip",shape:"bean",color:"#FFC23D",accent:"#6BCB77",eyeColor:"#5A3A1E",topper:"sprout",eyes:"round",pattern:"none",accessory:"none",tooth:false,hat:"",item:"",greeting:"Hi, I'm Pip!"};
          return `/*! critter.js · Critterkit mascot runtime
 * Usage:
 *   <script src="https://pip-mascot.vercel.app/critter.js"><\\/script>
 *   <critter-mascot autopilot greet></critter-mascot>                 (drawn mascot)
 *   <critter-mascot mascot="YOUR_ID" autopilot greet></critter-mascot> (painted mascot made at pip-mascot.vercel.app/paint)
 * The old <pip-mascot> tag and pip-mascot.js still work.
 * Methods: setState(s), react(s, ms), say(text), point(element, text), tour(steps), home(), watch(input)
 */
(function(){
"use strict";
var origin=(document.currentScript&&document.currentScript.src)?new URL(document.currentScript.src).origin:'https://pip-mascot.vercel.app';
var engine=(${PipEngine.toString()})();
${painted}
var paintedEngine=PipPaintedEngine();
(${definePipElement.toString()})(engine, ${JSON.stringify(c)}, paintedEngine, origin);
})();
`}''',painted)
        open('/home/claude/pip-mascot/pip-mascot.js','w').write(src)
        open('/home/claude/pip-mascot/critter.js','w').write(src)
        await b.close()
asyncio.run(main())
