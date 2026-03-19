"""Login to Telegram and save session."""
import asyncio
import os
import sys
import json

# Load .env from scripts directory
_env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_env_path):
    for line in open(_env_path):
        line = line.strip()
        if line and "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())
from telethon import TelegramClient

API_ID = int(os.environ.get("TG_API_ID", "0"))
API_HASH = os.environ.get("TG_API_HASH", "")
PHONE = os.environ.get("TG_PHONE", "")
SESSION_FILE = os.path.join(os.path.dirname(__file__), "masaad_session")
HASH_FILE = os.path.join(os.path.dirname(__file__), ".code_hash")

async def main():
    code = sys.argv[1] if len(sys.argv) > 1 else None

    client = TelegramClient(SESSION_FILE, API_ID, API_HASH)
    await client.connect()

    if not await client.is_user_authorized():
        if code is None:
            result = await client.send_code_request(PHONE)
            # Save the phone_code_hash
            with open(HASH_FILE, "w") as f:
                json.dump({"phone_code_hash": result.phone_code_hash}, f)
            print("CODE_SENT")
            print("Check your Telegram app for the code.")
        else:
            # Load saved hash
            with open(HASH_FILE, "r") as f:
                data = json.load(f)
            try:
                await client.sign_in(PHONE, code, phone_code_hash=data["phone_code_hash"])
                me = await client.get_me()
                print(f"LOGGED_IN as {me.first_name} ({me.phone})")
                # Cleanup
                os.remove(HASH_FILE)
            except Exception as e:
                print(f"ERROR: {e}")
    else:
        me = await client.get_me()
        print(f"ALREADY_LOGGED_IN as {me.first_name} ({me.phone})")

    await client.disconnect()

asyncio.run(main())
