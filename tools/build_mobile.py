import os
root='/home/claude/pip-mascot'
js=open(f'{root}/pip-mascot.js').read().replace('</script','<\\/script')
bridge=open(f'{root}/mobile/bridge.js').read()
html=f'''<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<style>html,body{{margin:0;height:100%;background:transparent;overflow:hidden;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;font-family:-apple-system,system-ui,sans-serif}}</style>
</head><body>
<script>{js}</script>
<script>{bridge}</script>
</body></html>'''
open(f'{root}/mobile/pip-mobile.html','w').write(html)
os.makedirs(f'{root}/swift/Sources/CritterKit/Resources',exist_ok=True)
open(f'{root}/swift/Sources/CritterKit/Resources/pip-mobile.html','w').write(html)
print(len(html),'bytes')
