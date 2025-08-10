import logging
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from langchain_community.document_loaders import PyPDFLoader
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma


# Chat App
class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    def _make_hash_value(self, user, timestamp):
        """
        Custom hash value for email verification tokens. It includes the user's primary key,
        the timestamp, and the `is_active` field to invalidate old tokens when the user's status changes.
        """
        return f"{user.pk}{timestamp}{user.is_active}"


# Create an instance of the token generator
email_verification_token = EmailVerificationTokenGenerator()


# Upload Document App UTILS
# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load Embedding Model
# embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-mpnet-base-v2")
embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L12-v2")


def store_embeddings_in_chroma(pdf_path, collection_name):
    """
    Extracts text from a PDF, generates embeddings, and stores them in ChromaDB.
    """
    try:
        # Load PDF and Extract Text
        loader = PyPDFLoader(pdf_path)
        documents = loader.load()

        if not documents:
            logger.error("No text extracted from PDF.")
            return

        #  Generate embeddings
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        splits = text_splitter.split_documents(documents)

        Chroma.from_documents(documents=splits, embedding=embedding_model, persist_directory='./chat_with_pdf', collection_name=collection_name)
        logger.info(f"Document stored successfully in ChromaDB for {collection_name}")

    except Exception as e:
        logger.error(f" Error storing embeddings: {e}", exc_info=True)
