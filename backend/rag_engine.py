import os
import json
from pathlib import Path

import fitz  # PyMuPDF
import numpy as np
import faiss

from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
import google.generativeai as genai


# =========================================================
# Environment
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

# Load .env from backend folder
load_dotenv(BASE_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "").strip() # backward compat

# Configure Gemini
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    print("=" * 60)
    print("RAG AI AGENT - GEMINI MODE")
    print("=" * 60)
    print("GEMINI API KEY: LOADED")
    print("=" * 60)
else:
    print("=" * 60)
    print("RAG AI AGENT")
    print("=" * 60)
    print("GEMINI API KEY: NOT FOUND - Add GEMINI_API_KEY to .env")
    print("=" * 60)


# =========================================================
# Paths
# =========================================================

UPLOADS_DIR = BASE_DIR / "uploads"
FAISS_INDEX_PATH = BASE_DIR / "faiss_index.bin"
CHUNKS_PATH = BASE_DIR / "chunks.json"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


# =========================================================
# Configuration
# =========================================================

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
GEMINI_MODEL = "gemini-3.6-flash"  # Free tier e best, fast


# =========================================================
# Global State
# =========================================================

_embedding_model = None
_faiss_index = None
_chunks = []


# =========================================================
# Embedding Model
# =========================================================

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        print("Loading embedding model...")
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        print("Embedding model loaded.")
    return _embedding_model


# =========================================================
# Load Chunks Metadata
# =========================================================

def load_chunks():
    global _chunks
    if _chunks:
        return _chunks
    if CHUNKS_PATH.exists():
        try:
            with open(CHUNKS_PATH, "r", encoding="utf-8") as f:
                _chunks = json.load(f)
            print(f"Loaded {len(_chunks)} chunks from disk.")
        except Exception as e:
            print(f"Failed to load chunks.json: {e}")
            _chunks = []
    return _chunks


# =========================================================
# FAISS Index
# =========================================================

def get_faiss_index():
    global _faiss_index
    if _faiss_index is None:
        dimension = 384
        if FAISS_INDEX_PATH.exists():
            try:
                _faiss_index = faiss.read_index(str(FAISS_INDEX_PATH))
                print(f"FAISS index loaded. Vectors: {_faiss_index.ntotal}")
            except Exception as e:
                print(f"Failed to load FAISS index: {e}")
                _faiss_index = faiss.IndexFlatL2(dimension)
        else:
            _faiss_index = faiss.IndexFlatL2(dimension)
    return _faiss_index


# =========================================================
# Recursive Text Splitter
# =========================================================

def recursive_split_text(text, chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP):
    if not text or not text.strip():
        return []
    chunks = []
    start = 0
    text_length = len(text)
    separators = ["\n\n", "\n", " ", ""]
    while start < text_length:
        end = min(start + chunk_size, text_length)
        if end >= text_length:
            chunk = text[start:].strip()
            if chunk:
                chunks.append(chunk)
            break
        chunk_end = end
        for separator in separators:
            if separator == "":
                chunk_end = end
                break
            position = text.rfind(separator, start, end)
            if position > start:
                chunk_end = position + len(separator)
                break
        chunk = text[start:chunk_end].strip()
        if chunk:
            chunks.append(chunk)
        next_start = max(chunk_end - chunk_overlap, start + 1)
        if next_start <= start:
            next_start = chunk_end
        start = next_start
    return chunks


# =========================================================
# PDF Extraction
# =========================================================

def load_and_extract_pdf(filepath):
    doc = fitz.open(filepath)
    pages = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        page_text = page.get_text().strip()
        if page_text:
            pages.append({"page_number": page_num + 1, "text": page_text})
    doc.close()
    return pages


# =========================================================
# Chunk PDF
# =========================================================

def chunk_text_with_pages(filepath):
    pages = load_and_extract_pdf(filepath)
    all_chunks = []
    chunk_id = 0
    for page in pages:
        page_number = page["page_number"]
        page_text = page["text"]
        page_chunks = recursive_split_text(page_text, CHUNK_SIZE, CHUNK_OVERLAP)
        for chunk in page_chunks:
            all_chunks.append({
                "id": chunk_id,
                "text": chunk,
                "page_number": page_number,
                "source_file": os.path.basename(filepath)
            })
            chunk_id += 1
    return all_chunks


# =========================================================
# Build FAISS Index
# =========================================================

def build_index_from_file(filepath):
    global _faiss_index
    global _chunks
    print("=" * 60)
    print("BUILDING RAG INDEX")
    print("=" * 60)
    _chunks = chunk_text_with_pages(filepath)
    print(f"Total chunks: {len(_chunks)}")
    if not _chunks:
        raise ValueError("No readable text found in the PDF.")
    model = get_embedding_model()
    texts = [chunk["text"] for chunk in _chunks]
    print("Generating embeddings...")
    embeddings = model.encode(texts, show_progress_bar=True)
    embeddings = np.asarray(embeddings, dtype=np.float32)
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings)
    _faiss_index = index
    faiss.write_index(index, str(FAISS_INDEX_PATH))
    with open(CHUNKS_PATH, "w", encoding="utf-8") as f:
        json.dump(_chunks, f, ensure_ascii=False, indent=2)
    print(f"FAISS index saved: {index.ntotal} vectors")
    print(f"Chunks saved: {CHUNKS_PATH}")
    print("=" * 60)
    return len(_chunks)


# =========================================================
# Similarity Search
# =========================================================

def search_similar_chunks(question, k=4):
    index = get_faiss_index()
    chunks = load_chunks()
    if not chunks or index.ntotal == 0:
        return []
    model = get_embedding_model()
    question_embedding = model.encode([question])
    question_embedding = np.asarray(question_embedding, dtype=np.float32)
    k = min(k, index.ntotal)
    distances, indices = index.search(question_embedding, k)
    results = []
    for idx, distance in zip(indices[0], distances[0]):
        if idx < 0 or idx >= len(chunks):
            continue
        results.append({"chunk": chunks[idx], "distance": float(distance)})
    return results


# =========================================================
# GEMINI API - REPLACES MISTRAL
# =========================================================

def generate_mistral_answer(question, context):
    """Kept same function name so main.py doesn't need change, but uses Gemini inside"""
    if not GEMINI_API_KEY:
        return (
            "GEMINI_API_KEY is not configured. "
            "Please add your Gemini API key to the .env file. Get free key from https://aistudio.google.com/app/apikey"
        )

    system_prompt = """
You are a Retrieval-Augmented Generation (RAG) AI Agent.

Your job is to answer the user's question ONLY using
the information provided in the document context.

Rules:
1. Do not use outside knowledge.
2. Do not invent information.
3. If the answer is not present in the context, say exactly: "Information not found in document."
4. Give a clear and concise answer.
5. When possible, mention the relevant page number.
6. Treat the provided context as the only source of truth.
"""

    user_prompt = f"""
DOCUMENT CONTEXT:
{context}

USER QUESTION:
{question}

Answer the question using ONLY the document context.
"""

    try:
        model = genai.GenerativeModel(
            GEMINI_MODEL,
            system_instruction=system_prompt
        )
        
        response = model.generate_content(
            user_prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.2,
                max_output_tokens=800,
            )
        )
        
        # Handle blocked responses
        if not response.candidates:
            return "Information not found in document."
            
        return response.text.strip()

    except Exception as e:
        print(f"Gemini API Error: {e}")
        # Fallback: return context if API fails, so UI doesn't break
        if "quota" in str(e).lower() or "429" in str(e):
            return f"Gemini quota exceeded, but here is the relevant text from your PDF:\n\n{context[:1500]}"
        return f"Error generating AI answer: {str(e)}"


# =========================================================
# Ask Question
# =========================================================

def ask_question(question, k=4):
    question = question.strip()
    if not question:
        return ("Please enter a question.", [])

    results = search_similar_chunks(question, k=k)
    if not results:
        return ("Information not found in document.", [])

    context_parts = []
    sources = []
    for result in results:
        chunk = result["chunk"]
        page_number = chunk["page_number"]
        chunk_text = chunk["text"]
        context_parts.append(f"[Page {page_number}]\n{chunk_text}")
        sources.append({
            "page": page_number,
            "snippet": (chunk_text[:200] + "..." if len(chunk_text) > 200 else chunk_text)
        })

    context = "\n\n".join(context_parts)
    answer = generate_mistral_answer(question, context)
    return answer, sources
