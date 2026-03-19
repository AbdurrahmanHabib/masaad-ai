"""
Registers Telegram webhooks for all bots using bot_config.json.
Run after set_telegram_secrets.py and deployment.
"""
import json
import os
import asyncio
import aiohttp

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "..", "bot_config.json")
WORKER_URL = "https://masaad-ai.clothingdxb.workers.dev"

async def main():
    with open(CONFIG_FILE, "r") as f:
        config = json.load(f)

    async with aiohttp.ClientSession() as session:
        for role, bot in config["bots"].items():
            token = bot.get("token")
            if not token:
                print(f"SKIP {role} — no token")
                continue

            webhook_url = f"{WORKER_URL}/webhook/{role}"
            api_url = f"https://api.telegram.org/bot{token}/setWebhook"

            async with session.post(api_url, json={
                "url": webhook_url,
                "allowed_updates": ["message", "callback_query"],
            }) as resp:
                data = await resp.json()
                if data.get("ok"):
                    print(f"OK  {role} -> {webhook_url}")
                else:
                    print(f"FAIL {role}: {data}")

    print("\nAll webhooks registered!")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except ImportError:
        print("aiohttp not installed. Using requests instead...")
        import requests
        with open(CONFIG_FILE, "r") as f:
            config = json.load(f)
        for role, bot in config["bots"].items():
            token = bot.get("token")
            if not token:
                continue
            webhook_url = f"{WORKER_URL}/webhook/{role}"
            resp = requests.post(
                f"https://api.telegram.org/bot{token}/setWebhook",
                json={"url": webhook_url, "allowed_updates": ["message", "callback_query"]},
            )
            data = resp.json()
            status = "OK" if data.get("ok") else "FAIL"
            print(f"{status} {role} -> {webhook_url}")
