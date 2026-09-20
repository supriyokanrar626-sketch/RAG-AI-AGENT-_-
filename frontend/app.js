// =========================================================
// RAG AI Agent - Frontend Logic
// =========================================================

const API_BASE = "http://localhost:8000";

// =========================================================
// DOM Elements
// =========================================================

const uploadArea = document.getElementById("upload-area");
const uploadContent = document.getElementById("upload-content");
const processing = document.getElementById("upload-processing");

const uploadProcessingText = document.getElementById(
    "upload-processing-text"
);

const fileNameDisplay = document.getElementById("file-name-display");
const fileSizeDisplay = document.getElementById("file-size-display");

const textPreview = document.getElementById("text-preview-card");
const textContent = document.getElementById("text-content");

const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-button");


// =========================================================
// State
// =========================================================

let currentFile = null;
let pdfText = "";


// =========================================================
// Helper - Check Backend
// =========================================================

async function checkBackend() {

    try {

        const response = await fetch(`${API_BASE}/status`);

        if (!response.ok) {
            throw new Error("Backend unavailable");
        }

        const data = await response.json();

        console.log("Backend status:", data);

        return true;

    } catch (error) {

        console.error("Backend connection error:", error);

        return false;
    }
}


// =========================================================
// Initialize
// =========================================================

document.addEventListener("DOMContentLoaded", async () => {

    console.log("RAG AI Agent frontend loaded");

    const savedPDFs = localStorage.getItem("pdf-ai-uploaded");

    if (savedPDFs) {
        console.log("Saved PDF information found");
    }

    await checkBackend();
});


// =========================================================
// PDF Upload - Click
// =========================================================

if (uploadArea) {

    uploadArea.addEventListener("click", () => {

        const input = document.createElement("input");

        input.type = "file";
        input.accept = "application/pdf,.pdf";

        input.addEventListener("change", (event) => {

            const file = event.target.files[0];

            if (file) {
                handleFileSelect(file);
            }

        });

        input.click();
    });


    // =====================================================
    // Drag Over
    // =====================================================

    uploadArea.addEventListener("dragover", (event) => {

        event.preventDefault();

        uploadArea.classList.add("border-primary/50");
        uploadArea.classList.add("bg-primary/5");
    });


    // =====================================================
    // Drag Leave
    // =====================================================

    uploadArea.addEventListener("dragleave", () => {

        uploadArea.classList.remove("border-primary/50");
        uploadArea.classList.remove("bg-primary/5");
    });


    // =====================================================
    // Drop
    // =====================================================

    uploadArea.addEventListener("drop", (event) => {

        event.preventDefault();

        uploadArea.classList.remove("border-primary/50");
        uploadArea.classList.remove("bg-primary/5");

        const file = event.dataTransfer.files[0];

        if (file) {
            handleFileSelect(file);
        }
    });
}


// =========================================================
// Handle PDF File
// =========================================================

async function handleFileSelect(file) {

    // -----------------------------------------------------
    // Validate file size
    // -----------------------------------------------------

    if (file.size > 10 * 1024 * 1024) {

        alert("File too large. Maximum 10MB allowed.");

        return;
    }


    // -----------------------------------------------------
    // Validate PDF
    // -----------------------------------------------------

    const isPDF =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

    if (!isPDF) {

        alert("Please select a PDF file.");

        return;
    }


    // -----------------------------------------------------
    // Save current file
    // -----------------------------------------------------

    currentFile = file;

    // -----------------------------------------------------
    // Show processing
    // -----------------------------------------------------

    showProcessingState(true);


    if (uploadProcessingText) {
        uploadProcessingText.textContent = "Uploading and processing PDF...";
    }


    // -----------------------------------------------------
    // FormData
    // -----------------------------------------------------

    const formData = new FormData();

    formData.append("file", file);


    try {

        console.log("Uploading:", file.name);


        // -------------------------------------------------
        // Upload PDF to backend
        // -------------------------------------------------

        const response = await fetch(
            `${API_BASE}/upload-pdf`,
            {
                method: "POST",
                body: formData
            }
        );


        // -------------------------------------------------
        // Parse response
        // -------------------------------------------------

        const data = await response.json();

        console.log("Upload response:", data);


        // -------------------------------------------------
        // Backend error
        // -------------------------------------------------

        if (!response.ok) {

            throw new Error(
                data.detail || "PDF upload failed."
            );
        }


        // -------------------------------------------------
        // Upload successful
        // -------------------------------------------------

        showUploadedFile(data);


        // -------------------------------------------------
        // Show PDF information
        // -------------------------------------------------

        showTextPreviewMessage(
            file,
            data.chunks_indexed
        );


        // -------------------------------------------------
        // Save information
        // -------------------------------------------------

        localStorage.setItem(
            "pdf-ai-uploaded",
            JSON.stringify({
                filename: data.filename,
                size: data.size,
                chunks_indexed: data.chunks_indexed
            })
        );


        // -------------------------------------------------
        // Stop processing
        // -------------------------------------------------

        showProcessingState(false);

        console.log("PDF processed successfully.");

    } catch (error) {

        console.error("PDF Upload Error:", error);

        showProcessingState(false);

        alert(
            error.message ||
            "Connection error. Is the backend running?"
        );
    }
}


// =========================================================
// Processing State
// =========================================================

function showProcessingState(isProcessing) {

    if (!uploadContent || !processing) {
        return;
    }


    if (isProcessing) {

        uploadContent.classList.add("opacity-0");

        processing.classList.remove("opacity-0");
        processing.classList.add("opacity-100");

    } else {

        uploadContent.classList.remove("opacity-0");

        processing.classList.remove("opacity-100");
        processing.classList.add("opacity-0");
    }
}


// =========================================================
// Show Uploaded PDF
// =========================================================

function showUploadedFile(data) {

    if (!uploadContent) {
        return;
    }


    uploadContent.innerHTML = `

        <div
            class="w-16 h-16 rounded-full
            bg-surface-container-highest
            flex items-center justify-center
            text-primary
            shadow-sm"
        >

            <span
                class="material-symbols-outlined text-3xl"
            >
                check_circle
            </span>

        </div>


        <div class="text-center mt-sm">

            <p
                class="font-body-md text-body-md
                text-on-surface mb-xs"
            >
                PDF uploaded successfully
            </p>


            <p
                class="font-label-sm text-label-sm
                text-on-surface-variant"
            >
                ${data.chunks_indexed || 0} chunks indexed
            </p>


            <p
                class="font-label-sm text-label-sm
                text-primary mt-1"
            >
                ${escapeHTML(data.filename)}
            </p>

        </div>
    `;
}


// =========================================================
// Format Bytes
// =========================================================

function formatBytes(bytes) {

    if (!bytes || bytes === 0) {
        return "0 bytes";
    }


    if (bytes < 1024) {

        return `${bytes} bytes`;
    }


    if (bytes < 1024 * 1024) {

        return `${(bytes / 1024).toFixed(1)} KB`;
    }


    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


// =========================================================
// Text Preview
// =========================================================
//
// IMPORTANT:
// Browser cannot use file.path.
// Your current backend does not have a text extraction
// endpoint.
//
// So for now we show processing information here.
// Later we can add /extract-text endpoint.
// =========================================================

function showTextPreviewMessage(file, chunkCount) {

    if (!textContent) {
        return;
    }


    pdfText = "";


    textContent.innerHTML = `

        <div class="space-y-3">

            <div class="text-primary">
                <span class="material-symbols-outlined align-middle mr-1">
                    check_circle
                </span>

                PDF processed successfully.
            </div>


            <div class="text-on-surface-variant">

                <strong class="text-on-surface">
                    File:
                </strong>

                ${escapeHTML(file.name)}

            </div>


            <div class="text-on-surface-variant">

                <strong class="text-on-surface">
                    Size:
                </strong>

                ${formatBytes(file.size)}

            </div>


            <div class="text-on-surface-variant">

                <strong class="text-on-surface">
                    Chunks indexed:
                </strong>

                ${chunkCount || 0}

            </div>


            <div
                class="mt-4 p-3 rounded
                bg-surface-container-low
                border border-outline-variant/20"
            >

                The PDF has been indexed successfully.

                You can now ask questions about
                the uploaded document.

            </div>

        </div>
    `;


    if (textPreview) {

        textPreview.classList.remove("hidden");
        textPreview.classList.add("block");
    }
}


// =========================================================
// Chat - Send Button
// =========================================================

if (sendBtn) {

    sendBtn.addEventListener(
        "click",
        sendMessage
    );
}


// =========================================================
// Chat - Enter Key
// =========================================================

if (chatInput) {

    chatInput.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();
            }
        }
    );
}


// =========================================================
// Send Message
// =========================================================

async function sendMessage() {

    if (!chatInput) {
        return;
    }


    const question = chatInput.value.trim();


    // -----------------------------------------------------
    // Empty question
    // -----------------------------------------------------

    if (!question) {
        return;
    }


    // -----------------------------------------------------
    // Add user message
    // -----------------------------------------------------

    addMessage(
        question,
        "user"
    );


    // -----------------------------------------------------
    // Clear input
    // -----------------------------------------------------

    chatInput.value = "";


    // -----------------------------------------------------
    // Disable input
    // -----------------------------------------------------

    chatInput.disabled = true;

    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.classList.add("opacity-50");
    }


    // -----------------------------------------------------
    // Show Thinking
    // -----------------------------------------------------

    const loadingDiv = showChatLoading();


    try {

        console.log(
            "Sending question:",
            question
        );


        // -------------------------------------------------
        // Ask backend
        // -------------------------------------------------

        const response = await fetch(
            `${API_BASE}/ask`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    question: question,
                    history: []
                })
            }
        );


        // -------------------------------------------------
        // Parse JSON
        // -------------------------------------------------

        const data = await response.json();


        console.log(
            "RAG Response:",
            data
        );


        // -------------------------------------------------
        // Remove Thinking
        // -------------------------------------------------

        hideChatLoading(
            loadingDiv
        );


        // -------------------------------------------------
        // HTTP error
        // -------------------------------------------------

        if (!response.ok) {

            throw new Error(
                data.detail ||
                data.error ||
                `Server error: ${response.status}`
            );
        }


        // -------------------------------------------------
        // Backend returned error
        // -------------------------------------------------

        if (data.error) {

            addMessage(
                `Error: ${data.error}`,
                "bot"
            );

            return;
        }


        // -------------------------------------------------
        // No answer
        // -------------------------------------------------

        if (!data.answer) {

            addMessage(
                "Sorry, I could not generate an answer.",
                "bot"
            );

            return;
        }


        // -------------------------------------------------
        // Show AI Answer
        // -------------------------------------------------

        addMessage(
            data.answer,
            "bot",
            data.sources || []
        );


    } catch (error) {

        console.error(
            "RAG Error:",
            error
        );


        // -------------------------------------------------
        // Remove Thinking
        // -------------------------------------------------

        hideChatLoading(
            loadingDiv
        );


        // -------------------------------------------------
        // Show error in chat
        // -------------------------------------------------

        addMessage(
            `Sorry, I couldn't process your question.

Error: ${error.message}`,
            "bot"
        );


    } finally {

        // -------------------------------------------------
        // Enable input
        // -------------------------------------------------

        chatInput.disabled = false;


        if (sendBtn) {

            sendBtn.disabled = false;

            sendBtn.classList.remove(
                "opacity-50"
            );
        }


        chatInput.focus();
    }
}


// =========================================================
// Add Chat Message
// =========================================================

function addMessage(
    text,
    type,
    sources = []
) {

    if (!chatMessages) {
        return;
    }


    const msgDiv =
        document.createElement("div");


    msgDiv.className =
        `flex gap-md max-w-[85%] ${
            type === "user"
                ? "self-end flex-row-reverse"
                : ""
        }`;


    // -----------------------------------------------------
    // Avatar
    // -----------------------------------------------------

    const avatar =
        document.createElement("div");


    avatar.className =
        `w-8 h-8 rounded-full ${
            type === "user"
                ? "bg-primary-container text-on-primary-container"
                : "bg-primary/20 border border-primary/30"
        } flex items-center justify-center shrink-0`;


    avatar.innerHTML =
        type === "user"

            ? `
                <span
                    class="material-symbols-outlined text-sm"
                >
                    person
                </span>
              `

            : `
                <span
                    class="material-symbols-outlined
                    text-primary text-sm"
                >
                    smart_toy
                </span>
              `;


    // -----------------------------------------------------
    // Bubble
    // -----------------------------------------------------

    const bubble =
        document.createElement("div");


    if (type === "user") {

        bubble.className =
            "bg-primary-container text-on-primary-container " +
            "rounded-xl rounded-tr-sm p-md shadow-sm";

    } else {

        bubble.className =
            "bg-[#222226] border border-[#2A2A2E] " +
            "rounded-xl rounded-tl-sm p-md shadow-sm";
    }


    // -----------------------------------------------------
    // Answer
    // -----------------------------------------------------

    const answerHTML =
        parseMarkdown(text);


    // -----------------------------------------------------
    // Sources
    // -----------------------------------------------------

    let sourceCitation = "";


    if (
        Array.isArray(sources) &&
        sources.length > 0
    ) {

        sourceCitation = `

            <div class="flex flex-wrap gap-2 mt-3">

                ${sources
                    .map((source) => {

                        const page =
                            source.page ??
                            source.page_number ??
                            "?";

                        return `
                            <span
                                class="
                                bg-[#131316]
                                rounded
                                px-2 py-1
                                font-mono
                                text-xs
                                text-secondary/80
                                border
                                border-outline-variant/20
                                "
                            >
                                Page ${page}
                            </span>
                        `;
                    })
                    .join("")}

            </div>
        `;
    }


    // -----------------------------------------------------
    // Bubble HTML
    // -----------------------------------------------------

    bubble.innerHTML = `

        <div
            class="
            font-body-lg
            text-body-lg
            text-on-surface
            leading-relaxed
            "
        >
            ${answerHTML}
        </div>

        ${sourceCitation}
    `;


    // -----------------------------------------------------
    // Add to DOM
    // -----------------------------------------------------

    msgDiv.appendChild(avatar);

    msgDiv.appendChild(bubble);

    chatMessages.appendChild(msgDiv);


    // -----------------------------------------------------
    // Scroll
    // -----------------------------------------------------

    chatMessages.scrollTop =
        chatMessages.scrollHeight;
}


// =========================================================
// Markdown Parser
// =========================================================

function parseMarkdown(text) {

    if (
        text === null ||
        text === undefined
    ) {

        return "No answer received.";
    }


    text = String(text);


    // Escape HTML first
    text = escapeHTML(text);


    // Bold
    text = text.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );


    // Bullet points
    text = text.replace(
        /^[-•]\s+(.*)$/gm,
        "• $1"
    );


    // Numbered lists
    text = text.replace(
        /^(\d+)\.\s+(.*)$/gm,
        "$1. $2"
    );


    // New lines
    text = text.replace(
        /\n/g,
        "<br>"
    );


    return text;
}


// =========================================================
// Thinking / Loading Message
// =========================================================

function showChatLoading() {

    if (!chatMessages) {
        return null;
    }


    const loadingDiv =
        document.createElement("div");


    loadingDiv.className =
        "flex gap-md max-w-[85%]";


    loadingDiv.innerHTML = `

        <div
            class="
            w-8 h-8
            rounded-full
            bg-primary/20
            border border-primary/30
            flex items-center
            justify-center
            shrink-0
            "
        >

            <span
                class="
                material-symbols-outlined
                text-primary
                text-sm
                "
            >
                smart_toy
            </span>

        </div>


        <div
            class="
            bg-[#222226]
            border border-[#2A2A2E]
            rounded-xl
            rounded-tl-sm
            p-md
            shadow-sm
            "
        >

            <p
                class="
                font-body-lg
                text-body-lg
                text-on-surface
                mb-sm
                "
            >
                Thinking...
            </p>


            <div
                class="
                bg-[#131316]
                rounded
                p-sm
                font-mono
                text-mono
                text-secondary/80
                border
                border-outline-variant/20
                "
            >
                Status: Processing question.
            </div>

        </div>
    `;


    chatMessages.appendChild(
        loadingDiv
    );


    chatMessages.scrollTop =
        chatMessages.scrollHeight;


    // IMPORTANT
    // Return loading element
    return loadingDiv;
}


// =========================================================
// Hide Thinking
// =========================================================

function hideChatLoading(
    loadingDiv
) {

    if (
        loadingDiv &&
        loadingDiv.parentNode
    ) {

        loadingDiv.parentNode.removeChild(
            loadingDiv
        );
    }
}


// =========================================================
// HTML Escape
// =========================================================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =========================================================
// Auto Scroll
// =========================================================

if (chatMessages) {

    const observer =
        new MutationObserver(() => {

            chatMessages.scrollTop =
                chatMessages.scrollHeight;
        });


    observer.observe(
        chatMessages,
        {
            childList: true
        }
    );
}