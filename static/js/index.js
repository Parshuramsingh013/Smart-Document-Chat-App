// State Management Functions
function saveState(documentId, documentName, sessionId) {
    localStorage.setItem('chatState', JSON.stringify({
        documentId: documentId,
        documentName: documentName,
        sessionId: sessionId,
        isActive: true
    }));
}

function clearState() {
    localStorage.removeItem('chatState');
}

function restoreState() {
    const state = JSON.parse(localStorage.getItem('chatState'));
    if (state && state.isActive) {
        return state;
    }
    return null;
}

document.addEventListener("DOMContentLoaded", function() {
    // Core elements
    const uploadSection = document.getElementById("upload-section");
    const chatSection = document.getElementById("chat-section");
    const sectionTitle = document.getElementById("section-title");
    const sectionIcon = document.getElementById("section-icon");
    const activeDocument = document.getElementById("active-document");
    const chatBox = document.getElementById("chat-messages");
    const inputField = document.getElementById("user-input");
    const sendButton = document.getElementById("send-btn");
    const uploadForm = document.getElementById("upload-form");
    const preloader = document.querySelector(".preloader");
    const successMessage = document.querySelector(".success-message");
    const fileUpload = document.getElementById('file-upload');
    const fileNameDisplay = document.getElementById('file-name-display');
    const modalFileUpload = document.getElementById('modal-file-upload');
    const modalFileNameDisplay = document.getElementById('modal-file-name-display');
    const modalPreloader = document.querySelector(".modal-preloader");
    const modalSuccessMessage = document.querySelector(".modal-success-message");
    const profileButton = document.getElementById('profileButton');
    const profileDropdown = document.getElementById('profileDropdown');
    const dragDropArea = document.getElementById('drag-drop-area');

    // profile
    profileButton.addEventListener('click', function(e) {
        profileDropdown.classList.toggle('show');
        e.stopPropagation();
    });
    
    // Close dropdown when clicking elsewhere on the page
    document.addEventListener('click', function(e) {
        if (!profileButton.contains(e.target)) {
            profileDropdown.classList.remove('show');
        }
    });

    // Handle file selection display for the main upload section
    fileUpload.addEventListener('change', function() {
        if (this.files.length > 0) {
            fileNameDisplay.textContent = this.files[0].name;
            fileNameDisplay.style.color = '#4f46e5';
        } else {
            fileNameDisplay.textContent = 'Click to upload';
            fileNameDisplay.style.color = '#4f46e5';
        }
    });

    // Handle file selection display for the modal upload section
    modalFileUpload.addEventListener('change', function() {
        if (modalFileUpload.files.length > 0) {
            modalFileNameDisplay.textContent = modalFileUpload.files[0].name;
            modalFileNameDisplay.style.color = '#4f46e5';
        } else {
            modalFileNameDisplay.textContent = "Click to upload";
            modalFileNameDisplay.style.color = '#4f46e5';
        }
    });

    // Drag-and-drop functionality
    dragDropArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        dragDropArea.classList.add('dragover');
    });

    dragDropArea.addEventListener('dragleave', function() {
        dragDropArea.classList.remove('dragover');
    });

    dragDropArea.addEventListener('drop', function(e) {
        e.preventDefault();
        dragDropArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileUpload.files = files;
            handleFileUpload();
        }
    });

    dragDropArea.addEventListener('click', function() {
        fileUpload.click();
    });

    fileUpload.addEventListener('change', function() {
        if (fileUpload.files.length > 0) {
            handleFileUpload();
        }
    });

    function handleFileUpload() {
        const file = fileUpload.files[0];
        if (file) {
            fileNameDisplay.textContent = file.name;
            fileNameDisplay.style.color = '#4f46e5';

            const formData = new FormData();
            formData.append('file', file);
            formData.append('csrfmiddlewaretoken', document.querySelector('[name=csrfmiddlewaretoken]').value);

            preloader.style.display = 'block';
            successMessage.style.display = 'none';

            fetch(uploadForm.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                preloader.style.display = 'none';
                if (data.success) {
                    successMessage.style.display = 'block';

                    // Remove "No documents uploaded yet." message if it exists
                    const noDocumentsMessage = document.querySelector('.no-documents-message');
                    if (noDocumentsMessage) {
                        noDocumentsMessage.remove();
                    }

                    // Dynamically add the new document to the history section
                    const docList = document.querySelector('.document-list');
                    const li = document.createElement('li');
                    li.classList.add('document-item', 'new-document-item'); // Add consistent class
                    li.setAttribute('data-document-id', data.document.id);
                    li.innerHTML = `
                        <div class="document-info">
                            <strong class="document-name" 
                                    data-document-id="${data.document.id}" 
                                    data-document-name="${cleanDocumentName(data.document.name)}">
                                ${cleanDocumentName(data.document.name)}
                            </strong>
                            <form action="/list/delete/${data.document.id}" method="POST" class="delete-form">
                                <input type="hidden" name="csrfmiddlewaretoken" value="${document.querySelector('[name=csrfmiddlewaretoken]').value}">
                                <button type="submit" class="delete-btn"><i class="fa-trash-alt fas"></i></button>
                            </form>
                        </div>
                    `;
                    docList.insertBefore(li, docList.firstChild);

                    // Add click event listener to the document name
                    const documentName = li.querySelector('.document-name');
                    documentName.addEventListener('click', function() {
                        startChat(data.document.id, cleanDocumentName(data.document.name));
                    });

                    // Attach delete handler
                    attachDeleteHandler(li.querySelector('.delete-form'));

                    // Automatically open chat for the uploaded document
                    startChat(data.document.id, cleanDocumentName(data.document.name));
                } else {
                    showCustomAlert('error', 'Upload Failed', 'Failed to upload document');
                }
            })
            .catch(error => {
                preloader.style.display = 'none';
                console.error('Error:', error);
                showCustomAlert('error', 'Upload Failed', 'Failed to upload document');
            });
        }
    }

    // Current session tracking
    let currentSessionId = null;

    // UI State Management
    function showUploadSection() {
        const uploadSection = document.getElementById("upload-section");
        const chatSection = document.getElementById("chat-section");
        const sectionTitle = document.getElementById("section-title");
        const sectionIcon = document.getElementById("section-icon");
        const activeDocument = document.getElementById("active-document");
        const fileNameDisplay = document.getElementById("file-name-display");

        // Reset UI states
        uploadSection.style.display = "block";
        chatSection.style.display = "none";
        sectionTitle.textContent = "Document Upload";
        sectionIcon.className = "fas fa-file-alt";
        activeDocument.textContent = "";

        // Reset drag-and-drop area
        fileNameDisplay.textContent = "Drag and drop your PDF file here";
        fileNameDisplay.style.color = "#4f46e5";

        // Reset the file input
        const fileUpload = document.getElementById("file-upload");
        fileUpload.value = "";

        // Hide preloader and success message
        document.querySelector(".preloader").style.display = "none";
        document.querySelector(".success-message").style.display = "none";
    }

    function showChatInterface(documentName, documentId) {
        uploadSection.style.display = 'none';
        chatSection.style.display = 'flex';
        chatSection.querySelector('.chat-container').style.display = 'flex';
        sectionTitle.textContent = 'Chat with Document';
        sectionIcon.className = 'fas fa-comments';
        activeDocument.textContent = documentName;

        const url = new URL(window.location.href);
        url.searchParams.set('chat', documentId);
        window.history.pushState({ chat: documentId }, '', url);

        setupMessageInputHandlers();
    }

    function startChat(documentId, documentName) {
        console.log('Starting chat for:', documentId, documentName);

        document.querySelectorAll('.document-list li').forEach(item => {
            item.classList.remove('active');
        });

        const currentItem = document.querySelector(`[data-document-id="${documentId}"]`);
        if (currentItem) {
            currentItem.closest('li').classList.add('active');
        }

        fetch(`/start-chat/${documentId}/`, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success || data.session_id) {
                currentSessionId = data.session_id || documentId;
                showChatInterface(documentName, documentId);
                loadChatHistory(currentSessionId);
                saveState(documentId, documentName, currentSessionId);
            } else {
                window.location.href = '/index/';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            window.location.href = '/index/';
        });
    }

    function loadChatHistory(sessionId) {
        chatBox.innerHTML = '';

        fetch(`/chat-history/${sessionId}/`)
            .then(response => response.json())
            .then(data => {
                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(msg => {
                        appendMessage(msg.sender, msg.text);
                    });
                    chatBox.scrollTop = chatBox.scrollHeight;
                }
            })
            .catch(error => console.error('Error loading chat history:', error));
    }

    function appendMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.style.justifyContent = sender === 'User' ? 'flex-end' : 'flex-start';

        const messageContent = document.createElement('div');
        messageContent.className = sender === 'User' ? 'user-message' : 'bot-message';
        messageContent.innerHTML = `<strong>${sender}:</strong> ${text}`;

        messageDiv.appendChild(messageContent);
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function sendMessage() {
        const message = inputField.value.trim();
        if (!message || !currentSessionId) return;

        appendMessage('User', message);
        inputField.value = '';

        fetch(`/chat/${currentSessionId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
            },
            body: JSON.stringify({ message: message })
        })
        .then(response => response.json())
        .then(data => {
            appendMessage('Bot', data.bot_response);
        })
        .catch(error => {
            console.error('Error:', error);
            appendMessage('Bot', 'Error: Unable to get response');
        });
    }

    function setupMessageInputHandlers() {
        sendButton.removeEventListener('click', sendMessage);
        inputField.removeEventListener('keypress', handleEnterKey);

        sendButton.addEventListener('click', sendMessage);
        inputField.addEventListener('keypress', handleEnterKey);
    }

    function handleEnterKey(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendMessage();
        }
    }

    function resetUploadForm() {
        uploadForm.reset();
        fileNameDisplay.textContent = 'Click to upload';
        fileNameDisplay.style.color = '#4f46e5';
        successMessage.style.display = 'none';
    }

    document.querySelectorAll('.document-name').forEach(name => {
        name.addEventListener('click', function() {
            const documentId = this.getAttribute('data-document-id');
            const documentName = this.getAttribute('data-document-name');
            if (documentId && documentName) {
                startChat(documentId, documentName);
            }
        });
    });

    document.getElementById('back-to-upload').addEventListener('click', function() {
        showCustomConfirm('Leave Chat', 'Are you sure you want to leave the chat?', function() {
            showUploadSection();
            clearState();
    
            // Update the URL to remove the chat query parameter
            const url = new URL(window.location.href);
            url.searchParams.delete('chat');
            window.history.pushState({}, '', url);
    
            // Remove active selection from the document list
            document.querySelectorAll('.document-list li').forEach(item => {
                item.classList.remove('active');
            });
        });
    });

    function attachDeleteHandler(form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const documentId = this.closest('li').getAttribute('data-document-id');
            const currentDocItem = this.closest('li');
            
            fetch(this.action, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                }
            })
            .then(response => {
                if (response.ok) {
                    // Get all document items before removing the current one
                    const allDocuments = Array.from(document.querySelectorAll('.document-list li'));
                    const currentIndex = allDocuments.indexOf(currentDocItem);
                    currentDocItem.remove();

                    const remainingDocuments = document.querySelectorAll('.document-list li');
                    
                    if (remainingDocuments.length === 0) {
                        // Case 3: Last document being deleted
                        showUploadSection();
                        clearState();
                        // Update URL
                        const url = new URL(window.location.href);
                        url.searchParams.delete('chat');
                        window.history.pushState({}, '', url);
                        
                        // Add the "No documents uploaded yet." message
                        const docList = document.querySelector('.document-list');
                        const noDocumentsMessage = document.createElement('li');
                        noDocumentsMessage.classList.add('no-documents-message');
                        noDocumentsMessage.innerHTML = '<p>No documents uploaded yet.</p>';
                        docList.appendChild(noDocumentsMessage);
                    } else {
                        // Find the document to switch to
                        let nextDoc;
                        if (currentIndex === 0) {
                            // Case 1: Top document being deleted, switch to new top
                            nextDoc = remainingDocuments[0];
                        } else {
                            // Case 2: Other document being deleted, switch to top document
                            nextDoc = remainingDocuments[0];
                        }

                        if (nextDoc) {
                            const nextDocId = nextDoc.getAttribute('data-document-id');
                            const nextDocName = nextDoc.querySelector('.document-name').getAttribute('data-document-name');
                            startChat(nextDocId, nextDocName);
                        }
                    }
                } else {
                    showCustomAlert('error', 'Delete Failed', 'Failed to delete document');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showCustomAlert('error', 'Delete Failed', 'Failed to delete document');
            });
        });
    }

    document.querySelectorAll('.delete-form').forEach(form => {
        attachDeleteHandler(form);
    });

    // Helper function to clean document names
    function cleanDocumentName(value) {
        // Remove the 'documents/' prefix
        value = value.replace('documents/', '');
        // Remove the unique suffix before the '.pdf' extension
        value = value.replace(/_[^_]+\.pdf$/, '.pdf');
        return value;
    }

    // Modify the uploadForm event listener to use the helper function
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        preloader.style.display = 'block';
        successMessage.style.display = 'none';
      
        const formData = new FormData(uploadForm);
        fetch(uploadForm.action, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            preloader.style.display = 'none';
            if (data.success) {
                successMessage.style.display = 'block';
                
                // Remove the "No documents uploaded yet." message if it exists
                const noDocumentsMessage = document.querySelector('.no-documents-message');
                if (noDocumentsMessage) {
                    noDocumentsMessage.remove();
                }

                // Dynamically update the history list with the new document
                const docList = document.querySelector('.document-list');
                const li = document.createElement('li');
                li.classList.add('document-item', 'new-document-item'); // Add the same class as server-rendered items and a specific class for the new document
                li.setAttribute('data-document-id', data.document.id);
                li.innerHTML = `
                    <div class="document-info">
                        <strong class="document-name" 
                                data-document-id="${data.document.id}" 
                                data-document-name="${cleanDocumentName(data.document.name)}">
                            ${cleanDocumentName(data.document.name)}
                        </strong>
                        <form action="/list/delete/${data.document.id}" method="POST" class="delete-form">
                            <input type="hidden" name="csrfmiddlewaretoken" value="${document.querySelector('[name=csrfmiddlewaretoken]').value}">
                            <button type="submit" class="delete-btn"><i class="fa-trash-alt fas"></i></button>
                        </form>
                    </div>
                `;
                li.querySelector('.document-name').addEventListener('click', function() {
                    startChat(data.document.id, cleanDocumentName(data.document.name));
                });

                // Attach a submit handler for the delete form
                attachDeleteHandler(li.querySelector('.delete-form'));

                // Prepend the new document to the list
                docList.insertBefore(li, docList.firstChild);
                
                // Automatically open chat for the uploaded document
                startChat(data.document.id, cleanDocumentName(data.document.name));
            } else {
                showCustomAlert('error', 'Upload Failed', 'Failed to upload document');
            }
        })
        .catch(error => {
            preloader.style.display = 'none';
            console.error('Error:', error);
            showCustomAlert('error', 'Upload Failed', 'Failed to upload document');
        });
    });

    const savedState = restoreState();
    if (window.location.href.includes("?chat=")) {
        if (savedState) {
            startChat(savedState.documentId, savedState.documentName);
        } else {
            startChat("defaultDocId", "Default Chat Document");
        }
    } else {
        clearState();
    }

    const modal = document.getElementById("upload-modal");
    const btn = document.getElementById("new-chat-btn");
    const span = document.getElementsByClassName("close")[0];
    const modalUploadForm = document.getElementById("modal-upload-form");

    // Remove modal handling for new chat button
    btn.onclick = function() {
        modalFileUpload.click();
    };

    modalFileUpload.addEventListener('change', function() {
        if (modalFileUpload.files.length > 0) {
            btn.innerHTML = '<i class="fa-spin fa-spinner fas"></i> Uploading...';
            btn.disabled = true;

            const formData = new FormData();
            formData.append('file', modalFileUpload.files[0]);
            formData.append('csrfmiddlewaretoken', document.querySelector('[name=csrfmiddlewaretoken]').value);

            fetch(modalUploadForm.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    btn.innerHTML = '<i class="fa-check-circle fas"></i> Uploaded!';
                    
                    // Remove "No documents" message if it exists
                    const noDocumentsMessage = document.querySelector('.no-documents-message');
                    if (noDocumentsMessage) {
                        noDocumentsMessage.remove();
                    }

                    // Update document list
                    const docList = document.querySelector('.document-list');
                    const li = document.createElement('li');
                    li.classList.add('document-item', 'new-document-item');
                    li.setAttribute('data-document-id', data.document.id);
                    li.innerHTML = `
                        <div class="document-info">
                            <strong class="document-name" 
                                    data-document-id="${data.document.id}" 
                                    data-document-name="${cleanDocumentName(data.document.name)}">
                                ${cleanDocumentName(data.document.name)}
                            </strong>
                            <form action="/list/delete/${data.document.id}" method="POST" class="delete-form">
                                <input type="hidden" name="csrfmiddlewaretoken" value="${document.querySelector('[name=csrfmiddlewaretoken]').value}">
                                <button type="submit" class="delete-btn"><i class="fa-trash-alt fas"></i></button>
                            </form>
                        </div>
                    `;
                    docList.insertBefore(li, docList.firstChild);
                    
                    // Add click event listener to the document name
                    const documentName = li.querySelector('.document-name');
                    documentName.addEventListener('click', function() {
                        startChat(data.document.id, cleanDocumentName(data.document.name));
                    });
                    
                    // Attach delete handler
                    attachDeleteHandler(li.querySelector('.delete-form'));
                    
                    // Start chat with the new document
                    startChat(data.document.id, cleanDocumentName(data.document.name));
                    
                    // Reset button and file input after short delay
                    setTimeout(() => {
                        btn.innerHTML = '<i class="fa-plus fas"></i> New Chat';
                        btn.disabled = false;
                        modalFileUpload.value = '';
                    }, 2000);
                } else {
                    showCustomAlert('error', 'Upload Failed', 'Failed to upload document');
                    resetNewChatButton();
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showCustomAlert('error', 'Upload Failed', 'Failed to upload document');
                resetNewChatButton();
            });
        }
    });

    function resetNewChatButton() {
        btn.innerHTML = '<i class="fa-plus fas"></i> New Chat';
        btn.disabled = false;
        modalFileUpload.value = ''; // Reset the file input
    }

    span.onclick = function() {
        modal.style.display = "none";
    };

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };

    modalUploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        modalPreloader.style.display = 'block';
        modalSuccessMessage.style.display = 'none';

        const formData = new FormData(modalUploadForm);
        fetch(modalUploadForm.action, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
            }
        })
        .then(response => {
            modalPreloader.style.display = 'none';
            if (response.ok) {
                modalSuccessMessage.style.display = 'block';
                setTimeout(() => {
                    modalSuccessMessage.style.display = 'none';
                    modal.style.display = 'none';
                    location.reload();
                }, 2000);
            } else {
                showCustomAlert('error', 'Upload Failed', 'Failed to upload document');
            }
        })
        .catch(error => {
            modalPreloader.style.display = 'none';
            console.error('Error:', error);
            showCustomAlert('error', 'Upload Failed', 'Failed to upload document');
        });
    });

    // Custom Alert Functions
    function showCustomAlert(type, title, message) {
        const alertBox = document.getElementById('themeAlert');
        const iconElement = document.getElementById('alertIcon');
        const titleElement = document.getElementById('alertTitle');
        const messageElement = document.getElementById('alertMessage');
        const buttonsContainer = document.getElementById('alertButtons');

        // Set content
        titleElement.textContent = title;
        messageElement.textContent = message;

        // Set icon based on type
        switch(type) {
            case 'success':
                iconElement.innerHTML = '✅';
                break;
            case 'error':
                iconElement.innerHTML = '❌';
                break;
            case 'warning':
                iconElement.innerHTML = '⚠️';
                break;
            default:
                iconElement.innerHTML = 'ℹ️';
        }

        // Set up buttons
        buttonsContainer.innerHTML = '<button class="theme-alert-button" id="alertButton">OK</button>';

        // Show alert
        alertBox.classList.add('theme-alert-show');

        // Set up close button
        document.getElementById('alertButton').onclick = function() {
            alertBox.classList.remove('theme-alert-show');
        };
    }

    function showCustomConfirm(title, message, onConfirm, onCancel) {
        const alertBox = document.getElementById('themeAlert');
        const iconElement = document.getElementById('alertIcon');
        const titleElement = document.getElementById('alertTitle');
        const messageElement = document.getElementById('alertMessage');
        const buttonsContainer = document.getElementById('alertButtons');

        // Set content
        titleElement.textContent = title;
        messageElement.textContent = message;
        iconElement.innerHTML = '❓';

        // Set up buttons
        buttonsContainer.innerHTML = `
            <button class="theme-alert-button-secondary" id="cancelButton">Cancel</button>
            <button class="theme-alert-button" id="confirmButton">Confirm</button>
        `;

        // Show alert
        alertBox.classList.add('theme-alert-show');

        // Set up button events
        document.getElementById('cancelButton').onclick = function() {
            alertBox.classList.remove('theme-alert-show');
            if (typeof onCancel === 'function') onCancel();
        };

        document.getElementById('confirmButton').onclick = function() {
            alertBox.classList.remove('theme-alert-show');
            if (typeof onConfirm === 'function') onConfirm();
        };
    };

});
