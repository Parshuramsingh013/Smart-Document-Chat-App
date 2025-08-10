from django import forms
from .models import CustomUser
from django.contrib.auth.forms import UserCreationForm
from .models import UploadDocument


# Chat App
class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = CustomUser
        fields = ['username', 'email', 'password1', 'password2']

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if CustomUser.objects.filter(email=email).exists():
            raise forms.ValidationError("A user with this email already exists.")
        return email


# Upload Document
class DocumentUploadForm(forms.ModelForm):
    class Meta:
        model = UploadDocument
        fields = ['file']
        widgets = {
            'file': forms.FileInput(attrs={'class': 'form-control'})
        }
