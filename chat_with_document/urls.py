from django.urls import path
from django.contrib.auth import views as auth_views
from . import views
from .views import upload_document, list_documents, delete_document, start_chat, chat_with_document, chat_interface, chat_history

urlpatterns = [
    # Welcome
    path('', views.welcome_view, name='welcome'),
    # User registration and authentication
    path("register/", views.register, name="register"),  # User registration
    path("login/", auth_views.LoginView.as_view(template_name="login.html"), name="login"),  # Login
    path("logout/", views.logout_view, name="logout"),  # Logout
    path("index/", views.index, name="index"),  # Homepage

    # Email activation
    path("activate/<uidb64>/<token>/", views.activate, name="activate"),  # Email activation link

    # Password reset functionality
    path("password-reset/", auth_views.PasswordResetView.as_view(template_name="password_reset.html"), name="password_reset"),  # Password reset
    path("password-reset/done/", auth_views.PasswordResetDoneView.as_view(template_name="password_reset_done.html"), name="password_reset_done"),  # Password reset confirmation message
    path("password-reset-confirm/<uidb64>/<token>/", auth_views.PasswordResetConfirmView.as_view(template_name="password_reset_confirm.html"), name="password_reset_confirm"),  # Password reset form
    path("password-reset-complete/", auth_views.PasswordResetCompleteView.as_view(template_name="password_reset_complete.html"), name="password_reset_complete"),  # Password reset complete message

    # Profile Section
   # path("profile/", views.profile, name="profile"),  # Profile overview
    path("profile/update-username/", views.update_username, name="update-username"),  # Update username
    path("profile/change-password/", views.change_password, name="change_password"),  # Change password


    # Upload Documents URLS
    path('upload/', upload_document, name='upload_document'),
    path('list/', list_documents, name='list_documents'),
    path('list/delete/<uuid:doc_id>', delete_document, name='delete_document'),



    # Rag Chat URLS
    path('session/<uuid:document_id>/', start_chat, name='start_chat'),
    path("chat/<uuid:session_id>/", views.chat_with_document, name="chat_with_document"),
    path('chat-interface/<uuid:session_id>/', chat_interface, name='chat_interface'),
    path('chat-history/<uuid:session_id>/', views.chat_history, name='chat_history'),
    path('start-chat/<uuid:document_id>/', views.start_chat, name='start_chat'),
]