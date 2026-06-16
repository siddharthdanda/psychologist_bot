from fastapi import FastAPI, HTTPException, Header, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import os

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Psyche AI Backend API",
    description="Backend API for the Agentic ADHD Assessment chatbot.",
    version="1.0.0"
)

# Enable CORS so external frontends can call these endpoints
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Update this with specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the static directory
os.makedirs("static", exist_ok=True)

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    persona: str = "Dr. Focus: ADHD Assessment"

class AgenticResponse(BaseModel):
    internal_analysis: str = Field(description="Your clinical reasoning based on the user's latest message.")
    adhd_suspicion_level: str = Field(description="Current suspicion of ADHD: 'Low', 'Medium', or 'High'.")
    next_action_strategy: str = Field(description="Brief strategy for the next message (e.g., 'Deep Dive into Hyperactivity', 'Screen for Anxiety', 'Wrap Up').")
    suggest_early_end: bool = Field(description="True if you have conclusive data (ADHD or not) and the assessment should end.")
    message_to_user: str = Field(description="The actual empathetic, conversational text sent back to the user.")

# Pre-defined system prompts for the personas
ADHD_PROMPT = """You are an empathetic, professional AI Psychologist conducting a dynamic conversational ADHD assessment. 
You act as an autonomous agent. Your goal is to assess the likelihood of ADHD by asking relevant questions naturally, but you must think before you speak.

You MUST follow this strategic flow:
1. **Initial Assessment**: Start broad. Ask about their struggles with focus, organization, or restlessness.
2. **Dynamic Branching**: 
   - If the user shows HIGH inclination towards ADHD traits (e.g., severe distraction, lifelong fidgeting), deep dive into specific DSM-5 criteria (Hyperactivity, Impulsivity, Childhood History).
   - If the user shows LOW inclination towards ADHD traits (e.g., they only mention recent stress or poor sleep), PIVOT to brief differential screening (ask about sleep, anxiety, or recent life changes). Do NOT blindly ask all 15 ADHD questions if they clearly don't fit.
3. **Early Exit**: If you determine you have enough information to confidently conclude whether ADHD is likely or not likely, set `suggest_early_end` to True and politely inform the user that you have enough information to generate their report.

Rules for `message_to_user`:
- Be empathetic and conversational.
- Ask exactly ONE question per response.
- Do not list multiple questions.
- If you are setting `suggest_early_end` to True, clearly state in your message that they can click "Generate Report" when they are ready.

Use the `internal_analysis` to reason about the user's symptoms, decide if they match ADHD patterns, and plan your `next_action_strategy`. Then write your final response in `message_to_user`."""

REPORT_PROMPT = """You are a clinical psychologist analyzing the transcript of an ADHD assessment conversation between an AI Psychologist and a user.
Your task is to synthesize the user's responses into a structured, professional clinical summary report.
The report should evaluate the presence of ADHD symptoms based on the DSM-5 criteria discussed in the conversation.

Format the output as a Markdown document with the following sections:
1. **Assessment Summary**: A brief overview of the user's primary concerns and reasons for seeking the assessment.
2. **Inattention Criteria**: Summarize any reported struggles with sustained attention, task completion, forgetfulness, organization, and time management.
3. **Hyperactivity & Impulsivity Criteria**: Summarize any reported symptoms of physical restlessness, fidgeting, inner tension, or impulsive actions/decisions.
4. **Functional Impact**: Describe how these symptoms are affecting the user's daily life, work, school, or relationships.
5. **Clinical Impression**: Your overall professional observation based on the conversation. State clearly that this is an AI-generated analysis and NOT a formal medical diagnosis.

Only output the markdown report. Do not include conversational filler."""

PERSONAS = {
    "Dr. Focus: ADHD Assessment": ADHD_PROMPT
}

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    # Initialize the LangChain model
    try:
        chat = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.7)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    # Construct the message history
    langchain_messages = []
    
    # 1. Add System Message
    system_prompt = PERSONAS.get(request.persona, PERSONAS["Dr. Focus: ADHD Assessment"])
    langchain_messages.append(SystemMessage(content=system_prompt))
    
    # 2. Add history
    for msg in request.messages:
        if msg.role == "user":
            langchain_messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            langchain_messages.append(AIMessage(content=msg.content))
            
    # 3. Generate structured response
    try:
        agent = chat.with_structured_output(AgenticResponse)
        response = agent.invoke(langchain_messages)
        return {
            "response": response.message_to_user,
            "internal_analysis": response.internal_analysis,
            "suggest_early_end": response.suggest_early_end
        }
    except Exception as e:
        # If API key is invalid or other error
        raise HTTPException(status_code=500, detail=f"LLM Error: {str(e)}")

@app.post("/api/report")
async def report_endpoint(request: ChatRequest):
    try:
        chat = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    langchain_messages = []
    
    # Add System Message for reporting
    langchain_messages.append(SystemMessage(content=REPORT_PROMPT))
    
    # Add the conversation history as context
    conversation_text = ""
    for msg in request.messages:
        role = "User" if msg.role == "user" else "Dr. Focus"
        conversation_text += f"{role}: {msg.content}\n\n"
        
    langchain_messages.append(HumanMessage(content=f"Please analyze the following conversation transcript and generate a clinical report:\n\n{conversation_text}"))
    
    try:
        response = chat.invoke(langchain_messages)
        return {"report": response.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Error during report generation: {str(e)}")

# Serve the index.html on the root path
@app.get("/")
async def read_index():
    index_path = os.path.join("static", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "index.html not found in static folder."}

app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
