from datetime import timezone
import json
import logging
from django import forms
from django.urls import reverse
from django.conf import settings
from django.contrib import messages
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import get_user_model
from django.contrib.auth import logout
from django.contrib.auth.decorators import login_required
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes
from .utils import email_verification_token
from django.contrib.auth.forms import PasswordChangeForm
from .forms import DocumentUploadForm
from .utils import store_embeddings_in_chroma
from django.http import JsonResponse
from .models import ChatMessage, ChatSession, UploadDocument
from django.views.decorators.csrf import csrf_exempt
from .rag import process_user_question
from django.contrib.auth.models import User
from django.utils import timezone  # Ensure correct import

logger = logging.getLogger(__name__)


# <----------------------------------- Chat App Views------------------------------------------->
# Get the custom user model
User = get_user_model()

# Custom registration form with email uniqueness validation


class CustomUserCreationForm(forms.ModelForm):
    password1 = forms.CharField(
        label="Password", widget=forms.PasswordInput, required=True
    )
    password2 = forms.CharField(
        label="Confirm Password", widget=forms.PasswordInput, required=True
    )
    email = forms.EmailField(required=True, help_text="A valid email address is required.")

    class Meta:
        model = User
        fields = ["username", "email", "password1", "password2"]

    def clean_email(self):
        email = self.cleaned_data.get("email")
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError("A user with this email address already exists.")
        return email

    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get("password1")
        password2 = cleaned_data.get("password2")
        if password1 and password2 and password1 != password2:
            raise forms.ValidationError("Passwords do not match.")
        return cleaned_data


# User registration view
def register(request):
    if request.method == "POST":
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data["password1"])  # Set the user's password
            user.is_active = False  # Set user as inactive until verified
            user.save()

            # Generate email verification token
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = email_verification_token.make_token(user)
            verification_url = request.build_absolute_uri(
                reverse("activate", kwargs={"uidb64": uid, "token": token})
            )

            # Send verification email
            subject = "Verify Your Email Address"
            message = (
                f"Hi {user.username},\n\n"
                f"Click the link below to verify your email and activate your account:\n"
                f"{verification_url}\n\n"
                f"If you did not register, please ignore this email."
            )
            from_email = settings.DEFAULT_FROM_EMAIL
            recipient_list = [user.email]
            send_mail(subject, message, from_email, recipient_list)

            messages.success(
                request,
                "Registration successful! Please verify your email to activate your account.",
            )
            return redirect("login")
        else:
            messages.error(request, "Registration failed. Please correct the errors below.")
    else:
        form = CustomUserCreationForm()
    return render(request, "register.html", {"form": form})


# Email activation view
def activate(request, uidb64, token):
    try:
        # Decode the user ID from the URL
        uid = urlsafe_base64_decode(uidb64).decode()
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    # Check if the token is valid
    if user is not None and email_verification_token.check_token(user, token):
        user.is_active = True  # Activate the user
        user.save()
        messages.success(request, "Your email has been verified. You can now log in.")
        return redirect("login")
    else:
        messages.error(request, "Email verification link is invalid or has expired.")
        return redirect("register")


@login_required
def index(request):
    if request.method == "POST":
        form = DocumentUploadForm(request.POST, request.FILES)
        if form.is_valid():
            document = form.save(commit=False)
            document.user = request.user
            document.collection_name = f"collection_{document.id}"
            document.status = "processing"
            document.save()

            try:
                store_embeddings_in_chroma(document.file.path, document.collection_name)
                document.status = "completed"
            except Exception as e:
                document.status = "failed"
                logger.error(f"Error processing document {document.id}: {e}", exc_info=True)

            document.save()

            # Return JSON response for AJAX calls
            if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                return JsonResponse({
                    'success': True,
                    'document': {
                        'id': str(document.id),
                        'name': document.file.name  # you may apply your custom filter if needed
                    }
                })
            else:
                return redirect('index')
        else:
            messages.error(request, "Upload failed. Please check the errors.")
    else:
        form = DocumentUploadForm()
    documents = UploadDocument.objects.filter(user=request.user, deleted=False).order_by("-uploaded_at")
    chat_session = ChatSession.objects.filter(user=request.user).order_by('-created_at').first()
    return render(request, "index.html", {"documents": documents, "form": form, 'chat_session': chat_session})


# Profile view

# Update username
@login_required
def update_username(request):
    if request.method == "POST":
        new_username = request.POST.get("new_username")

        # Validate the new username
        if not new_username:
            return JsonResponse({
                'success': False,
                'message': 'New username cannot be empty.'
            })

        if User.objects.filter(username=new_username).exists():
            return JsonResponse({
                'success': False,
                'message': 'This username is already taken.'
            })
        else:
            # Update the username
            request.user.username = new_username
            request.user.save()
            return JsonResponse({
                'success': True,
                'message': 'Your username has been updated successfully!'
            })

    return render(request, "update_username.html", {"current_username": request.user.username})


# Change password
@login_required
def change_password(request):
    if request.method == "POST":
        form = PasswordChangeForm(request.user, request.POST)
        if form.is_valid():
            user = form.save()
            # Send confirmation email
            subject = "Your Password has been Changed"
            message = (
                f"Hi {request.user.username},\n\n"
                f"Your password was successfully changed. If you did not initiate this change, please contact support immediately.\n"
            )
            from_email = settings.DEFAULT_FROM_EMAIL
            recipient_list = [request.user.email]
            send_mail(subject, message, from_email, recipient_list)

            messages.success(request, "Your password has been updated successfully!")
            return redirect("index")
    else:
        form = PasswordChangeForm(request.user)

    return render(
        request,
        "change_password.html",
        {
            "form": form,
            "current_username": request.user.username,
        },
    )


# Logout view
def logout_view(request):
    logout(request)
    return redirect("login")


# <--------------------------------------------Upload Documents ----------------------------------------------->
logger = logging.getLogger(__name__)


@login_required
def upload_document(request):
    """Handles document upload with AJAX support"""
    if request.method == "POST":
        form = DocumentUploadForm(request.POST, request.FILES)

        if form.is_valid():
            document = form.save(commit=False)
            document.user = request.user
            document.collection_name = f"collection_{document.id}"
            document.status = "processing"
            document.save()

            try:
                # Generate embeddings and store in ChromaDB
                store_embeddings_in_chroma(document.file.path, document.collection_name)
                document.status = "completed"
            except Exception as e:
                document.status = "failed"
                logger.error(f"Error processing document {document.id}: {e}", exc_info=True)

            document.save()
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'success': True})
            else:
                return redirect('index')
        else:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'success': False, 'error': form.errors})
    else:
        form = DocumentUploadForm()

    return render(request, "upload.html", {"form": form})


@login_required
def list_documents(request):
    """Lists all user-uploaded documents."""
    documents = UploadDocument.objects.filter(user=request.user, deleted=False).order_by("-uploaded_at")
    return render(request, "index.html", {"documents": documents})


@login_required
def delete_document(request, doc_id):
    """Soft deletes a document and removes its embeddings from ChromaDB."""
    document = get_object_or_404(UploadDocument, id=doc_id, user=request.user)
    if request.method == 'POST':
        document.delete()
        return redirect('index')
    return render(request, "index", {'document': document})


# <-------------------------------------RAg Chat Views------------------------------------------------------->
@login_required
def start_chat(request, document_id):
    try:
        document = get_object_or_404(UploadDocument, id=document_id, user=request.user)
        
        # Check if document is processed
        if document.status != 'completed':
            return JsonResponse({
                'success': False,
                'error': 'Document is not ready for chat'
            }, status=400)
        
        # Get or create chat session
        chat_session, created = ChatSession.objects.get_or_create(
            user=request.user,
            document=document,
            defaults={'status': 'active'}
        )
        
        return JsonResponse({
            'success': True,
            'session_id': str(chat_session.id),
            'document_name': document.file.name
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@login_required
def chat_with_document(request, session_id):
    if request.method == 'POST':
        try:
            session = get_object_or_404(ChatSession, id=session_id, user=request.user)
            data = json.loads(request.body)
            message = data.get('message')
            
            # Get the document from the session
            document = session.document
            
            # Process message using RAG and pass the session
            response = process_user_question(message, document.collection_name, session)
            
            # Save the chat message
            ChatMessage.objects.create(
                session=session,
                user_message=message,
                bot_response=response
            )
            
            return JsonResponse({'bot_response': response})
        except Exception as e:
            logger.error(f"Chat Error: {str(e)}", exc_info=True)
            return JsonResponse({
                'error': 'Failed to process message',
                'bot_response': 'Sorry, I encountered an error processing your message.'
            })
    
    return JsonResponse({'error': 'Invalid request method'}, status=405)


@csrf_exempt
@login_required
def chat_with_document(request, session_id):
    if request.method == 'POST':
        data = json.loads(request.body)
        message = data.get('message')
        
        session = get_object_or_404(ChatSession, id=session_id, user=request.user)
        
        # Process the message using your RAG system
        response = process_user_question(message, session.document.collection_name)
        
        # Save the chat message
        ChatMessage.objects.create(
            session=session,
            user_message=message,
            bot_response=response
        )
        
        return JsonResponse({'bot_response': response})
    
    return JsonResponse({'error': 'Invalid request method'}, status=405)


@login_required
def chat_interface(request, session_id):
    chat_session = get_object_or_404(ChatSession, id=session_id, user=request.user)
    document = chat_session.document
    
    # Get chat history
    messages = ChatMessage.objects.filter(session=chat_session).order_by("timestamp")
    
    context = {
        "chat_session": chat_session,
        "document": document,
        "messages": messages,
    }
    
    return render(request, 'index.html', context)


@login_required
def chat_history(request, session_id):
    try:
        session = get_object_or_404(ChatSession, id=session_id, user=request.user)
        messages = ChatMessage.objects.filter(session=session).order_by('timestamp')
        
        chat_history = []
        for msg in messages:
            # Add user message
            if msg.user_message:
                chat_history.append({
                    'sender': 'User',
                    'text': msg.user_message
                })
            # Add bot response
            if msg.bot_response:
                chat_history.append({
                    'sender': 'Bot',
                    'text': msg.bot_response  # Ensure the response is properly formatted
                })
        
        return JsonResponse({'messages': chat_history})
    except Exception as e:
        logger.error(f"Error fetching chat history: {str(e)}")
        return JsonResponse({'messages': []})



# from django.shortcuts import render
from django.utils.timezone import now

def custom_error_view(request, exception=None, status_code=500):
    """
    Unified custom error view for handling 400, 403, 404, and 500 errors.
    """
    error_context = {
        400: {
            'error_code': '400',
            'error_title': 'Bad Request',
            'error_message': 'The server could not understand your request. Please check your input and try again.',
        },
        403: {
            'error_code': '403',
            'error_title': 'Access Denied',
            'error_message': 'You don\'t have permission to access this resource.',
        },
        404: {
            'error_code': '404',
            'error_title': 'Page Not Found',
            'error_message': 'Oops! The page you\'re looking for is not here.',
        },
        500: {
            'error_code': '500',
            'error_title': 'Server Error',
            'error_message': 'We\'re experiencing some technical difficulties. Please try again later.',
        }
    }

    context = error_context.get(status_code, error_context[500])
    context.update({
        'current_year': now().year,
        'return_url': '/login/',
        'return_text': 'Go Back to Login Page' if status_code == 404 else None,
    })

    return render(request, 'errors/error.html', context, status=status_code)


def welcome_view(request):
    """
    Display the welcome page for non-authenticated users.
    Redirect to index if user is already authenticated.
    """
    if request.user.is_authenticated:
        return redirect('index')
    return render(request, 'welcome.html')
