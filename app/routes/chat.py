from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
from app.services.tax_agent import get_vectorstore, build_agent

router = APIRouter(prefix="/api/chat", tags=["chat"])

_vectorstore = None
_agent = None

# In-memory conversation store: {session_id: [messages]}
# NOTE: resets on server restart. Fine for a portfolio demo — a production
# version would back this with Redis or a database instead.
_conversations: dict[str, list] = {}


def get_agent():
    global _vectorstore, _agent
    if _agent is None:
        _vectorstore = get_vectorstore()
        _agent = build_agent(_vectorstore)
    return _agent


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    session_id = request.session_id or str(uuid.uuid4())

    if session_id not in _conversations:
        _conversations[session_id] = []

    history = _conversations[session_id]
    history.append({"role": "user", "content": request.message})

    agent = get_agent()

    try:
        result = agent.invoke({"messages": history})
        final_message = result["messages"][-1].content

        history.append({"role": "assistant", "content": final_message})
        _conversations[session_id] = history

        return ChatResponse(response=final_message, session_id=session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")


@router.delete("/{session_id}")
async def clear_conversation(session_id: str):
    _conversations.pop(session_id, None)
    return {"status": "cleared"}