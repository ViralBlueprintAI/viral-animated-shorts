# render frames a..b of the short into a JPEG sequence (resumable): python3 s_render.py SCALE A B DIR PORT
import sys, os, time, http.server, functools, threading
from playwright.sync_api import sync_playwright
scale=sys.argv[1]; a=int(sys.argv[2]); b=int(sys.argv[3]); out=sys.argv[4]; port=int(sys.argv[5])
os.makedirs(out, exist_ok=True)
http.server.SimpleHTTPRequestHandler.log_message=lambda *x:None
srv=http.server.ThreadingHTTPServer(('127.0.0.1',port),functools.partial(http.server.SimpleHTTPRequestHandler,directory=__import__('os').environ.get('PUBDIR','public')))
threading.Thread(target=srv.serve_forever,daemon=True).start()
W,H=int(1080*float(scale)),int(1920*float(scale))
with sync_playwright() as p:
    br=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=br.new_page(viewport={'width':W,'height':H})
    pg.on('pageerror',lambda e:print('PAGE ERROR',e,flush=True))
    pg.goto(f'http://127.0.0.1:{port}/s_index.html?scale={scale}'); pg.wait_for_function('window.READY===true',timeout=300000)
    t0=time.time()
    def boot():
        pg.goto(f'http://127.0.0.1:{port}/s_index.html?scale={scale}'); pg.wait_for_function('window.READY===true',timeout=300000)
    for f in range(a,b):
        fn=f'{out}/{f:05d}.jpg'
        if os.path.exists(fn): continue
        for attempt in range(3):
            pg.evaluate(f'window.renderFrame({f})'); pg.query_selector('#out').screenshot(path=fn,type='jpeg',quality=92)
            if not pg.evaluate('!!window.LOST'): break
            print('context lost at', f, '- reloading', flush=True); os.remove(fn); boot()
        if f%30==0: print(f, round(time.time()-t0), flush=True)
    br.close()
srv.shutdown(); print('done',flush=True)
