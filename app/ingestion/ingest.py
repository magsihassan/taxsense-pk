import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone, ServerlessSpec

# Resolve project root so script works whether executed from root or app/ingestion
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

RAW_DOCS_DIR = PROJECT_ROOT / "data" / "raw_docs"
INDEX_NAME = "tax-assistant"

def load_documents():
    docs = []
    for pdf_path in RAW_DOCS_DIR.glob("*.pdf"):
        loader = PyPDFLoader(str(pdf_path))
        loaded = loader.load()
        for doc in loaded:
            doc.metadata["source"] = pdf_path.name
        docs.extend(loaded)
        print(f"Loaded {len(loaded)} pages from {pdf_path.name}")
    return docs

def chunk_documents(docs):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    chunks = splitter.split_documents(docs)
    print(f"Created {len(chunks)} chunks")
    return chunks

def setup_pinecone_index(pc):
    if INDEX_NAME not in [i.name for i in pc.list_indexes()]:
        pc.create_index(
            name=INDEX_NAME,
            dimension=384,  # matches bge-small-en embedding size
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1")
        )
        print(f"Created index: {INDEX_NAME}")
    else:
        print(f"Index {INDEX_NAME} already exists")

def main():
    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    setup_pinecone_index(pc)

    embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-small-en-v1.5")

    docs = load_documents()
    chunks = chunk_documents(docs)

    print("Embedding and uploading to Pinecone...")
    PineconeVectorStore.from_documents(
        documents=chunks,
        embedding=embeddings,
        index_name=INDEX_NAME
    )
    print("Done. Documents are now searchable.")

if __name__ == "__main__":
    main()