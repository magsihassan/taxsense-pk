from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import chat, tax

app = FastAPI(title="TaxSense PK API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(tax.router)


@app.get("/")
async def root():
    return {"status": "TaxSense PK API is running"}