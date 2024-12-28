// State Management
const state = {
    currentPage: 0,
    itemsPerPage: 10,
    activeBooks: new Set(),
    savedQuotes: [],
    currentQuoteId: null,
    isLoading: false,
    hasMore: true
};
// Comment Management
const commentManager = {
    async submitComment(button) {
        const input = button.previousElementSibling;
        const message = input.value.trim();
        
        if (!message || !state.currentQuoteId) return;
        
        this.setSubmitting(true, input, button);
        
        try {
            const feedItem = document.querySelector(`[data-quote-id="${state.currentQuoteId}"]`);
            const context = feedItem.querySelector('.source-text').textContent;
            const bookTitle = feedItem.querySelector('.book-tag').textContent;
            
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    context,
                    book_title: bookTitle,
                    quote_id: state.currentQuoteId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                input.value = '';
                await this.loadComments(state.currentQuoteId);
                feedManager.updateCommentCount(state.currentQuoteId);
            } else {
                throw new Error(data.error || 'Failed to send message');
            }
        } catch (error) {
            console.error('Comment error:', error);
            quoteActions.showToast('Failed to send message');
        } finally {
            this.setSubmitting(false, input, button);
        }
    },

    setSubmitting(isSubmitting, input, button) {
        input.disabled = isSubmitting;
        button.disabled = isSubmitting;
        button.querySelector('.button-text').style.display = isSubmitting ? 'none' : 'block';
        button.querySelector('.button-loader').style.display = isSubmitting ? 'block' : 'none';
        document.querySelector('.typing-indicator').style.display = isSubmitting ? 'block' : 'none';
    },

    async loadComments(quoteId) {
        const container = document.querySelector('.comments-container');
        container.innerHTML = '<div class="loading">Loading comments...</div>';
        
        try {
            const response = await fetch(`/comments/${quoteId}`);
            const data = await response.json();
            
            if (data.success) {
                this.displayComments(data.comments);
            } else {
                throw new Error('Failed to load comments');
            }
        } catch (error) {
            container.innerHTML = `
                <div class="error-message">
                    Failed to load comments. Please try again.
                </div>
            `;
        }
    },

    displayComments(comments) {
        const container = document.querySelector('.comments-container');
        container.innerHTML = '';
        
        if (!comments.length) {
            container.innerHTML = `
                <div class="empty-comments">
                    <p></p>
                </div>
            `;
            return;
        }
        
        comments.forEach(comment => {
            container.appendChild(this.createCommentElement('user', comment));
            container.appendChild(this.createCommentElement('ai', comment));
        });
        
        container.scrollTop = container.scrollHeight;
    },

    createCommentElement(type, comment) {
        const template = document.getElementById('commentTemplate').content.cloneNode(true);
        const element = template.querySelector('.comment');
        
        element.classList.add(`${type}-comment`);
        element.querySelector('.comment-author').textContent = type === 'user' ? 'You' : 'AI';
        element.querySelector('.comment-time').textContent = new Date(comment.timestamp).toLocaleString();
        element.querySelector('.comment-body').textContent = 
            type === 'user' ? comment.user_message : comment.ai_response;
        
        return element;
    }
};

// Update the window exports
window.submitComment = (button) => commentManager.submitComment(button);
// Theme Management
const themeManager = {
    toggle() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    },

    init() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
};

// Feed Management
const feedManager = {
    async generate(loadMore = false) {
        console.log('Attempting to generate feed:', { loadMore, state });
        if (state.isLoading || (!loadMore && !state.hasMore)) return;
        
        const feedDiv = document.getElementById('feed');
        const generateBtn = document.getElementById('generateFeedBtn');
        
        try {
            state.isLoading = true;
            generateBtn.disabled = true;
            generateBtn.querySelector('.loading-spinner').style.display = 'block';
            
            if (!loadMore) {
                state.currentPage = 0;
                feedDiv.innerHTML = '';
            }
            
            const params = new URLSearchParams({
                page: state.currentPage,
                books: Array.from(state.activeBooks).join(','),
                items_per_page: state.itemsPerPage
            });
            
            console.log('Fetching feed with params:', params.toString());
            const response = await fetch(`/feed?${params}`);
            const data = await response.json();
            console.log('Feed response:', data);
            
            if (data.status === 'success' && data.feed) {
                this.displayFeed(data.feed, loadMore);
                state.hasMore = data.has_more;
                state.currentPage = data.next_page || state.currentPage;
                
                const loadMoreBtn = document.getElementById('loadMoreBtn');
                if (loadMoreBtn) {
                    loadMoreBtn.style.display = state.hasMore ? 'block' : 'none';
                }
            } else {
                throw new Error(data.message || 'No feed data received');
            }
            
        } catch (error) {
            console.error('Feed error:', error);
            feedDiv.innerHTML = `
                <div class="error-message">
                    <p>Failed to load feed</p>
                    <button onclick="feedManager.generate(false)" class="retry-btn">Try Again</button>
                </div>
            `;
        } finally {
            state.isLoading = false;
            generateBtn.disabled = false;
            generateBtn.querySelector('.loading-spinner').style.display = 'none';
        }
    },

    displayFeed(items, append = false) {
        const feedDiv = document.getElementById('feed');
        
        if (!append) {
            feedDiv.innerHTML = '';
        }
        
        if (!items.length && !append) {
            feedDiv.innerHTML = `
                <div class="empty-state">
                    <p>No quotes found. Try uploading some books!</p>
                </div>
            `;
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        items.forEach(item => {
            const template = document.getElementById('feedItemTemplate').content.cloneNode(true);
            const feedItem = template.querySelector('.feed-item');
            
            feedItem.dataset.quoteId = item.id;
            feedItem.querySelector('.book-tag').textContent = item.book_title;
            feedItem.querySelector('.tweet-text').textContent = item.preview;
            
            // Update source text with new format
            const sourceText = feedItem.querySelector('.source-text');
            sourceText.querySelector('.source-content').textContent = item.full_text;
            sourceText.querySelector('.chapter-info').textContent = item.chapter || 'Unknown Chapter';
            sourceText.querySelector('.position-info').textContent = item.position || '';
            
            fragment.appendChild(feedItem);
        });
        
        feedDiv.appendChild(fragment);
        this.updateAllCommentCounts();
    },

    async updateAllCommentCounts() {
        const feedItems = document.querySelectorAll('.feed-item');
        for (const item of feedItems) {
            await this.updateCommentCount(item.dataset.quoteId);
        }
    },

    async updateCommentCount(quoteId) {
        try {
            const response = await fetch(`/comments/${quoteId}`);
            const data = await response.json();
            
            if (data.success) {
                const countElement = document.querySelector(`[data-quote-id="${quoteId}"] .comment-count`);
                if (countElement) {
                    const count = data.comments.length;
                    countElement.style.display = count > 0 ? 'block' : 'none';
                    countElement.querySelector('.count').textContent = count;
                }
            }
        } catch (error) {
            console.error('Error updating comment count:', error);
        }
    }
};

// Quote Actions
const quoteActions = {
    toggleSource(button) {
        const feedItem = button.closest('.feed-item');
        const sourceDiv = feedItem.querySelector('.source-text');
        const isHidden = sourceDiv.style.display === 'none';
        
        sourceDiv.style.display = isHidden ? 'block' : 'none';
        button.querySelector('span').textContent = isHidden ? 'Hide Source' : 'Source';
        button.querySelector('svg').style.transform = isHidden ? 'rotate(45deg)' : 'none';
    },

    saveQuote(button) {
        const feedItem = button.closest('.feed-item');
        const quote = feedItem.querySelector('.tweet-text').textContent;
        const bookTitle = feedItem.querySelector('.book-tag').textContent;
        const quoteId = feedItem.dataset.quoteId;
        
        const existingIndex = state.savedQuotes.findIndex(sq => sq.quoteId === quoteId);
        
        if (existingIndex !== -1) {
            state.savedQuotes.splice(existingIndex, 1);
            button.classList.remove('saved');
            this.showToast('Quote removed from saved');
        } else {
            state.savedQuotes.push({
                id: Date.now(),
                quoteId,
                quote,
                book: bookTitle
            });
            button.classList.add('saved');
            this.showToast('Quote saved');
        }
        
        this.updateSavedQuotesList();
        this.updateSavedCount();
    },

    async shareQuote(button) {
        const feedItem = button.closest('.feed-item');
        const quote = feedItem.querySelector('.tweet-text').textContent;
        const bookTitle = feedItem.querySelector('.book-tag').textContent;
        const shareText = `${quote}\n\nFrom: ${bookTitle}`;
        
        try {
            if (navigator.share) {
                await navigator.share({
                    text: shareText,
                    title: 'BookFeed Quote'
                });
            } else {
                await navigator.clipboard.writeText(shareText);
                this.showToast('Copied to clipboard');
            }
        } catch (error) {
            console.error('Share failed:', error);
            this.showToast('Failed to share quote');
        }
    },

    updateSavedQuotesList() {
        const savedQuotesList = document.getElementById('savedQuotesList');
        
        if (!state.savedQuotes.length) {
            savedQuotesList.innerHTML = `
                <div class="empty-saved">
                    <p>No saved quotes yet</p>
                </div>
            `;
            return;
        }
        
        savedQuotesList.innerHTML = state.savedQuotes.map(saved => `
            <div class="saved-quote" data-id="${saved.id}">
                <div class="saved-quote-content">
                    <p class="book-tag">${saved.book}</p>
                    <p class="quote-text">${saved.quote}</p>
                </div>
                <div class="saved-quote-actions">
                    <button onclick="quoteActions.removeSavedQuote(${saved.id})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    },

    removeSavedQuote(id) {
        state.savedQuotes = state.savedQuotes.filter(quote => quote.id !== id);
        this.updateSavedQuotesList();
        this.updateSavedCount();
        this.showToast('Quote removed');
    },

    updateSavedCount() {
        const count = document.querySelector('.saved-count');
        if (count) {
            count.textContent = state.savedQuotes.length;
        }
    },

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        
        const container = document.getElementById('toastContainer');
        container.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 2000);
        });
    }
};

// File Upload Handler
const fileHandler = {
    async handleUpload(files) {
        if (!files.length) return;

        const formData = new FormData();
        for (const file of files) {
            formData.append('files', file);
        }

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.error) {
                quoteActions.showToast(data.error);
                return;
            }

            if (data.successful_uploads.length) {
                quoteActions.showToast(`Successfully uploaded ${data.successful_uploads.length} books`);
                location.reload();
            }
        } catch (error) {
            console.error('Upload error:', error);
            quoteActions.showToast('Error uploading files');
        }
    }
};

// Initialize Application
// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing application...');
    themeManager.init();
    feedManager.generate(); // This will automatically load the feed
    quoteActions.updateSavedQuotesList();
    quoteActions.updateSavedCount();
    
    // Event Listeners
    document.getElementById('fileUpload').addEventListener('change', (event) => {
        fileHandler.handleUpload(event.target.files);
    });

    // Initialize infinite scroll
    window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000 &&
            state.hasMore && !state.isLoading) {
            feedManager.generate(true);
        }
    });
});

// Export functions for HTML access
window.toggleTheme = () => themeManager.toggle();
window.generateNewFeed = () => feedManager.generate(false);
window.toggleSource = (button) => quoteActions.toggleSource(button);
window.saveQuote = (button) => quoteActions.saveQuote(button);
window.shareQuote = (button) => quoteActions.shareQuote(button);
window.toggleSavedQuotes = () => {
    const panel = document.getElementById('savedQuotesPanel');
    const container = document.querySelector('.container');
    panel.classList.toggle('show');
    container.classList.toggle('panel-open');
};
window.filterBook = (bookTitle) => {
    if (bookTitle === 'all') {
        state.activeBooks.clear();
    } else {
        if (state.activeBooks.has(bookTitle)) {
            state.activeBooks.delete(bookTitle);
        } else {
            state.activeBooks.add(bookTitle);
        }
    }
    feedManager.generate(false);
};
window.removeBook = async (bookTitle) => {
    try {
        const response = await fetch('/remove-book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ book: bookTitle })
        });
        
        if (response.ok) {
            location.reload();
        }
    } catch (error) {
        console.error('Error removing book:', error);
        quoteActions.showToast('Failed to remove book');
    }
};
window.uploadFile = () => {
    document.getElementById('fileUpload').click();
};
window.openComments = (button) => {
    const feedItem = button.closest('.feed-item');
    const quoteId = feedItem.dataset.quoteId;
    const bookTitle = feedItem.querySelector('.book-tag').textContent;
    const quoteText = feedItem.querySelector('.tweet-text').textContent;
    
    state.currentQuoteId = quoteId;
    
    const modal = document.getElementById('commentModal');
    modal.querySelector('.book-tag').textContent = bookTitle;
    modal.querySelector('.quote-text').textContent = quoteText;
    
    modal.classList.add('show');
    commentManager.loadComments(quoteId);
};
window.closeCommentModal = () => {
    const modal = document.getElementById('commentModal');
    modal.classList.remove('show');
    state.currentQuoteId = null;
};
window.handleCommentKeydown = (event, textarea) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        commentManager.submitComment(textarea.nextElementSibling);
    }
};