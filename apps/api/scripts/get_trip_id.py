import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
trips = c.table("trips").select("id,name").execute().data
for t in trips:
    print(f"name: {t['name']}")
    print(f"id:   {t['id']}")
