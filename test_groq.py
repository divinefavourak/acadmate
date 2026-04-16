import os
import sys
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

try:
    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": "Say hi",
            }
        ],
        model="llama3-8b-8192",
    )
    print(chat_completion.choices[0].message.content)
except Exception as e:
    print("Error:", e)
