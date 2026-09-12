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


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(tax.router)
app.include_router(salary_slip.router)

@app.get("/")
async def root():
    return {"status": "TaxSense PK API is running"}