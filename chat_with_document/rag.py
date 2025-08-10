import os
import sys
import yaml
import logging
import pytz
import datetime
from django.conf import settings
from langchain_groq import ChatGroq
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from .models import ChatMessage
from langchain_chroma import Chroma
from .utils import embedding_model

# Setup Logging
IST = pytz.timezone('Asia/Kolkata')
LOG_FILE = f"{datetime.datetime.now(IST).strftime('%m_%d_%Y_%H_%M_%S')}.log"
logs_path = os.path.join(settings.BASE_DIR, "logs")
os.makedirs(logs_path, exist_ok=True)
LOG_FILE_PATH = os.path.join(logs_path, LOG_FILE)

for handler in logging.root.handlers[:]:
    logging.root.removeHandler(handler)

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(lineno)d %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE_PATH),
        logging.StreamHandler(sys.stdout)
    ]
)


def get_retriever(collection_name):
    try:
        vectorstore = Chroma(
            persist_directory="./chat_with_pdf",
            collection_name=collection_name,
            embedding_function=embedding_model
        )
        retriever = vectorstore.as_retriever(
            search_type="mmr", search_kwargs={"k": 7}
        )
        logging.info(f"Retriever initialized for collection: {collection_name}")
        return retriever
    except Exception as e:
        logging.error(f"ChromaDB Retrieval Error: {e}")
        return None


def get_rag_chain(retriever):
    """
    Create the RAG-based response generation chain.
    """
    logging.info("Creating conversational RAG chain")
    llm = ChatGroq(model="llama-3.3-70b-versatile")
    with open("./system_prompt.yaml", "r") as file:
        system_prompt = yaml.safe_load(file)
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])
    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    rag_chain = create_retrieval_chain(retriever, question_answer_chain)
    logging.info("Conversational RAG chain created successfully")
    return rag_chain


logger = logging.getLogger(__name__)


def process_user_question(question, collection_name, chat_session=None):
    try:
        retriever = get_retriever(collection_name)

        if not retriever:
            return "Error: Could not retrieve document embeddings."

        logger.info(f"Retriever initialized for collection: {collection_name}")
        logger.info("Creating conversational RAG chain")

        # Generate response
        rag_chain = get_rag_chain(retriever)
        response = rag_chain.invoke({"input": question})

        if not response or "answer" not in response:
            logging.error("RAG Model failed to return a response.")
            return "Error: No response from RAG model."

        formatted_response = response['answer'].replace('\n', '<br>')  # Ensure the response is properly formatted (e.g., HTML or Markdown)

        # Save the message if chat_session is provided
        if chat_session:
            ChatMessage.objects.create(
                session=chat_session,
                user_message=question,
                bot_response=formatted_response  # Save the formatted response
            )

        return formatted_response

    except Exception as e:
        logger.error(f"RAG Processing Error: {str(e)}", exc_info=True)
        return "I'm sorry, I encountered an error processing your question. Please try again."
