import os
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rag_engine import (
    build_index_from_file,
    ask_question,
    get_faiss_index,
)


# =========================================================
# App Configuration
# =========================================================

app = FastAPI(
    title="RAG AI Agent",
    version="1.0.0"
)


# =========================================================
# Paths
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

UPLOADS_DIR = BASE_DIR / "uploads"

# Create uploads folder automatically
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# Request Models
# =========================================================

class AskRequest(BaseModel):
    question: str
    history: list = []


# =========================================================
# Health Check
# =========================================================

@app.get("/")
async def root():
    return {
        "message": "RAG AI Agent API is running",
        "status": "online"
    }


# =========================================================
# PDF Upload
# =========================================================

@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):

    try:
        # -------------------------------------------------
        # Validate file type
        # -------------------------------------------------

        if file.content_type != "application/pdf":
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only PDF files are allowed."
            )


        # -------------------------------------------------
        # Read file
        # -------------------------------------------------

        content = await file.read()


        # -------------------------------------------------
        # Validate file size
        # -------------------------------------------------

        MAX_SIZE = 10 * 1024 * 1024  # 10 MB

        if len(content) > MAX_SIZE:
            raise HTTPException(
                status_code=400,
                detail="File too large. Maximum size is 10MB."
            )


        if len(content) == 0:
            raise HTTPException(
                status_code=400,
                detail="Uploaded PDF is empty."
            )


        # -------------------------------------------------
        # Secure filename
        # -------------------------------------------------

        filename = Path(file.filename).name

        if not filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail="Only PDF files are allowed."
            )


        # -------------------------------------------------
        # Save PDF
        # -------------------------------------------------

        file_path = UPLOADS_DIR / filename

        with open(file_path, "wb") as f:
            f.write(content)


        # -------------------------------------------------
        # Build FAISS index
        # -------------------------------------------------

        chunk_count = build_index_from_file(str(file_path))


        # -------------------------------------------------
        # Response
        # -------------------------------------------------

        return {
            "message": "PDF uploaded and processed successfully",
            "filename": filename,
            "size": len(content),
            "chunks_indexed": chunk_count
        }


    except HTTPException:
        raise


    except Exception as e:
        print(f"Upload error: {e}")

        raise HTTPException(
            status_code=500,
            detail=f"Error processing PDF: {str(e)}"
        )


# =========================================================
# Ask Question
# =========================================================

@app.post("/ask")
async def ask(request: AskRequest):

    try:

        question = request.question.strip()

        if not question:
            raise HTTPException(
                status_code=400,
                detail="Question cannot be empty."
            )


        # Check whether FAISS index exists
        index = get_faiss_index()

        if index.ntotal == 0:
            return {
                "answer": "Please upload a PDF first so I can answer questions from it.",
                "sources": []
            }


        # Ask RAG engine
        answer, sources = ask_question(
            question,
            k=4
        )


        return {
            "answer": answer,
            "sources": sources
        }


    except HTTPException:
        raise


    except Exception as e:

        print(f"Ask error: {e}")

        raise HTTPException(
            status_code=500,
            detail=f"Error answering question: {str(e)}"
        )


# =========================================================
# Status
# =========================================================

@app.get("/status")
async def status():

    try:

        index = get_faiss_index()

        return {
            "status": "online",
            "index_size": index.ntotal,
            "has_index": index.ntotal > 0
        }

    except Exception as e:

        return {
            "status": "online",
            "index_size": 0,
            "has_index": False,
            "error": str(e)
        }

