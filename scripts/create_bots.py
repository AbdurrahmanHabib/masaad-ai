"""
Automated Telegram Bot Creation via BotFather.
Uses saved Telethon session (run login_telegram.py first).
Creates 7 bots and 3 groups for Masaad AI.
"""
import asyncio
import json
import os
import re

# Load .env from scripts directory
_env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_env_path):
    for line in open(_env_path):
        line = line.strip()
        if line and "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

from telethon import TelegramClient
from telethon.tl.functions.channels import CreateChannelRequest, InviteToChannelRequest

API_ID = int(os.environ.get("TG_API_ID", "0"))
API_HASH = os.environ.get("TG_API_HASH", "")
SESSION_FILE = os.path.join(os.path.dirname(__file__), "masaad_session")
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "bot_config.json")

BOTS_TO_CREATE = [
    {"role": "ceo", "name": "Masaad CEO AI", "username": "masaad_ceo_bot", "about": "Chief Executive at Masaad AI | AI Agent"},
    {"role": "sales", "name": "Masaad Sales AI", "username": "masaad_sales_bot", "about": "Head of Sales at Masaad AI | AI Agent"},
    {"role": "marketing", "name": "Masaad Marketing AI", "username": "masaad_marketing_bot", "about": "Head of Marketing at Masaad AI | AI Agent"},
    {"role": "cto", "name": "Masaad CTO AI", "username": "masaad_cto_bot", "about": "CTO at Masaad AI | AI Agent"},
    {"role": "finance", "name": "Masaad Finance AI", "username": "masaad_finance_bot", "about": "Head of Finance at Masaad AI | AI Agent"},
    {"role": "ir", "name": "Masaad IR AI", "username": "masaad_ir_bot", "about": "Investor Relations at Masaad AI | AI Agent"},
    {"role": "devops", "name": "Masaad DevOps AI", "username": "masaad_devops_bot", "about": "System Monitor at Masaad AI | AI Agent"},
]

GROUPS_TO_CREATE = [
    {"name": "Masaad AI HQ", "key": "hq", "about": "Internal operations - AI team workspace"},
    {"name": "Masaad AI Showcase", "key": "showcase", "about": "Masaad AI in action - investor view"},
    {"name": "Masaad AI Dev", "key": "dev", "about": "Development and testing environment"},
]


def extract_token(text):
    """Extract bot token from BotFather's response."""
    if not text:
        return None
    # Token pattern: number:alphanumeric-underscore string
    match = re.search(r'(\d+:[A-Za-z0-9_-]{30,})', text)
    if match:
        return match.group(1)
    return None


async def create_bot(client, bot_father, bot_info):
    """Create a single bot via BotFather."""
    print(f"  Creating {bot_info['name']}...")

    # Send /newbot
    await client.send_message(bot_father, "/newbot")
    await asyncio.sleep(4)

    # Send display name
    await client.send_message(bot_father, bot_info["name"])
    await asyncio.sleep(4)

    # Send username
    await client.send_message(bot_father, bot_info["username"])
    await asyncio.sleep(4)

    # Read response — get last few messages to find the token
    messages = await client.get_messages(bot_father, limit=5)
    token = None
    for msg in messages:
        if msg.text:
            token = extract_token(msg.text)
            if token:
                break

    if token:
        print(f"    OK — token: {token[:25]}...")
    else:
        print(f"    WARNING — could not extract token")
        # Print last message for debugging
        if messages:
            print(f"    Last msg: {messages[0].text[:200] if messages[0].text else 'empty'}")

    # Set about text
    await asyncio.sleep(2)
    await client.send_message(bot_father, "/setabouttext")
    await asyncio.sleep(3)

    # BotFather asks which bot — send username
    await client.send_message(bot_father, f"@{bot_info['username']}")
    await asyncio.sleep(3)

    # Send the about text
    await client.send_message(bot_father, bot_info["about"])
    await asyncio.sleep(3)

    return token


async def create_group(client, group_info, bot_usernames):
    """Create a supergroup and invite bots."""
    print(f"  Creating group: {group_info['name']}...")

    try:
        result = await client(CreateChannelRequest(
            title=group_info["name"],
            about=group_info["about"],
            megagroup=True
        ))

        channel = result.chats[0]
        chat_id = int(f"-100{channel.id}")
        print(f"    Chat ID: {chat_id}")

        # Add each bot
        for username in bot_usernames:
            try:
                await asyncio.sleep(2)
                user = await client.get_entity(f"@{username}")
                await client(InviteToChannelRequest(channel, [user]))
                print(f"    Added @{username}")
            except Exception as e:
                print(f"    Could not add @{username}: {e}")

        return chat_id

    except Exception as e:
        print(f"    ERROR: {e}")
        return None


async def main():
    print("=" * 60)
    print("Masaad AI — Automated Telegram Setup")
    print("=" * 60)

    client = TelegramClient(SESSION_FILE, API_ID, API_HASH)
    await client.connect()

    if not await client.is_user_authorized():
        print("ERROR: Not logged in. Run login_telegram.py first.")
        return

    me = await client.get_me()
    print(f"Logged in as: {me.first_name}\n")

    config = {"bots": {}, "groups": {}}

    # === Step 1: Create 7 bots ===
    print("--- Creating 7 Telegram Bots ---")
    bot_father = await client.get_entity("@BotFather")

    for bot_info in BOTS_TO_CREATE:
        try:
            token = await create_bot(client, bot_father, bot_info)
            config["bots"][bot_info["role"]] = {
                "name": bot_info["name"],
                "username": bot_info["username"],
                "token": token,
            }
        except Exception as e:
            print(f"    FAILED: {e}")
            config["bots"][bot_info["role"]] = {
                "name": bot_info["name"],
                "username": bot_info["username"],
                "token": None,
            }
        # Pause between bots to avoid BotFather rate limits
        print(f"    Waiting 15s before next bot...")
        await asyncio.sleep(15)

    # === Step 2: Create 3 groups ===
    print("\n--- Creating 3 Telegram Groups ---")
    bot_usernames = [b["username"] for b in BOTS_TO_CREATE if config["bots"].get(b["role"], {}).get("token")]

    for group_info in GROUPS_TO_CREATE:
        try:
            chat_id = await create_group(client, group_info, bot_usernames)
            config["groups"][group_info["key"]] = {
                "name": group_info["name"],
                "chat_id": chat_id,
            }
        except Exception as e:
            print(f"    FAILED: {e}")
        await asyncio.sleep(3)

    # === Save config ===
    with open(OUTPUT_FILE, "w") as f:
        json.dump(config, f, indent=2)

    print(f"\nConfig saved to: {OUTPUT_FILE}")

    # === Print summary ===
    print("\n--- RESULTS ---")
    bots_ok = sum(1 for b in config["bots"].values() if b.get("token"))
    groups_ok = sum(1 for g in config["groups"].values() if g.get("chat_id"))
    print(f"Bots created: {bots_ok}/7")
    print(f"Groups created: {groups_ok}/3")

    await client.disconnect()
    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
