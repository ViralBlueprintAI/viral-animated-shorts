import sys, time, http.server, functools, threading
from playwright.sync_api import sync_playwright
scale=sys.argv[1]; frames=[int(x) for x in sys.argv[2].split(',')]; prefix=sys.argv[3]
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8792),functools.partial(http.server.SimpleHTTPRequestHandler,directory='public'))
http.server.SimpleHTTPRequestHandler.log_message=lambda *a:None
threading.Thread(target=srv.serve_forever,daemon=True).start()
W,H=int(1080*float(scale)),int(1920*float(scale))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=b.new_page(viewport={'width':W,'height':H})
    pg.on('pageerror',lambda e:print('PAGE ERROR',e)); pg.on('console',lambda m:print('console',m.text) if m.type in('error','warning') else None)
    extra=sys.argv[4] if len(sys.argv)>4 else ''
    pg.goto(f'http://127.0.0.1:8792/s_index.html?scale={scale}'+extra); pg.wait_for_function('window.READY===true',timeout=300000)
    for f in frames:
        t0=time.time(); pg.evaluate(f'window.renderFrame({f})'); el=pg.query_selector('#out'); el.screenshot(path=f'{prefix}{f:04d}.jpg',type='jpeg',quality=90); print(f, round(time.time()-t0,1), flush=True)
    b.close()
srv.shutdown()
