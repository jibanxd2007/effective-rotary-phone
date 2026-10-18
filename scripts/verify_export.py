import urllib.request
import json
import http.cookiejar
import time
import os

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

# 1. Login
print("Logging in as admin...")
login_req = urllib.request.Request(
    'http://127.0.0.1:8000/api/v1/auth/login',
    data=json.dumps({'username': 'admin', 'password': 'Password123!'}).encode(),
    headers={'Content-Type': 'application/json'}
)
resp = opener.open(login_req)
print(f"Login status: {resp.status}")

# 2. Get presentations
all_req = urllib.request.Request('http://127.0.0.1:8000/api/v1/ppt/presentation/all')
pres_list = json.loads(opener.open(all_req).read().decode())
pres_id = pres_list[0]['id']
print(f"Using presentation: {pres_id} ({pres_list[0].get('title')})")

# 3. Export PPTX
print("\nExporting PPTX...")
t0 = time.time()
export_pptx = urllib.request.Request(
    f'http://127.0.0.1:8000/api/v1/ppt/presentation/{pres_id}/export',
    data=json.dumps({'export_as': 'pptx'}).encode(),
    headers={'Content-Type': 'application/json'}
)
pptx_resp = json.loads(opener.open(export_pptx).read().decode())
pptx_time = time.time() - t0
pptx_path = pptx_resp.get("path")
print(f"PPTX export response in {pptx_time:.2f}s: {pptx_path}")
if pptx_path and os.path.exists(pptx_path):
    print(f"SUCCESS: PPTX binary exists on disk! Size: {os.path.getsize(pptx_path)} bytes")

# 4. Export PDF
print("\nExporting PDF...")
t1 = time.time()
export_pdf = urllib.request.Request(
    f'http://127.0.0.1:8000/api/v1/ppt/presentation/{pres_id}/export',
    data=json.dumps({'export_as': 'pdf'}).encode(),
    headers={'Content-Type': 'application/json'}
)
pdf_resp = json.loads(opener.open(export_pdf).read().decode())
pdf_time = time.time() - t1
pdf_path = pdf_resp.get("path")
print(f"PDF export response in {pdf_time:.2f}s: {pdf_path}")
if pdf_path and os.path.exists(pdf_path):
    print(f"SUCCESS: PDF binary exists on disk! Size: {os.path.getsize(pdf_path)} bytes")
