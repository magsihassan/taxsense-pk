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
TOP_K = 3


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
        and procedures. Call this tool AT MOST ONCE per user question. Do NOT
        use this for calculating tax amounts — use calculate_income_tax for that."""
        docs = retriever.invoke(query)
        formatted = []
        for doc in docs:
            source = doc.metadata.get("source", "Income Tax Ordinance 2001")
            page = doc.metadata.get("page", "?")
            content = doc.page_content.strip()[:1000]
            formatted.append(f"[Source: {source}, page {page}]\n{content}")
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


SYSTEM_PROMPT = """You are TaxSense PK, an authoritative statutory advisory assistant for Pakistani salaried income tax rules.

Core Statutory Knowledge:
- Tax Year 2025-26: Covers July 1, 2025 to June 30, 2026. Annual return and wealth statement filing deadline is September 30, 2026 (Section 118(2)(b) of Income Tax Ordinance 2001).
- Tax Year 2026-27: Covers July 1, 2026 to June 30, 2027. Filing deadline is September 30, 2027.
- Wealth Statement (Section 116): Mandatory to file alongside the annual income tax return for individuals filing returns or as notified by FBR.
- Salary Tax Withholding (Section 149): Employers deduct tax in 12 monthly installments based on expected annual taxable income.

Rules:
- For questions about tax LAW, RULES, DEADLINES, or REQUIREMENTS: Call search_tax_documents AT MOST ONCE to fetch official text, then formulate your final answer. Do NOT invoke search_tax_documents in a repetitive loop.
- For questions that require CALCULATING a tax amount: use the calculate_income_tax tool. Never compute tax math yourself.
- Always cite the statutory source (e.g. Section 118, Section 116, Income Tax Ordinance 2001, Finance Act 2026).
- If information isn't fully available in the retrieved text, state what is established by the Ordinance clearly and advise verification via the FBR Iris portal.
- This is an informational tool, not tax advice. Always remind the user to verify with a licensed tax consultant or FBR directly for their specific circumstances.

Output Structure & Presentation Rules:
Structure every response cleanly and authoritatively using the following layout:
1. ### Topic / Provision Title
2. Direct Verdict (Callout Block):
   Start immediately with a blockquote providing a direct, concise 1-2 sentence conclusion:
   > **Direct Answer:** [Clear, unambiguous conclusion or Yes/No answer with primary legal rationale]
3. Statutory Provisions (Clean Markdown Table):
   When citing laws, provisions, or comparative rules, summarize them in a structured table:
   | Statutory Provision | Prescription / Rule | Compliance Obligation |
   |---|---|---|
4. Key Conditions & Practical Rules:
   Use bullet points with bold prefixes (e.g., `- **Threshold:** ...`, `- **Deadline:** ...`, `- **Prescribed Form:** ...`, `- **Late Penalty:** ...`).
5. Calculation Breakdown (When computing tax amounts):
   Provide an itemized breakdown showing Gross Salary, Non-taxable Base, Applicable Slab Rate, Total Annual Tax, and Monthly Withholding.
6. Keep language objective, professional, and well-spaced. Avoid unformatted walls of text.
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