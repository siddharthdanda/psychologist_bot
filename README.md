# Psyche AI

An AI-powered Psychologist Backend for an Agentic ADHD Assessment chatbot. This application leverages FastAPI and LangChain with Google's Gemini 2.5 Flash to create an empathetic, conversational, and autonomous assessment agent. It dynamically asks relevant questions based on user input, tracks ADHD suspicion levels, and can generate a structured clinical summary report.

## Features

- **Agentic Assessment Chatbot**: A dynamic conversation that adapts based on user responses to assess ADHD likelihood.
- **FastAPI Backend**: High-performance backend API serving endpoints for chat interactions and report generation.
- **Clinical Report Generation**: Automatically synthesizes the conversation transcript into a professional clinical report modeled after DSM-5 criteria.
- **Static File Serving**: Serves frontend web files directly from the `static/` directory.

## Prerequisites

- Python 3.8+
- Google Gemini API Key

## Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone <your_repository_url>
   cd Psychologist ai
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   *(Note: You may also need to install `langchain-google-genai` and `python-dotenv` if they are not yet updated in requirements.txt).*

3. **Environment Configuration:**
   Create a `.env` file in the root of the project and add your Google API Key:
   ```env
   GOOGLE_API_KEY=your_gemini_api_key_here
   ```

## Running the Application

You can start the FastAPI application using Uvicorn:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Or simply run the main script directly:
```bash
python main.py
```

The server will start locally. You can access:
- **Application:** `http://localhost:8000`
- **Swagger Interactive API Docs:** `http://localhost:8000/docs`
- **ReDoc API Docs:** `http://localhost:8000/redoc`

## API Endpoints

- `POST /api/chat`: 
  Accepts a `ChatRequest` containing the message history and persona. Returns the chatbot's response, an internal clinical analysis, and a flag (`suggest_early_end`) if enough information has been gathered.
- `POST /api/report`: 
  Accepts the full chat history and generates a comprehensive Markdown report summarizing the inattention, hyperactivity, and impulsivity criteria.

## Project Structure

- `main.py`: The core FastAPI application containing routing, LangChain LLM setup, and predefined agent personas (e.g., "Dr. Focus").
- `requirements.txt`: Python package dependencies.
- `static/`: Contains static frontend web files (e.g., `index.html`).
- `.env`: Contains environment variables such as API keys.
