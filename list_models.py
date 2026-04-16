import os
import sys
from dotenv import load_dotenv
from google import genai

load_dotenv()

try:
    print("Listing models:")
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    for m in client.models.list():
        print(m.name)
except Exception as e:
    print("Error:", e)
