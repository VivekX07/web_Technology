document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const emailTextarea = document.getElementById('emailContent');
    const checkButton = document.getElementById('checkButton');
    const clearButton = document.getElementById('clearButton');
    const resultDiv = document.getElementById('result');
    const charCounter = document.getElementById('charCounter');
    const themeToggle = document.getElementById('themeToggle');
    const realTimeCheckbox = document.getElementById('realTimeCheck');
    const highlightKeywordsCheckbox = document.getElementById('highlightKeywords');
    const detailedAnalysisDiv = document.getElementById('detailedAnalysis');
    
    // Backend API URL - change this to match your server
    const API_URL = 'http://localhost:3000/api/check-spam';
    
    // Spam keywords for client-side highlighting
    const spamKeywords = [
        "winner", "free", "urgent", "claim now", "limited time", 
        "exclusive offer", "cash prize", "congratulations", "lottery", 
        "million dollars", "discount", "act now", "risk-free", 
        "guaranteed", "best price", "buy now", "click here", 
        "don't delete", "earn money", "fast cash", "investment", 
        "no risk", "special promotion", "viagra", "pharmacy",
        "weight loss", "enlargement", "miracle", "cure", "casino",
        "jackpot", "prize", "inheritance", "nigerian", "prince",
        "bank transfer", "offshore", "loan", "credit", "debt",
        "refinance", "mortgage", "insurance", "rates", "pills"
    ];
    
    // Debounce function to limit how often a function can be called
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    // Initialize theme from localStorage or system preference
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            updateThemeIcon(savedTheme);
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
            updateThemeIcon('dark');
        }
    }
    
    // Update theme toggle icon based on current theme
    function updateThemeIcon(theme) {
        if (theme === 'dark') {
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            themeToggle.setAttribute('aria-label', 'Switch to light mode');
        } else {
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            themeToggle.setAttribute('aria-label', 'Switch to dark mode');
        }
    }
    
    // Toggle between light and dark themes
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    }
    
    // Check spam with the backend API
    async function checkSpam() {
        const email = emailTextarea.value.trim();
        
        if (!email) return;
        
        // Disable button and show checking state
        checkButton.disabled = true;
        checkButton.innerHTML = '<span class="spinner"></span>Checking...';
        resultDiv.classList.add('hidden');
        detailedAnalysisDiv.classList.add('hidden');
        
        try {
            // Send the email content to the backend
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emailContent: email }),
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const data = await response.json();
            displayResult(data);
            displayDetailedAnalysis(data);
        } catch (error) {
            console.error('Error:', error);
            resultDiv.className = 'error';
            resultDiv.innerHTML = `
                <div class="result-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="result-text">
                    <p>An error occurred while checking the email.</p>
                    <p>${error.message}</p>
                </div>
            `;
            resultDiv.classList.remove('hidden');
        } finally {
            // Reset button
            checkButton.disabled = false;
            checkButton.innerHTML = '<i class="fas fa-search"></i> Check Spam';
        }
    }
    
    // Real-time spam check (simplified version for client-side)
    const realTimeSpamCheck = debounce(function() {
        if (!realTimeCheckbox.checked) return;
        
        const email = emailTextarea.value.trim();
        if (email.length < 50) {
            resultDiv.classList.add('hidden');
            return;
        }
        
        // Simple client-side check
        let spamScore = 0;
        let matchedWords = [];
        
        // Check for spam keywords
        spamKeywords.forEach(word => {
            const regex = new RegExp('\\b' + word + '\\b', 'i');
            if (regex.test(email)) {
                spamScore += 1;
                matchedWords.push(word);
            }
        });
        
        // Check for excessive exclamation marks
        const exclamationCount = (email.match(/!/g) || []).length;
        if (exclamationCount > 3) {
            spamScore += 1;
        }
        
        // Check for ALL CAPS sections
        const capsRegex = /\b[A-Z]{5,}\b/g;
        const capsMatches = email.match(capsRegex);
        if (capsMatches && capsMatches.length > 0) {
            spamScore += 1;
        }
        
        // Determine result based on score
        let resultClass, resultIcon, resultText;
        if (spamScore >= 3) {
            resultClass = 'spam';
            resultIcon = '<i class="fas fa-exclamation-circle"></i>';
            resultText = 'This email appears to be spam!';
        } else if (spamScore > 0) {
            resultClass = 'warning';
            resultIcon = '<i class="fas fa-exclamation-triangle"></i>';
            resultText = 'This email contains some suspicious elements.';
        } else {
            resultClass = 'not-spam';
            resultIcon = '<i class="fas fa-check-circle"></i>';
            resultText = 'This email appears to be legitimate.';
        }
        
        // Display result
        resultDiv.className = resultClass;
        resultDiv.innerHTML = `
            <div class="result-icon">${resultIcon}</div>
            <div class="result-text">
                <p>${resultText}</p>
                ${matchedWords.length > 0 ? `<p>Suspicious elements: ${matchedWords.join(', ')}</p>` : ''}
                <p>This is a preliminary check. For a detailed analysis, click "Check Spam".</p>
            </div>
        `;
        resultDiv.classList.remove('hidden');
        
        // Highlight keywords if option is checked
        if (highlightKeywordsCheckbox.checked && matchedWords.length > 0) {
            highlightKeywords(matchedWords);
        }
    }, 500);
    
    // Display detailed result from API
    function displayResult(data) {
        let resultClass, resultIcon, resultTitle;
        
        if (data.isSpam) {
            resultClass = 'spam';
            resultIcon = '<i class="fas fa-exclamation-circle"></i>';
            resultTitle = 'This is a SPAM email!';
        } else if (data.confidence > 20) {
            resultClass = 'warning';
            resultIcon = '<i class="fas fa-exclamation-triangle"></i>';
            resultTitle = 'This email contains suspicious elements.';
        } else {
            resultClass = 'not-spam';
            resultIcon = '<i class="fas fa-check-circle"></i>';
            resultTitle = 'This email appears to be legitimate.';
        }
        
        resultDiv.className = resultClass;
        resultDiv.innerHTML = `
            <div class="result-icon">${resultIcon}</div>
            <div class="result-text">
                <p>${resultTitle}</p>
                <p>Spam confidence: ${data.confidence}%</p>
                ${data.matchedKeywords && data.matchedKeywords.length > 0 ? 
                    `<p>Suspicious keywords detected:</p>
                    <ul>
                        ${data.matchedKeywords.map(keyword => `<li>${keyword}</li>`).join('')}
                    </ul>` : ''}
            </div>
        `;
        resultDiv.classList.remove('hidden');
        
        // Highlight keywords if option is checked
        if (highlightKeywordsCheckbox.checked && data.matchedKeywords && data.matchedKeywords.length > 0) {
            highlightKeywords(data.matchedKeywords);
        }
    }
    
    // Display detailed analysis
    function displayDetailedAnalysis(data) {
        const analysisContent = detailedAnalysisDiv.querySelector('.analysis-content');
        analysisContent.innerHTML = '';
        
        // Create analysis items
        const items = [
            {
                title: 'Spam Confidence',
                value: `${data.confidence}%`,
                meter: data.confidence
            },
            {
                title: 'Suspicious Keywords',
                value: data.matchedKeywords ? data.matchedKeywords.length : 0,
                meter: data.matchedKeywords ? Math.min(100, data.matchedKeywords.length * 10) : 0
            },
            {
                title: 'Pattern Matches',
                value: data.patternMatches || 0,
                meter: data.patternMatches ? Math.min(100, data.patternMatches * 20) : 0
            },
            {
                title: 'Overall Risk',
                value: data.isSpam ? 'High' : (data.confidence > 20 ? 'Medium' : 'Low'),
                meter: data.isSpam ? 90 : (data.confidence > 20 ? 50 : 10)
            }
        ];
        
        // Add items to analysis
        items.forEach(item => {
            const element = document.createElement('div');
            element.className = 'analysis-item';
            element.innerHTML = `
                <h4>${item.title}</h4>
                <p>${item.value}</p>
                <div class="meter-container">
                    <div class="meter-fill" style="width: 0%"></div>
                </div>
            `;
            analysisContent.appendChild(element);
            
            // Animate meter fill after a short delay
            setTimeout(() => {
                element.querySelector('.meter-fill').style.width = `${item.meter}%`;
            }, 100);
        });
        
        detailedAnalysisDiv.classList.remove('hidden');
    }
    
    // Highlight spam keywords in the textarea
    function highlightKeywords(keywords) {
        if (!keywords || keywords.length === 0) return;
        
        // Create a temporary div to hold the content
        const tempDiv = document.createElement('div');
        tempDiv.textContent = emailTextarea.value;
        let html = tempDiv.innerHTML;
        
        // Highlight each keyword
        keywords.forEach(keyword => {
            const regex = new RegExp('\\b(' + keyword + ')\\b', 'gi');
            html = html.replace(regex, '<span class="highlight">$1</span>');
        });
        
        // Create a temporary textarea to display the highlighted content
        const highlightedDiv = document.createElement('div');
        highlightedDiv.className = 'highlighted-content';
        highlightedDiv.innerHTML = html;
        highlightedDiv.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            padding: ${window.getComputedStyle(emailTextarea).padding};
            font-family: ${window.getComputedStyle(emailTextarea).fontFamily};
            font-size: ${window.getComputedStyle(emailTextarea).fontSize};
            line-height: ${window.getComputedStyle(emailTextarea).lineHeight};
            white-space: pre-wrap;
            overflow: hidden;
            background: transparent;
            pointer-events: none;
        `;
        
        // Position the textarea container as relative if it's not already
        const textareaContainer = emailTextarea.parentElement;
        if (window.getComputedStyle(textareaContainer).position !== 'relative') {
            textareaContainer.style.position = 'relative';
        }
        
        // Remove any existing highlighted content
        const existingHighlight = textareaContainer.querySelector('.highlighted-content');
        if (existingHighlight) {
            textareaContainer.removeChild(existingHighlight);
        }
        
        // Add the highlighted content
        textareaContainer.appendChild(highlightedDiv);
    }
    
    // Clear text and results
    function clearText() {
        emailTextarea.value = '';
        updateCharacterCount();
        resultDiv.classList.add('hidden');
        detailedAnalysisDiv.classList.add('hidden');
        checkButton.disabled = true;
        
        // Remove any highlighted content
        const highlightedContent = document.querySelector('.highlighted-content');
        if (highlightedContent) {
            highlightedContent.remove();
        }
    }
    
    // Update character count
    function updateCharacterCount() {
        const length = emailTextarea.value.length;
        charCounter.textContent = `${length} / 5000`;
        
        // Enable/disable check button
        checkButton.disabled = !emailTextarea.value.trim();
    }
    
    // Event Listeners
    checkButton.addEventListener('click', checkSpam);
    clearButton.addEventListener('click', clearText);
    themeToggle.addEventListener('click', toggleTheme);
    
    emailTextarea.addEventListener('input', function() {
        updateCharacterCount();
        realTimeSpamCheck();
    });
    
    realTimeCheckbox.addEventListener('change', function() {
        if (this.checked && emailTextarea.value.trim().length >= 50) {
            realTimeSpamCheck();
        } else if (!this.checked) {
            resultDiv.classList.add('hidden');
        }
    });
    
    highlightKeywordsCheckbox.addEventListener('change', function() {
        const highlightedContent = document.querySelector('.highlighted-content');
        
        if (this.checked) {
            // If we have a result, highlight the keywords
            if (!resultDiv.classList.contains('hidden')) {
                const matchedKeywords = Array.from(resultDiv.querySelectorAll('.result-text ul li'))
                    .map(li => li.textContent);
                highlightKeywords(matchedKeywords);
            }
        } else if (highlightedContent) {
            // Remove highlighting
            highlightedContent.remove();
        }
    });
    
    // Initialize
    initTheme();
    updateCharacterCount();
});