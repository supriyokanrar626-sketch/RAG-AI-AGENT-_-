# RAG AI AGENT — PDF Intelligence with Gemini + FAISS

> Upload any PDF and chat with it. Retrieval-Augmented Generation (RAG) powered by **Gemini 2.0 Flash**, **FAISS**, and **Sentence Transformers**.

A full-stack RAG dashboard with a dark glassmorphism UI — drag & drop PDF, auto chunking, vector indexing, and grounded Q&A with page citations.

[RAG](https://img.shields.io/badge/RAG-Enabled-blue) [Gemini](https://img.shields.io/badge/LLM-Gemini%202.0%20Flash-8E75FF) [FAISS](https://img.shields.io/badge/Vector%20DB-FAISS-00BFFF) [FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)

---

## ✨ Features

- **PDF Upload & OCR** — PyMuPDF text extraction with progress beam animation
- **Smart Chunking** — Recursive text splitter (1000 chars / 200 overlap) with page tracking
- **Local Vector Store** — FAISS `IndexFlatL2` + `chunks.json` (no ChromaDB needed)
- **Embeddings** — `sentence-transformers/all-MiniLM-L6-v2` (384-dim, fast & free)
- **LLM** — Google Gemini 2.0 Flash (`gemini-2.0-flash`) — free tier 60 RPM  [[ 3.6 flash U can use ]]
- **Grounded Answers** — Only answers from document context, with Page citations
- **Beautiful UI** — Tailwind dashboard, glass panel, drag & drop, chat history
- **No Rate Limit Hell** — Migrated from Mistral (1 RPM) to Gemini (60 RPM)

---

## 🏗️ Architecture

```
PDF -> PyMuPDF -> recursive_split_text (1000/200) -> SentenceTransformer (384d)
     -> FAISS Index (faiss_index.bin) + Metadata (chunks.json)
User Question -> Embedding -> FAISS Top-K Search (k=4)
             -> Context [Page X] -> Gemini 2.0 Flash -> Answer + Sources
```

**Storage:**
- `backend/faiss_index.bin` — binary vectors (auto-generated)
- `backend/chunks.json` — text, page_number, source_file

No ChromaDB, no external DB server needed.

---

## 📁 Project Structure

```
pdf-ai/
├── backend/
│   ├── main.py              # FastAPI: /upload-pdf, /ask, /status
│   ├── rag_engine.py        # FAISS + Gemini logic
│   ├── requirements.txt
│   ├── .env                 # GEMINI_API_KEY=...
│   ├── uploads/             # temp PDF storage (gitignored)
│   ├── faiss_index.bin      # generated (gitignored)
│   └── chunks.json          # generated (gitignored)
├── frontend/
│   └── app.js
└── index.html           # RAG Dashboard UI (Tailwind)  
└── README.md
 
```

---

## 🚀 Quick Start

### 1. Clone & Venv

```bash
git clone My repo...🍂
cd pdf-ai/backend

python -m venv .venv
# Windows
.venv\Scripts\activate
# Mac/Linux
source .venv/bin/activate
```

### 2. Install

```bash
pip install -r requirements.txt
# requirements.txt should contain:
# fastapi uvicorn python-multipart
# PyMuPDF faiss-cpu sentence-transformers
# python-dotenv google-generativeai numpy
```

If `google-generativeai` fails:
```bash
pip install google-generativeai
```

### 3. Env Setup

Create `backend/.env`:

```
GEMINI_API_KEY=AIzaSy...your_key_here
```

Get free key: https://aistudio.google.com/app/apikey

### 4. Run Backend

```bash
cd backend
uvicorn main:app --port 8000 --host 0.0.0.0 --reload
```

You should see:
```
RAG AI AGENT - GEMINI MODE
GEMINI API KEY: LOADED
Uvicorn running on http://0.0.0.0:8000
```

Test:
- http://localhost:8000/docs  (Swagger)
- http://localhost:8000/status

 <img width="1920" height="1080" alt="Screenshot (100)" src="https://github.com/user-attachments/assets/2ac67665-ef13-43b3-a874-3d04bfbd2387" />


 
<img width="1920" height="1080" alt="Screenshot (99)" src="https://github.com/user-attachments/assets/0c8775fa-d836-40d5-95ed-16975ab3e13c" />


### 5. Run Frontend

Just open `frontend/index.html` with VS Code **Live Server** or:

```bash
cd frontend
python -m http.server 5500
# open http://localhost:5500
```

---

## ⚙️ Configuration (rag_engine.py)

```python
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"  # 384 dim
GEMINI_MODEL = "gemini-2.0-flash"  # valid: gemini-2.0-flash, gemini-1.5-flash-latest, gemini-2.5-flash
```

If you get 404 model not found:
- Change to `gemini-1.5-flash-latest` or `gemini-2.5-flash`
- List available models:

```python
import google.generativeai as genai, os
from dotenv import load_dotenv
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
for m in genai.list_models():
  if "generateContent" in m.supported_generation_methods:
    print(m.name)
```

---

## 🧹 Maintenance

**Delete cache / re-index:**
```bash
cd backend
Remove-Item -Recurse -Force __pycache__
Remove-Item -Force faiss_index.bin, chunks.json
# Then re-upload PDF
```

**Test script (optional):**
```python
# tests/test_api.py
import requests
resp = requests.get("http://localhost:8000/status")
print(resp.json())

with open("test_sample.pdf","rb") as f:
  resp = requests.post("http://localhost:8000/upload-pdf", files={"file": f})
  print(resp.text)

resp = requests.post("http://localhost:8000/ask", json={"question":"What is this about?","history":[]})
print(resp.json()["answer"])
```

---

## 🙈 .gitignore (minimal)

```
.env
__pycache__/
*.bin
chunks.json
uploads/
.venv/
*.pdf
test_*.py
tests/
node_modules/
```

> Do NOT push `.env`, `faiss_index.bin`, `chunks.json`, `uploads/`, `*.pdf`

---

## 🐛 Common Issues

| Error | Fix |
|-------|-----|
| `cannot import name 'build_index_from_file'` | Delete `backend/__pycache__/` |
| `MISTRAL_API_KEY NOT FOUND` / `429 Rate limit` | You are on old Mistral code. Use Gemini version (`GEMINI_API_KEY`) |
| `404 models/gemini-1.5-flash is not found` | Model name wrong. Use `gemini-2.0-flash` |
| `faiss_index.bin not found` | Upload a PDF first |
| Backend not running in frontend | Check `API_BASE = http://localhost:8000` in `index.html` |

---

## 📜 Prompt Used

System prompt in `rag_engine.py`:

```
You are a Retrieval-Augmented Generation (RAG) AI Agent.
Answer ONLY using document context.
If not present, say: "Information not found in document."
Mention page number when possible.
```

---

## 📄 License

MIT — Free to use for portfolio / learning.

---

## 👤 Author

Built by you — RAG AI Agent v2.4 Active
Stack: FastAPI + FAISS + Gemini 2.0 Flash + Tailwind

**Future Ideas:**
- [ ] Add ChromaDB / Qdrant option
- [ ] Multi-PDF chat
- [ ] Streaming answers
- [ ] Auth & user uploads
