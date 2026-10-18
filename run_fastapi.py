import os
import sys
import json

os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

# Force unbuffered stdout/stderr
os.environ["PYTHONUNBUFFERED"] = "1"
os.environ["APP_DATA_DIRECTORY"] = r"D:\presenton-main\app_data"
user_config_path = os.path.join(os.environ["APP_DATA_DIRECTORY"], "userConfig.json")
os.environ["USER_CONFIG_PATH"] = user_config_path

if not os.path.exists(user_config_path):
    with open(user_config_path, "w", encoding="utf-8") as f:
        json.dump({}, f)

os.environ["EXPORT_PACKAGE_ROOT"] = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "presentation-export"))
os.environ["NEXT_PUBLIC_URL"] = "http://127.0.0.1:3001"
os.environ["NEXT_PUBLIC_FAST_API"] = "http://127.0.0.1:8000"
os.environ["FAST_API_INTERNAL_URL"] = "http://127.0.0.1:8000"

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if os.path.exists(chrome_path):
    os.environ["PUPPETEER_EXECUTABLE_PATH"] = chrome_path
os.environ["PUPPETEER_CACHE_DIR"] = r"D:\.puppeteer-cache"
temp_dir = os.path.join(os.environ["APP_DATA_DIRECTORY"], "temp")
os.makedirs(temp_dir, exist_ok=True)
os.environ["TEMP_DIRECTORY"] = temp_dir
os.environ["TEMP"] = temp_dir
os.environ["TMP"] = temp_dir
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

os.environ["LLM"] = os.environ.get("LLM", "openai")
os.environ["DISABLE_AUTH"] = "true"
os.environ["MIGRATE_DATABASE_ON_STARTUP"] = "true"

fastapi_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "servers", "fastapi")
sys.path.insert(0, fastapi_dir)
os.chdir(fastapi_dir)

import uvicorn

if __name__ == "__main__":
    print(f"Starting FastAPI on port 8000 (APP_DATA_DIRECTORY={os.environ['APP_DATA_DIRECTORY']}, USER_CONFIG_PATH={user_config_path})...", flush=True)
    uvicorn.run("api.main:app", host="127.0.0.1", port=8000, reload=False, log_level="info")
