import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import chat, tax, salary_slip


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-warm HuggingFace embeddings & Pinecone vectorstore in background thread
    asyncio.create_task(asyncio.to_thread(chat.warm_up_agent))
    yield


app = FastAPI(title="TaxSense PK API", lifespan=lifespan)

# Flexible CORS configuration: supports comma-separated CORS_ORIGINS or CORS_ALLOW_ALL
cors_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = [origin.strip() for origin in cors_env.split(",") if origin.strip()]
if not allowed_origins:
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

# If CORS_ALLOW_ALL is set to 'true', allow all web origins (useful for initial testing & previews)
allow_all = os.getenv("CORS_ALLOW_ALL", "true").lower() in ("true", "1", "yes")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else allowed_origins,
    allow_credentials=True if not allow_all else False,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(chat.router)
app.include_router(tax.router)
app.include_router(salary_slip.router)

@app.get("/")
async def root():
    return {"status": "TaxSense PK API is running"}