import os
import sys
import time
from dotenv import load_dotenv
from google import genai

load_dotenv()

try:
    print("Using google.genai")
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    resp = client.models.generate_content(
        model='gemini-1.5-flash',
        contents='Say hi',
    )
    print(resp.text)
except Exception as e:
    print("Error:", e)
