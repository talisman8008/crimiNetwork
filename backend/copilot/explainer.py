"""
Phase 10 & 11 -- LLM Explainer & RAG.

Takes retrieved context and user query, formats prompt, and calls LLM.
This module only produces the answer text; the grounded structure around it
(sources, referenced entities, confidence) is assembled by copilot/rag.py
from the retriever's metadata -- the model is never asked to invent it.
"""

# Use OpenAI by default, fallback to Gemini if provided
from openai import AsyncOpenAI
import google.generativeai as genai
from config import OPENAI_API_KEY, GEMINI_API_KEY

# The exact refusal sentence the prompt instructs the model to use.
REFUSAL_ANSWER = "I do not have enough information in the case files to answer this."


async def generate_explanation(query: str, context: str) -> str:
    """
    Calls the LLM with the context and user query.
    """
    prompt = f"""
    You are an AI assistant for criminal investigators. Answer the user's question 
    using ONLY the provided context from the case files and graph database.
    If the context does not contain the answer, say "{REFUSAL_ANSWER}"
    
    Grounding rules:
    - Only state facts that appear in the context below.
    - When a fact comes from a document, cite its source file name in brackets,
      e.g. [report.pdf]. Only cite source files that appear in the context.
    - Refer to people, organizations, and other entities by the exact names
      used in the context.
    
    Context:
    {context}
    
    Question: {query}
    
    Answer:
    """

    if OPENAI_API_KEY:
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        try:
            response = await client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error calling OpenAI API: {e}"

    elif GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-pro')
        try:
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            return f"Error calling Gemini API: {e}"

    else:
        return "Error: No LLM API key configured (OPENAI_API_KEY or GEMINI_API_KEY)."