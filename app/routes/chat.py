from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.tax_agent import get_vectorstore, build_agent

router = APIRouter(prefix="/api/chat", tags=["chat"])

_vectorstore = None
_agent = None


def get_agent():
    """Lazily initialize the vectorstore + agent once, reuse across requests."""
    global _vectorstore, _agent
    if _agent is None:
        _vectorstore = get_vectorstore()
        _agent = build_agent(_vectorstore)
    return _agent


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    agent = get_agent()

    try:
        result = agent.invoke({"messages": [{"role": "user", "content": request.message}]})
        final_message = result["messages"][-1].content
        return ChatResponse(response=final_message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")