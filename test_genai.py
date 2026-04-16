import os
import sys
import time
from dotenv import load_dotenv

load_dotenv()

try:
    import google.generativeai as genai
    print("Using google.generativeai")
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel("gemini-1.5-flash")
    resp = model.generate_content("Say hi")
    print(resp.text)
except ImportError:
    try:
        from google import genai
        from google.genai import types
        print("Using google.genai")
        client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        resp = client.models.generate_content(
            model='gemini-2.0-flash',
            contents='Say hi',
        )
        print(resp.text)
    except Exception as e:
        print("Error:", e)
