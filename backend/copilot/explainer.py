"""
Phase 10 & 11 -- LLM Explainer & RAG.

Takes retrieved context and user query, formats prompt, and calls LLM.
"""

import os
from .retriever import gather_context

# Use OpenAI by default, fallback to Gemini if provided
from openai import AsyncOpenAI
import google.generativeai as genai
from config import OPENAI_API_KEY, GEMINI_API_KEY


async def generate_explanation(query: str, context: str) -> str:
    """
    Calls the LLM with the context and user query.
    """
    prompt = f"""
    You are an AI assistant for criminal investigators. Answer the user's question 
    using ONLY the provided context from the case files and graph database.
    If the context does not contain the answer, say "I do not have enough information in the case files to answer this."
    
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

        
async def ask_copilot(query: str, case_id: str) -> str:
    """Main entrypoint for Copilot QA."""
    # 1. Retrieve
    context = await gather_context(query, case_id)
    
    # 2. Generate
    answer = await generate_explanation(query, context)
    
    return answer
