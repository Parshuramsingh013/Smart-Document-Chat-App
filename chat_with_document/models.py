from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid
from Smart_Document_Chat_App import settings


# Chat App
class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']  # Remove email from REQUIRED_FIELDS

    def __str__(self):
        return self.email


# Upload Docuemnt App
class BaseModel(models.Model):
    deleted = models.BooleanField(default=False)

    class Meta:
        abstract = True

    def delete(self):
        self.deleted = True
        self.save()


class BaseModelManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted=False)



class UploadDocument(BaseModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    file = models.FileField(upload_to="documents/")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    collection_name = models.CharField(max_length=255, unique=True, blank=True, null=True)
    processed = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=[("pending", "Pending"), ("processed", "Processed"), ("error", "Error")], default="pending")

    def save(self, *args, **kwargs):
        if not self.collection_name:
            self.collection_name = f"collection_{self.id}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.file.name} uploaded by {self.user.username}"


#     Rag Chat App

# Chat Session Model
class ChatSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    document = models.ForeignKey('UploadDocument', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(max_length=20, default='active', choices=[
        ('active', 'Active'),
        ('ended', 'Ended'),
    ])

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Chat {self.id} - {self.document.file.name}"


# Chat Messages Model (Stores Chat History)
class ChatMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    user_message = models.TextField()
    bot_response = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"ChatMessage {self.id} - Session {self.session.id}"
