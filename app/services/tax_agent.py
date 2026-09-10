import os
import sys
from pathlib import Path
from dotenv import load_dotenv

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_groq import ChatGroq
from langchain_core.tools import tool
from langchain.agents import create_agent

try:
    from app.services.tax_calculator import calculate_tax, TAX_SLABS
except ImportError:
    from tax_calculator import calculate_tax, TAX_SLABS

INDEX_NAME = "tax-assistant"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
LLM_MODEL = "openai/gpt-oss-120b"
TOP_K = 8


def get_vectorstore():
    print("Connecting to Pinecone index...")
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    vectorstore = PineconeVectorStore(index_name=INDEX_NAME, embedding=embeddings)
    print("Connected.")
    return vectorstore


def build_tools(vectorstore):
    retriever = vectorstore.as_retriever(search_kwargs={"k": TOP_K})

    @tool
    def search_tax_documents(query: str) -> str:
        """Search the official FBR tax documents (Income Tax Ordinance 2001,
        Finance Act 2026, filing guides) for qualitative information such as
        deadlines, filing requirements, wealth statement rules, definitions,
        and procedures. Do NOT use this for calculating tax amounts — use
        calculate_income_tax for that instead."""
        docs = retriever.invoke(query)
        formatted = []
        for doc in docs:
            source = doc.metadata.get("source", "unknown")
            page = doc.metadata.get("page", "?")
            formatted.append(f"[Source: {source}, page {page}]\n{doc.page_content}")
        return "\n\n---\n\n".join(formatted)

    @tool
    def calculate_income_tax(annual_taxable_income: float, tax_year: str = "2025-26") -> dict:
        """Calculate the exact income tax owed for a salaried individual in
        Pakistan, given their annual taxable income in PKR. Use this for ANY
        question involving computing a tax amount, tax liability, or
        effective rate — never estimate this yourself from retrieved text.

        Args:
            annual_taxable_income: Annual taxable salary in PKR (e.g. 1200000).
            tax_year: Either "2025-26" (year currently being filed, deadline
                Sept 30 2026) or "2026-27" (current ongoing tax year, in
                effect since July 1 2026). Ask the user which year they mean
                if it's not clear from context.
        """
        if tax_year not in TAX_SLABS:
            return {"error": f"tax_year must be one of {list(TAX_SLABS)}"}
        return calculate_tax(annual_taxable_income, tax_year)

    return [search_tax_documents, calculate_income_tax]


SYSTEM_PROMPT = """You are TaxSense PK, an assistant that helps salaried individuals in Pakistan \
understand and calculate their income tax obligations.

Rules:
- For questions about tax LAW, RULES, DEADLINES, or REQUIREMENTS: use the \
search_tax_documents tool and answer only from what it returns, citing the source.
- For questions that require CALCULATING a tax amount: use the \
calculate_income_tax tool. Never compute tax math yourself — always call the tool.
- If the tax year isn't specified by the user, ask them to clarify between \
"2025-26" (currently being filed) and "2026-27" (current ongoing year), or \
state clearly which one you're assuming and why.
- If information isn't available from your tools, say so clearly instead of \
guessing.
- This is an informational tool, not tax advice. Always remind the user to \
verify with a tax consultant or FBR directly for their specific situation.
"""


def build_agent(vectorstore):
    tools = build_tools(vectorstore)
    llm = ChatGroq(model=LLM_MODEL, temperature=0)

    agent = create_agent(
        model=llm,
        tools=tools,
        system_prompt=SYSTEM_PROMPT,
    )
    return agent


if __name__ == "__main__":
    vectorstore = get_vectorstore()
    agent = build_agent(vectorstore)

    test_questions = [
        "How much tax do I owe on an annual salary of 1,200,000 rupees for tax year 2025-26?",
        "Do I need to file a wealth statement along with my income tax return?",
        "What's my effective tax rate if I earn 5,000,000 annually in 2026-27?",
    ]

    for q in test_questions:
        print("\n" + "=" * 80)
        print(f"Q: {q}\n")
        result = agent.invoke({"messages": [{"role": "user", "content": q}]})
        final_message = result["messages"][-1].content
        print(f"\nA: {final_message}\n")