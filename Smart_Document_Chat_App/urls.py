from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from django.conf import settings
from chat_with_document import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('chat_with_document.urls')),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)


handler400 = lambda request, exception: views.custom_error_view(request, exception, status_code=400)
handler403 = lambda request, exception: views.custom_error_view(request, exception, status_code=403)
handler404 = lambda request, exception: views.custom_error_view(request, exception, status_code=404)
handler500 = views.custom_error_view