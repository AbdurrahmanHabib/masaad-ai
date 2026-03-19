"""
Reads bot_config.json and sets all Telegram secrets via wrangler CLI.
Run after create_bots.py completes successfully.
"""
import json
import os
import subprocess

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "..", "bot_config.json")

def main():
    with open(CONFIG_FILE, "r") as f:
        config = json.load(f)

    # Set bot token secrets
    for role, bot in config["bots"].items():
        token = bot.get("token")
        if not token:
            print(f"SKIP {role} — no token")
            continue

        key = f"TG_BOT_{role.upper()}"
        print(f"Setting {key}...")
        result = subprocess.run(
            ["npx", "wrangler@latest", "secret", "put", key],
            input=token.encode(),
            capture_output=True,
            cwd=os.path.join(os.path.dirname(__file__), ".."),
        )
        if result.returncode == 0:
            print(f"  OK")
        else:
            print(f"  FAILED: {result.stderr.decode()}")

    # Set group chat ID secrets
    for key, group in config["groups"].items():
        chat_id = group.get("chat_id")
        if not chat_id:
            print(f"SKIP group {key} — no chat_id")
            continue

        secret_key = f"TG_GROUP_{key.upper()}"
        print(f"Setting {secret_key}...")
        result = subprocess.run(
            ["npx", "wrangler@latest", "secret", "put", secret_key],
            input=str(chat_id).encode(),
            capture_output=True,
            cwd=os.path.join(os.path.dirname(__file__), ".."),
        )
        if result.returncode == 0:
            print(f"  OK")
        else:
            print(f"  FAILED: {result.stderr.decode()}")

    print("\nDone! Redeploy with: npx wrangler@latest deploy")

if __name__ == "__main__":
    main()
