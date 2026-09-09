import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from tqdm import tqdm

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Resolve project root so .env is always found
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

load_dotenv()

INDEX_NAME = "tax-assistant"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
LLM_MODEL = "openai/gpt-oss-120b"
TOP_K = 5
SYSTEM_PROMPT = """You are TaxSense PK, an assistant that helps salaried individuals in Pakistan \
understand income tax filing based ONLY on the official documents provided below.

Rules:
- Answer ONLY using the context provided. Do not use outside knowledge.
- If the context does not contain enough information to answer, say so clearly \
instead of guessing.
- Always cite the source document for each claim (e.g., "According to the Income \
Tax Ordinance 2001...").
- SOURCE PRIORITY: If the Income Tax Ordinance 2001 and the Finance Act 2026 give \
different rates, slabs, or thresholds for the same thing, the Finance Act 2026 is \
authoritative — it contains the latest amendments and overrides the Ordinance's \
original tables. Explicitly mention when you are doing this (e.g., "The Ordinance's \
original table shows X, but this has been superseded by the Finance Act 2026, which \
sets the rate at Y.").
- For any question involving tax rates, slabs, or thresholds, actively check whether \
BOTH the Ordinance and Finance Act appear in the context before answering — if only \
one appears but the topic is rate-related, say so and note the answer may be incomplete.
- This is an informational tool, not tax advice. Do not present answers as final \
authoritative tax advice — encourage the user to verify with a tax consultant or \
FBR directly for their specific situation.

Context:
{context}
"""

USER_PROMPT = "{question}"


def get_vectorstore():
    print("Connecting to Pinecone index...")
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    vectorstore = PineconeVectorStore(index_name=INDEX_NAME, embedding=embeddings)
    print("Connected.")
    return vectorstore


def format_docs(docs):
    formatted = []
    for doc in docs:
        source = doc.metadata.get("source", "unknown")
        page = doc.metadata.get("page", "?")
        formatted.append(f"[Source: {source}, page {page}]\n{doc.page_content}")
    return "\n\n---\n\n".join(formatted)


def build_chain(vectorstore):
    retriever = vectorstore.as_retriever(search_kwargs={"k": TOP_K})

    llm = ChatGroq(model=LLM_MODEL, temperature=0)

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", USER_PROMPT),
    ])

    chain = (
        {"context": retriever | format_docs, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    return chain, retriever


def ask(chain, question: str) -> str:
    return chain.invoke(question)


def run_test_questions(chain, questions):
    print(f"\nRunning {len(questions)} test questions...\n")
    results = []
    for q in tqdm(questions, desc="Asking questions", unit="q"):
        answer = ask(chain, q)
        results.append((q, answer))
    return results


if __name__ == "__main__":
    vectorstore = get_vectorstore()
    chain, retriever = build_chain(vectorstore)

    test_questions = [
        "What is the income tax slab for a salaried person earning 1,200,000 rupees annually?",
        "Do I need to file a wealth statement along with my income tax return?",
        "What happens if I miss the income tax filing deadline?",
        "What is withholding tax on salary under Section 149?",
    ]

    results = run_test_questions(chain, test_questions)

    print("\n" + "=" * 80)
    for question, answer in results:
        print(f"\nQ: {question}\n")
        print(f"A: {answer}\n")
        print("-" * 80)